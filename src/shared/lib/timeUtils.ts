import {BusRoute, TimetableEntry} from "@shared/types/bus";
import {LOCALE, UI_TEXT} from "@shared/config/locale";

/**
 * Parses "HH:mm" or "H:mm" to total minutes since 00:00.
 * Returns null if invalid or format is "-".
 */
export function parseTimeToMinutes(timeStr: string | undefined | null): number | null {
    if (!timeStr || timeStr === "-" || timeStr.trim() === "") return null;
    const parts = timeStr.trim().split(":");
    if (parts.length !== 2) return null;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return hours * 60 + minutes;
}

/**
 * Formats total minutes to "HH:mm".
 */
export function formatMinutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Checks if a given date is weekend (Saturday or Sunday).
 */
export function isWeekend(date: Date = new Date()): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
}

export interface DepartureInfo {
    entry: TimetableEntry;
    timeStr: string;
    minutes: number;
    waitMins: number;
}

/**
 * Finds the next upcoming departure and subsequent upcoming departures
 * from a list of timetable entries based on current time.
 */
export function getUpcomingDepartures(timetable: TimetableEntry[], direction: "DEST" | "ORIGIN", currentDate: Date = new Date()): {
    nextDeparture: DepartureInfo | null;
    subsequentDepartures: DepartureInfo[];
    allValidDepartures: TimetableEntry[];
} {
    const currentMins = currentDate.getHours() * 60 + currentDate.getMinutes();

    // Filter valid entries for this direction
    const allValidDepartures = (timetable || []).filter((item) => {
        const raw = direction === "DEST" ? item.destDepTime : item.originDepTime;
        return raw && raw !== "-" && raw.trim() !== "";
    });

    const parsedList: DepartureInfo[] = [];

    for (const item of allValidDepartures) {
        const timeStr = direction === "DEST" ? item.destDepTime : item.originDepTime;
        const mins = parseTimeToMinutes(timeStr);
        if (mins !== null && mins >= currentMins) {
            parsedList.push({
                entry: item,
                timeStr,
                minutes: mins,
                waitMins: mins - currentMins,
            });
        }
    }

    // Sort by minutes ascending
    parsedList.sort((a, b) => a.minutes - b.minutes);

    const nextDeparture = parsedList.length > 0 ? parsedList[0] : null;
    const subsequentDepartures = parsedList.slice(1, 5);

    return {
        nextDeparture,
        subsequentDepartures,
        allValidDepartures,
    };
}

/**
 * Filters the active route variant for a route number (e.g. 30, 34, 34-1)
 * based on the active holiday/weekday mode.
 */
export function selectRouteVariant(routes: BusRoute[], routeNo: string, isHolidayOrVacation: boolean): BusRoute | null {
    const matches = routes.filter((r) => r.routeNo === routeNo);
    if (!matches.length) return null;

    if (routeNo === "30") {
        return matches[0];
    }

    if (isHolidayOrVacation) {
        const vacationMatch = matches.find((r) => r.dayType === "방학,휴일" || r.dayType.includes("방학") || r.dayType.includes("휴일") || r.dayType.includes("토요일") || r.dayType.includes("공휴일") || r.dayType === "매일");
        return vacationMatch || matches[0];
    } else {
        const weekdayMatch = matches.find((r) => r.dayType === "평일" || r.dayType === "매일");
        return weekdayMatch || matches[0];
    }
}

/**
 * Finds the next departures for both origin and destination.
 */
