import "server-only";

import fs from "fs";
import path from "path";

import {YONSEI_STATIC_TIMETABLES} from "@entities/schedule/yonseiStaticTimetables";
import {distributedCache} from "@shared/cache/distributedCache";
import {artifactStore} from "@shared/cache/artifactStore";
// Re-export canonical time utilities
import {formatMinutesToTime, getCurrentKstMinutes, parseTimeToMinutes,} from "@shared/lib/timeUtils";

/**
 * Operating Service Window Engine for Wonju City Buses
 *
 * Prevents useless API traffic to apis.data.go.kr during late-night / dawn hours (e.g., 23:50 ~ 05:30)
 * when buses are not running, while ensuring running buses are NEVER cut off early.
 */

// Buffer configurations (in minutes)
const PRE_DEPARTURE_BUFFER_MINUTES = 20; // Probing starts 20 mins before first origin departure
const POST_DEPARTURE_BUFFER_MINUTES = 80; // Window stays open 80 mins after last terminus departure (covers full city trip)
const ACTIVITY_HOLD_MS = 15 * 60 * 1000;   // Dynamic extension if a bus was recently observed active
const DEFAULT_FIRST_BUS_MINUTES = 5 * 60 + 40; // 05:40 fallback
const DEFAULT_LAST_BUS_MINUTES = 22 * 60 + 30; // 22:30 fallback

export interface RouteOperatingWindow {
    routeNo: string;
    firstBus: string;
    lastBus: string;
    startMinutes: number; // e.g. 340 (05:40)
    endMinutes: number;   // e.g. 1445 (24:05)
    source: "yonsei_static" | "schedule_json" | "default";
}

export interface ServiceStatus {
    inService: boolean;
    reason: "in_window" | "activity_override" | "outside_window";
    window: RouteOperatingWindow;
    currentKstMinutes: number;
    retryAfterSeconds: number;
}

// In-memory cache for computed route windows (keyed by city:routeNo:dayBucket)
const windowCache = new Map<string, RouteOperatingWindow>();
// In-memory activity tracking for dynamic window extension
const lastActiveBusTimestamp = new Map<string, number>();
// Mapping from canonical cityCode:routeId -> human-readable routeNo (e.g. "32020:WJB251000068" -> "30")
const routeIdToNumberMap = new Map<string, string>();
const UNRESOLVED_RETRY_MS = 5 * 60 * 1000;
const unresolvedRouteIds = new Map<string, number>();
const warmPromises = new Map<string, Promise<void>>();
const warmedCities = new Set<string>();

export {
    formatMinutesToTime,
    getCurrentKstMinutes,
    parseTimeToMinutes,
};

/**
 * Extract clean route number from route ID or variant (e.g. "30", "2(평일)", "GWB320200030" -> "30")
 */
export function extractRouteNumber(routeIdOrNo: string): string {
    const raw = String(routeIdOrNo).trim();
    const withoutDayType = raw.replace(/\([^)]+\)/g, "").trim();

    if (withoutDayType.startsWith("GWB32020")) {
        const lastPart = withoutDayType.replace("GWB32020", "").replace(/^0+/, "");
        return lastPart || withoutDayType;
    }
    return withoutDayType;
}

/**
 * Register an authoritative routeId -> routeNo mapping (e.g. from TAGO getRouteNoList or live telemetry)
 * so routes with opaque serial IDs like WJB251000068 resolve to their actual timetable/schedule row.
 */
export function registerRouteIdMapping(cityCode: string, routeId: string, routeNo: string): void {
    const normalizedCity = cityCode || "32020";
    const cleanId = String(routeId || "").trim();
    const cleanNo = extractRouteNumber(String(routeNo || "").trim());
    if (!cleanId || !cleanNo || cleanNo === cleanId) return;

    const mapKey = `${normalizedCity}:${cleanId}`;
    if (routeIdToNumberMap.get(mapKey) === cleanNo) return;

    routeIdToNumberMap.set(mapKey, cleanNo);
    unresolvedRouteIds.delete(mapKey);

    // Clear stale default entries keyed under the raw routeId so next lookup uses cleanNo
    for (const bucket of ["weekday", "weekend"]) {
        windowCache.delete(`${normalizedCity}:${cleanId}:${bucket}`);
    }
}

