import type {BusRoute, TimetableEntry} from "../types";
import {parseTimeToMinutes} from "@shared/lib/timeUtils";

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
export function getUpcomingDepartures(
    timetable: TimetableEntry[],
    direction: "DEST" | "ORIGIN",
    currentDate: Date = new Date()
): {
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
export function selectRouteVariant(
    routes: BusRoute[],
    routeNo: string,
    isHolidayOrVacation: boolean
): BusRoute | null {
    const matches = routes.filter((r) => r.routeNo === routeNo);
    if (!matches.length) return null;

    if (routeNo === "30") {
        return matches[0];
    }

    if (isHolidayOrVacation) {
        const vacationMatch = matches.find(
            (r) =>
                r.dayType === "방학,휴일" ||
                r.dayType.includes("방학") ||
                r.dayType.includes("휴일") ||
                r.dayType.includes("토요일") ||
                r.dayType.includes("공휴일") ||
                r.dayType === "매일"
        );
        return vacationMatch || matches[0];
    } else {
        const weekdayMatch = matches.find((r) => r.dayType === "평일" || r.dayType === "매일");
        return weekdayMatch || matches[0];
    }
}

/**
 * Finds the next departures for both origin and destination.
 */
export function getNextDeparture(
    timetable: TimetableEntry[],
    currentDate: Date = new Date()
): {
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
        if (
            oMins !== null &&
            oMins >= currentMins &&
            (!nextOrigin || oMins < (parseTimeToMinutes(nextOrigin.originDepTime) || 9999))
        ) {
            nextOrigin = entry;
            originWaitMins = oMins - currentMins;
        }

        const dMins = parseTimeToMinutes(entry.destDepTime);
        if (
            dMins !== null &&
            dMins >= currentMins &&
            (!nextDest || dMins < (parseTimeToMinutes(nextDest.destDepTime) || 9999))
        ) {
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
