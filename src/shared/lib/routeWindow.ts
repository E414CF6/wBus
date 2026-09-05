import {YONSEI_STATIC_TIMETABLES} from "@/data/yonseiStaticTimetables";
import fs from "fs";
import path from "path";

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

/**
 * Parse time string ("06:00", "6:30", "22:45") to minutes since midnight (0~1439).
 */
export function parseTimeToMinutes(timeStr?: string | null): number | null {
    if (!timeStr || typeof timeStr !== "string") return null;
    const clean = timeStr.trim();
    if (!clean || clean === "-" || clean.includes("통학")) return null;

    const parts = clean.split(":");
    if (parts.length < 2) return null;

    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);

    if (isNaN(hours) || isNaN(minutes)) return null;
    return hours * 60 + minutes;
}

/**
 * Get current time in Korea Standard Time (UTC+9) in minutes since midnight.
 */
export function getCurrentKstMinutes(date: Date = new Date()): number {
    const utcMs = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
    const kstDate = new Date(utcMs + 9 * 60 * 60 * 1000);
    return kstDate.getHours() * 60 + kstDate.getMinutes();
}

/**
 * Format minutes since midnight to "HH:MM"
 */
export function formatMinutesToTime(minutes: number): string {
    const normalized = (minutes % 1440 + 1440) % 1440;
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

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
    try {
        const localPath = path.join(process.cwd(), "public", "data", "schedule.json");
        if (fs.existsSync(localPath)) {
            const raw = fs.readFileSync(localPath, "utf-8");
            cachedScheduleJson = JSON.parse(raw);
            return cachedScheduleJson;
        }
    } catch {
        // Fallback gracefully in constrained environments
    }
    return null;
}

/**
 * Compute the operating service window for a given route.
 */
export function getRouteOperatingWindow(routeIdOrNo: string): RouteOperatingWindow {
    const routeNo = extractRouteNumber(routeIdOrNo);
    const cacheKey = routeNo;

    const cached = windowCache.get(cacheKey);
    if (cached) return cached;

    // 1. Check Yonsei Static Timetables (30, 34, 34-1)
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
            const startMinutes = Math.max(0, earliestMin - PRE_DEPARTURE_BUFFER_MINUTES);
            const endMinutes = latestMin + POST_DEPARTURE_BUFFER_MINUTES;

            const window: RouteOperatingWindow = {
                routeNo,
                firstBus: formatMinutesToTime(earliestMin),
                lastBus: formatMinutesToTime(latestMin),
                startMinutes,
                endMinutes,
                source: "yonsei_static",
            };
            windowCache.set(cacheKey, window);
            return window;
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
            const startMinutes = Math.max(0, earliestMin - PRE_DEPARTURE_BUFFER_MINUTES);
            const endMinutes = latestMin + POST_DEPARTURE_BUFFER_MINUTES;

            const window: RouteOperatingWindow = {
                routeNo,
                firstBus: formatMinutesToTime(earliestMin),
                lastBus: formatMinutesToTime(latestMin),
                startMinutes,
                endMinutes,
                source: "schedule_json",
            };
            windowCache.set(cacheKey, window);
            return window;
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
export function recordRouteBusActivity(routeIdOrNo: string, busCount: number): void {
    const routeNo = extractRouteNumber(routeIdOrNo);
    if (busCount > 0) {
        lastActiveBusTimestamp.set(routeNo, Date.now());
        lastActiveBusTimestamp.set(routeIdOrNo, Date.now());
    }
}

/**
 * Determines whether a route is currently in its active operating service window.
 */
export function isRouteInServiceWindow(routeIdOrNo: string, now: Date = new Date()): ServiceStatus {
    const routeNo = extractRouteNumber(routeIdOrNo);
    const window = getRouteOperatingWindow(routeIdOrNo);
    const currentKst = getCurrentKstMinutes(now);

    // 1. Check dynamic activity override (a bus was recently seen running within last 15 min)
    const lastActive = lastActiveBusTimestamp.get(routeNo) || lastActiveBusTimestamp.get(routeIdOrNo);
    if (lastActive && Date.now() - lastActive < ACTIVITY_HOLD_MS) {
        return {
            inService: true, reason: "activity_override", window, currentKstMinutes: currentKst, retryAfterSeconds: 4,
        };
    }

    // 2. Check time window bounds
    const {startMinutes, endMinutes} = window;
    let inService = false;

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