/**
 * Bulk-register routeId -> routeNo mappings from a city route directory.
 */
export function registerCityRoutesMapping(
    cityCode: string,
    routes: Array<{ routeid: string; routeno: string | number }>
): void {
    const normalizedCity = cityCode || "32020";
    const mapping: Record<string, string> = {};
    for (const r of routes) {
        if (r?.routeid && r?.routeno !== undefined && r?.routeno !== null) {
            const cleanId = String(r.routeid).trim();
            const cleanNo = extractRouteNumber(String(r.routeno).trim());
            registerRouteIdMapping(normalizedCity, cleanId, cleanNo);
            if (cleanId && cleanNo && cleanNo !== cleanId) {
                mapping[cleanId] = cleanNo;
            }
        }
    }
    if (Object.keys(mapping).length > 0) {
        void distributedCache.set(`route-id-map:${normalizedCity}`, mapping, 7 * 86400);
    }
}

/**
 * Asynchronously warms schedule.json and routeId->routeNo mappings from durable/distributed stores
 * so cold serverless containers resolve serial route IDs (e.g. WJB...) accurately.
 */
export async function warmRouteWindowResources(cityCode: string = "32020"): Promise<void> {
    const normalizedCity = cityCode || "32020";
    if (warmedCities.has(normalizedCity)) return;

    const existing = warmPromises.get(normalizedCity);
    if (existing) return existing;

    const promise = (async () => {
        try {
            const [mapFromRedis, scheduleStored] = await Promise.all([
                distributedCache.get<Record<string, string>>(`route-id-map:${normalizedCity}`, 350),
                !cachedScheduleJson
                    ? artifactStore.getJson<{
                        routes: Array<{ routeNo: string; firstBus: string; lastBus: string; dayType?: string }>;
                    }>("schedule.json")
                    : Promise.resolve(null),
            ]);

            if (mapFromRedis && typeof mapFromRedis === "object") {
                for (const [rid, rno] of Object.entries(mapFromRedis)) {
                    if (rid && rno) {
                        registerRouteIdMapping(normalizedCity, rid, rno);
                    }
                }
            }

            if (scheduleStored?.data?.routes?.length) {
                cachedScheduleJson = scheduleStored.data;
                windowCache.clear();
            }
            warmedCities.add(normalizedCity);
        } catch {
            // Non-blocking warm-up
        } finally {
            warmPromises.delete(normalizedCity);
        }
    })();

    warmPromises.set(normalizedCity, promise);
    return promise;
}

/**
 * Resolve a routeId or routeNo to its canonical routeNo using hints, dynamic map, and local route snapshots.
 */
export function resolveRouteNumber(routeIdOrNo: string, cityCode: string = "32020", routeNoHint?: string): string {
    if (routeNoHint) {
        const hintClean = extractRouteNumber(routeNoHint);
        if (hintClean) {
            registerRouteIdMapping(cityCode, routeIdOrNo, hintClean);
            return hintClean;
        }
    }

    const normalizedCity = cityCode || "32020";
    const cleanInput = extractRouteNumber(routeIdOrNo);
    const mapKey = `${normalizedCity}:${cleanInput}`;
    const mapped = routeIdToNumberMap.get(mapKey);
    if (mapped) return mapped;

    const unresolvedAt = unresolvedRouteIds.get(mapKey);
    const shouldCheckFs = !unresolvedAt || Date.now() - unresolvedAt >= UNRESOLVED_RETRY_MS;

    // Best-effort lookup from prebuilt route JSON on local/serverless bundle
    if (shouldCheckFs && (normalizedCity === "32020" || normalizedCity === "32320")) {
        const candidates = [
            path.join("/tmp", "routes", normalizedCity, `${cleanInput}.json`),
            path.join(process.cwd(), "public", "routes", normalizedCity, `${cleanInput}.json`),
            path.join("/tmp", "routes", `${cleanInput}.json`),
            path.join(process.cwd(), "public", "routes", `${cleanInput}.json`),
        ];
        for (const routePath of candidates) {
            try {
                if (fs.existsSync(/*turbopackIgnore: true*/ routePath)) {
                    const raw = fs.readFileSync(/*turbopackIgnore: true*/ routePath, "utf-8");
                    const parsed = JSON.parse(raw) as { route_no?: string };
                    if (parsed?.route_no && parsed.route_no !== cleanInput) {
                        const resolved = extractRouteNumber(parsed.route_no);
                        registerRouteIdMapping(normalizedCity, cleanInput, resolved);
                        return resolved;
                    }
                }
            } catch {
                // Ignore FS read failures
            }
        }
        unresolvedRouteIds.set(mapKey, Date.now());
    }

    return cleanInput;
}

