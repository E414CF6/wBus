import "server-only";

import fs from "fs";
import path from "path";

import {YONSEI_STATIC_TIMETABLES} from "@entities/schedule/yonseiStaticTimetables";
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

// In-memory cache for computed route windows
const windowCache = new Map<string, RouteOperatingWindow>();
// In-memory activity tracking for dynamic window extension
const lastActiveBusTimestamp = new Map<string, number>();

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
 * Load static schedule database if available locally
 */
let cachedScheduleJson: {
    routes: Array<{ routeNo: string; firstBus: string; lastBus: string; dayType?: string }>
} | null = null;

function getScheduleData() {
    if (cachedScheduleJson) return cachedScheduleJson;
    const candidates = [path.join(process.cwd(), "public", "schedule.json"), path.join(process.cwd(), "public", "data", "schedule.json"),];
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
    resolve(routeNo: string): RouteOperatingWindow | null;
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
    resolve(routeNo: string): RouteOperatingWindow | null {
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
            let earliestMin = Infinity;
            let latestMin = -Infinity;

            schedule.routes.forEach((r) => {
                if (extractRouteNumber(r.routeNo) === routeNo) {
                    const firstMin = parseTimeToMinutes(r.firstBus);
                    const lastMin = parseTimeToMinutes(r.lastBus);
                    if (firstMin !== null && firstMin < earliestMin) earliestMin = firstMin;
                    if (lastMin !== null && lastMin > latestMin) latestMin = lastMin;
                }
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
export function getRouteOperatingWindow(routeIdOrNo: string, cityCode: string = "32020"): RouteOperatingWindow {
    const routeNo = extractRouteNumber(routeIdOrNo);
    const normalizedCity = cityCode || "32020";
    const cacheKey = `${normalizedCity}:${routeNo}`;

    const cached = windowCache.get(cacheKey);
    if (cached) return cached;

    // 1. Check Night / Autonomous routes first across all cities
    const nightMatch = nightRouteStrategy.resolve(routeNo);
    if (nightMatch) {
        windowCache.set(cacheKey, nightMatch);
        return nightMatch;
    }

    // 2. Delegate to city-specific strategy if registered
    const strategy = cityStrategies[normalizedCity];
    if (strategy) {
        const result = strategy.resolve(routeNo);
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
export function recordRouteBusActivity(routeIdOrNo: string, busCount: number, cityCode: string = "32020"): void {
    const routeNo = extractRouteNumber(routeIdOrNo);
    const normalizedCity = cityCode || "32020";
    if (busCount > 0) {
        const now = Date.now();
        lastActiveBusTimestamp.set(`${normalizedCity}:${routeNo}`, now);
        lastActiveBusTimestamp.set(`${normalizedCity}:${routeIdOrNo}`, now);
    }
}

/**
 * Determines whether a route is currently in its active operating service window.
 */
export function isRouteInServiceWindow(routeIdOrNo: string, now: Date = new Date(), cityCode: string = "32020"): ServiceStatus {
    const routeNo = extractRouteNumber(routeIdOrNo);
    const normalizedCity = cityCode || "32020";
    const window = getRouteOperatingWindow(routeIdOrNo, normalizedCity);
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