export function getNextDeparture(timetable: TimetableEntry[], currentDate: Date = new Date()): {
    nextOrigin: TimetableEntry | null;
    nextDest: TimetableEntry | null;
    originWaitMins: number | null;
    destWaitMins: number | null;
    soonest: {
        type: "origin" | "dest";
        time: string;
        waitMins: number;
        entry: TimetableEntry;
    } | null;
} {
    const currentMins = currentDate.getHours() * 60 + currentDate.getMinutes();

    let nextOrigin: TimetableEntry | null = null;
    let originWaitMins: number | null = null;

    let nextDest: TimetableEntry | null = null;
    let destWaitMins: number | null = null;

    for (const entry of timetable) {
        const oMins = parseTimeToMinutes(entry.originDepTime);
        if (oMins !== null && oMins >= currentMins && (!nextOrigin || oMins < (parseTimeToMinutes(nextOrigin.originDepTime) || 9999))) {
            nextOrigin = entry;
            originWaitMins = oMins - currentMins;
        }

        const dMins = parseTimeToMinutes(entry.destDepTime);
        if (dMins !== null && dMins >= currentMins && (!nextDest || dMins < (parseTimeToMinutes(nextDest.destDepTime) || 9999))) {
            nextDest = entry;
            destWaitMins = dMins - currentMins;
        }
    }

    let soonest = null;
    if (originWaitMins !== null && (destWaitMins === null || originWaitMins <= destWaitMins)) {
        if (nextOrigin) {
            soonest = {
                type: "origin" as const,
                time: nextOrigin.originDepTime,
                waitMins: originWaitMins,
                entry: nextOrigin,
            };
        }
    } else if (destWaitMins !== null) {
        if (nextDest) {
            soonest = {
                type: "dest" as const,
                time: nextDest.destDepTime,
                waitMins: destWaitMins,
                entry: nextDest,
            };
        }
    }

    return {nextOrigin, nextDest, originWaitMins, destWaitMins, soonest};
}

/**
 * Calculates remaining 24-hour cooldown time and formatted string.
 */
export function formatCooldownRemaining(updatedAt: string | null | undefined, cooldownHours = 24): {
    isReady: boolean;
    remainingMs: number;
    text: string;
    nextAvailableDate: Date | null;
} {
    if (!updatedAt) {
        return {
            isReady: true,
            remainingMs: 0,
            text: UI_TEXT.TIME.REFRESH_AVAILABLE_NOW,
            nextAvailableDate: null,
        };
    }

    const lastMs = new Date(updatedAt).getTime();
    if (isNaN(lastMs)) {
        return {
            isReady: true,
            remainingMs: 0,
            text: UI_TEXT.TIME.REFRESH_AVAILABLE_NOW,
            nextAvailableDate: null,
        };
    }

    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    const nextMs = lastMs + cooldownMs;
    const nowMs = Date.now();
    const diffMs = nextMs - nowMs;

    if (diffMs <= 0) {
        return {
            isReady: true,
            remainingMs: 0,
            text: UI_TEXT.TIME.REFRESH_AVAILABLE_NOW,
            nextAvailableDate: new Date(nextMs),
        };
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let text: string;
    if (hours > 0) {
        text = UI_TEXT.TIME.REFRESH_AVAILABLE_HOURS(hours, mins);
    } else {
        text = UI_TEXT.TIME.REFRESH_AVAILABLE_MINS(mins);
    }

    return {
        isReady: false,
        remainingMs: diffMs,
        text,
        nextAvailableDate: new Date(nextMs),
    };
}

/**
 * Formats ISO timestamp to human-friendly relative time.
 */
export function formatRelativeTime(isoString: string): string {
    const timestamp = new Date(isoString).getTime();
    if (isNaN(timestamp)) return "";

    const diffSec = Math.floor((Date.now() - timestamp) / 1000);

    if (diffSec < 60) {
        return UI_TEXT.TIME.JUST_NOW;
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
        return UI_TEXT.TIME.MINUTES_AGO(diffMin);
    }
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) {
        return UI_TEXT.TIME.HOURS_AGO(diffHours);
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
        return UI_TEXT.TIME.DAYS_AGO(diffDays);
    }
    return new Date(timestamp).toLocaleDateString(LOCALE, {
        month: "numeric",
        day: "numeric",
    });
}

/**
 * Formats remaining time until target timestamp string.
 */
export function formatRemainingTime(targetDateStr: string | null): string {
    if (!targetDateStr) return "";
    const targetMs = new Date(targetDateStr).getTime();
    if (isNaN(targetMs)) return "";

    const diffMs = targetMs - Date.now();
    if (diffMs <= 0) return UI_TEXT.TIME.REFRESH_AVAILABLE_NOW;

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
        return UI_TEXT.TIME.REFRESH_AVAILABLE_DAYS(days, hours);
    }
    if (hours > 0) {
        return UI_TEXT.TIME.REFRESH_AVAILABLE_HOURS(hours, mins);
    }
    return UI_TEXT.TIME.REFRESH_AVAILABLE_MINS(mins);
}