/**
 * Invalidate in-memory schedule.json and computed operating window caches when timetables are refreshed.
 */
export function invalidateRouteWindowScheduleCache(): void {
    cachedScheduleJson = null;
    windowCache.clear();
    warmedCities.clear();
}

export function getRouteWindowStats() {
    return {
        mappedRoutes: routeIdToNumberMap.size,
        windowCacheEntries: windowCache.size,
        unresolvedCount: unresolvedRouteIds.size,
        hasScheduleLoaded: Boolean(cachedScheduleJson?.routes?.length),
        warmedCities: Array.from(warmedCities),
    };
}

export function getClientPollHint(
    routeIds: string[],
    cityCode: string = "32020",
    now: Date = new Date()
): { inService: boolean; nextPollAfterMs?: number } {
    if (!routeIds || routeIds.length === 0) {
        return {inService: true};
    }

    let minRetrySeconds = Infinity;
    for (const id of routeIds) {
        const status = isRouteInServiceWindow(id, now, cityCode);
        if (status.inService) {
            return {inService: true};
        }
        if (status.retryAfterSeconds < minRetrySeconds) {
            minRetrySeconds = status.retryAfterSeconds;
        }
    }

    if (!Number.isFinite(minRetrySeconds)) {
        return {inService: true};
    }

    // Cap client wake-up backoff at 5 minutes (300_000ms) so buses starting early are still discovered
    const nextPollAfterMs = Math.max(60_000, Math.min(300_000, minRetrySeconds * 1000));
    return {inService: false, nextPollAfterMs};
}

/**
 * Load static schedule database if available locally
 */
let cachedScheduleJson: {
    routes: Array<{ routeNo: string; firstBus: string; lastBus: string; dayType?: string }>
} | null = null;

function getScheduleData() {
    if (cachedScheduleJson) return cachedScheduleJson;
    const candidates = [
        "/tmp/schedule.json",
        path.join(process.cwd(), "public", "schedule.json"),
        path.join(process.cwd(), "public", "data", "schedule.json"),
    ];
    for (const localPath of candidates) {
        try {
            if (fs.existsSync(/*turbopackIgnore: true*/ localPath)) {
                const raw = fs.readFileSync(/*turbopackIgnore: true*/ localPath, "utf-8");
                cachedScheduleJson = JSON.parse(raw);
                return cachedScheduleJson;
            }
        } catch {
            // Fallback gracefully in constrained environments
        }
    }
    return null;
}

// Strategy Interface for City-scoped Operating Window resolution
interface CityWindowStrategy {
    resolve(routeNo: string, now?: Date): RouteOperatingWindow | null;
}

function isKstWeekend(now: Date = new Date()): boolean {
    const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const day = kstDate.getUTCDay();
    return day === 0 || day === 6;
}

function matchesDayType(dayType: string | undefined, isWeekend: boolean): boolean {
    if (!dayType) return true;
    const normalized = dayType.trim();
    if (!normalized || normalized.includes("매일")) return true;
    if (isWeekend) {
        return /토|일|주말|휴일|공휴일/.test(normalized);
    }
    return /평일|방학/.test(normalized) || !/^(토|일|주말|휴일|공휴일)/.test(normalized);
}

const nightRouteStrategy: CityWindowStrategy = {
    resolve(routeNo: string): RouteOperatingWindow | null {
        if (!/^(?:N\d+|A\d+|새벽|심야)/i.test(routeNo)) return null;
        return {
            routeNo,
            firstBus: "00:00",
            lastBus: "23:59",
            startMinutes: 0,
            endMinutes: 1440,
            source: "default",
        };
    },
};

