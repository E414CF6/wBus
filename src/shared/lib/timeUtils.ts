import {TimetableEntry} from "@shared/types/bus";
import {UI_TEXT} from "@shared/config/locale";

export function parseTimeToMinutes(timeStr: string): number | null {
    if (!timeStr || timeStr === "-") return null;
    const parts = timeStr.trim().split(":");
    if (parts.length !== 2) return null;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return hours * 60 + minutes;
}

export function formatMinutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

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