const wonjuStrategy: CityWindowStrategy = {
    resolve(routeNo: string, now: Date = new Date()): RouteOperatingWindow | null {
        // 1. Check Yonsei Static Timetables (30, 34, 34-1) - Wonju only
        const yonseiKey = routeNo as keyof typeof YONSEI_STATIC_TIMETABLES;
        if (YONSEI_STATIC_TIMETABLES[yonseiKey]) {
            const routeData = YONSEI_STATIC_TIMETABLES[yonseiKey];
            let earliestMin = Infinity;
            let latestMin = -Infinity;

            // Check both weekday & vacation origins/destinations
            [routeData.weekday, routeData.vacation].forEach((modeData) => {
                if (!modeData) return;
                [...modeData.origin, ...modeData.dest].forEach((timeStr) => {
                    const min = parseTimeToMinutes(timeStr);
                    if (min !== null) {
                        if (min < earliestMin) earliestMin = min;
                        if (min > latestMin) latestMin = min;
                    }
                });
            });

            if (earliestMin !== Infinity && latestMin !== -Infinity) {
                return {
                    routeNo,
                    firstBus: formatMinutesToTime(earliestMin),
                    lastBus: formatMinutesToTime(latestMin),
                    startMinutes: Math.max(0, earliestMin - PRE_DEPARTURE_BUFFER_MINUTES),
                    endMinutes: latestMin + POST_DEPARTURE_BUFFER_MINUTES,
                    source: "yonsei_static",
                };
            }
        }

        // 2. Check full schedule.json dataset for Wonju routes
        const schedule = getScheduleData();
        if (schedule?.routes) {
            const weekend = isKstWeekend(now);
            const allMatching = schedule.routes.filter((r) => extractRouteNumber(r.routeNo) === routeNo);
            const dayMatching = allMatching.filter((r) => matchesDayType(r.dayType, weekend));
            const targetRows = dayMatching.length > 0 ? dayMatching : allMatching;

            let earliestMin = Infinity;
            let latestMin = -Infinity;

            targetRows.forEach((r) => {
                const firstMin = parseTimeToMinutes(r.firstBus);
                const lastMin = parseTimeToMinutes(r.lastBus);
                if (firstMin !== null && firstMin < earliestMin) earliestMin = firstMin;
                if (lastMin !== null && lastMin > latestMin) latestMin = lastMin;
            });

            if (earliestMin !== Infinity && latestMin !== -Infinity) {
                return {
                    routeNo,
                    firstBus: formatMinutesToTime(earliestMin),
                    lastBus: formatMinutesToTime(latestMin),
                    startMinutes: Math.max(0, earliestMin - PRE_DEPARTURE_BUFFER_MINUTES),
                    endMinutes: latestMin + POST_DEPARTURE_BUFFER_MINUTES,
                    source: "schedule_json",
                };
            }
        }
        return null;
    },
};

const seoulStrategy: CityWindowStrategy = {
    resolve(routeNo: string): RouteOperatingWindow | null {
        return {
            routeNo,
            firstBus: "04:00",
            lastBus: "01:00",
            startMinutes: 3 * 60 + 40, // 03:40
            endMinutes: 25 * 60 + 30,  // 01:30 next day
            source: "default",
        };
    },
};

const cityStrategies: Record<string, CityWindowStrategy> = {
    "32020": wonjuStrategy,
    "11": seoulStrategy,
};

/**
 * Compute the operating service window for a given route.
 * Wonju ("32020") routes use Yonsei static timetables and schedule.json; other cities use default window.
 */
export function getRouteOperatingWindow(
    routeIdOrNo: string,
    cityCode: string = "32020",
    options?: { routeNoHint?: string; now?: Date }
): RouteOperatingWindow {
    const normalizedCity = cityCode || "32020";
    const routeNo = resolveRouteNumber(routeIdOrNo, normalizedCity, options?.routeNoHint);
    const now = options?.now ?? new Date();
    const dayBucket = isKstWeekend(now) ? "weekend" : "weekday";
    const cacheKey = `${normalizedCity}:${routeNo}:${dayBucket}`;

    const cached = windowCache.get(cacheKey);
    if (cached) return cached;

    // 1. Check Night / Autonomous routes first across all cities
    const nightMatch = nightRouteStrategy.resolve(routeNo, now);
    if (nightMatch) {
        windowCache.set(cacheKey, nightMatch);
        return nightMatch;
    }

    // 2. Delegate to city-specific strategy if registered
    const strategy = cityStrategies[normalizedCity];
    if (strategy) {
        const result = strategy.resolve(routeNo, now);
        if (result) {
            windowCache.set(cacheKey, result);
            return result;
        }
    }

    // 3. Fallback default window (05:20 ~ 23:50)
    const defaultWindow: RouteOperatingWindow = {
        routeNo,
        firstBus: formatMinutesToTime(DEFAULT_FIRST_BUS_MINUTES),
        lastBus: formatMinutesToTime(DEFAULT_LAST_BUS_MINUTES),
        startMinutes: Math.max(0, DEFAULT_FIRST_BUS_MINUTES - PRE_DEPARTURE_BUFFER_MINUTES),
        endMinutes: DEFAULT_LAST_BUS_MINUTES + POST_DEPARTURE_BUFFER_MINUTES,
        source: "default",
    };
    windowCache.set(cacheKey, defaultWindow);
    return defaultWindow;
}

/**
 * Record active bus telemetry to dynamically extend service window if a bus is still running late.
 */
export function recordRouteBusActivity(
    routeIdOrNo: string,
    busCount: number,
    cityCode: string = "32020",
    routeNoHint?: string
): void {
    const normalizedCity = cityCode || "32020";
    const routeNo = resolveRouteNumber(routeIdOrNo, normalizedCity, routeNoHint);
    if (busCount > 0) {
        const now = Date.now();
        lastActiveBusTimestamp.set(`${normalizedCity}:${routeNo}`, now);
        lastActiveBusTimestamp.set(`${normalizedCity}:${routeIdOrNo}`, now);
    }
}

/**
 * Determines whether a route is currently in its active operating service window.
 */
export function isRouteInServiceWindow(
    routeIdOrNo: string,
    now: Date = new Date(),
    cityCode: string = "32020",
    routeNoHint?: string
): ServiceStatus {
    const normalizedCity = cityCode || "32020";
    const routeNo = resolveRouteNumber(routeIdOrNo, normalizedCity, routeNoHint);
    const window = getRouteOperatingWindow(routeIdOrNo, normalizedCity, {routeNoHint, now});
    const currentKst = getCurrentKstMinutes(now);

    // 1. Check dynamic activity override (a bus was recently seen running within last 15 min)
    const lastActive =
        lastActiveBusTimestamp.get(`${normalizedCity}:${routeNo}`) ||
        lastActiveBusTimestamp.get(`${normalizedCity}:${routeIdOrNo}`);
    if (lastActive && Date.now() - lastActive < ACTIVITY_HOLD_MS) {
        return {
            inService: true, reason: "activity_override", window, currentKstMinutes: currentKst, retryAfterSeconds: 4,
        };
    }

    // 2. Check time window bounds
    const {startMinutes, endMinutes} = window;
    let inService: boolean;

    if (endMinutes < 1440) {
        // Window is entirely within the same calendar day (e.g. 05:40 ~ 23:30)
        inService = currentKst >= startMinutes && currentKst <= endMinutes;
    } else {
        // Window crosses midnight (e.g. 05:40 ~ 24:10 / 00:10 next day)
        const rolloverEndMinutes = endMinutes - 1440;
        inService = currentKst >= startMinutes || currentKst <= rolloverEndMinutes;
    }

    // 3. Compute retryAfter / cache TTL
    let retryAfterSeconds = 4;
    if (!inService) {
        // Compute seconds until the next startMinutes
        let minutesUntilNextStart: number;
        if (currentKst < startMinutes) {
            minutesUntilNextStart = startMinutes - currentKst;
        } else {
            minutesUntilNextStart = (1440 - currentKst) + startMinutes;
        }
        // Cap TTL between 300s (5 min) and 1800s (30 min) to allow timely wakeup
        retryAfterSeconds = Math.max(300, Math.min(1800, minutesUntilNextStart * 60));
    }

    return {
        inService,
        reason: inService ? "in_window" : "outside_window",
        window,
        currentKstMinutes: currentKst,
        retryAfterSeconds,
    };
}
