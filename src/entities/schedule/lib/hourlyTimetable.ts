import {parseTimeToMinutes} from "@shared/lib/timeUtils";
import type {BusRoute} from "../types";

export interface MinuteItem {
    seq: number;
    destDepTime: string;
    minuteStr: string;
    type: string;
    notes: string;
    footnoteSymbol?: string;
    footnoteNumber?: number;
    isNextBus: boolean;
}

export interface HourlyRow {
    hourStr: string;
    displayHour: string;
    isCurrentHour: boolean;
    weekdayMinutes: MinuteItem[];
    vacationMinutes: MinuteItem[];
}

export interface SelectedFootnoteInfo {
    num: number;
    symbol: string;
    noteText: string;
    count: number;
}

export const CIRCLED_NUMBERS = [
    "\u2460",
    "\u2461",
    "\u2462",
    "\u2463",
    "\u2464",
    "\u2465",
    "\u2466",
    "\u2467",
    "\u2468",
    "\u2469",
];

export const getFootnoteSymbol = (num: number): string => {
    if (num >= 1 && num <= 10) return CIRCLED_NUMBERS[num - 1];
    return `[${num}]`;
};

export function buildFootnoteMap(
    weekdayRoute: BusRoute | null,
    vacationRoute: BusRoute | null
): Map<string, number> {
    if (!weekdayRoute && !vacationRoute) return new Map<string, number>();

    const notesSet = new Set<string>();
    const extractNotes = (r: BusRoute | null) => {
        if (!r || !r.timetable) return;
        for (const item of r.timetable) {
            if (item.notes && item.notes.trim()) {
                notesSet.add(item.notes.trim());
            }
        }
    };

    extractNotes(weekdayRoute);
    extractNotes(vacationRoute);

    const map = new Map<string, number>();
    let counter = 1;
    for (const note of Array.from(notesSet)) {
        map.set(note, counter++);
    }
    return map;
}

export function resolveWeekdayAndVacationRoutes(
    route: BusRoute | null,
    allRoutes?: BusRoute[]
): { weekdayRoute: BusRoute | null; vacationRoute: BusRoute | null } {
    if (!route) return {weekdayRoute: null, vacationRoute: null};
    if (!allRoutes || !allRoutes.length) {
        return {weekdayRoute: route, vacationRoute: route};
    }

    const matches = allRoutes.filter((r) => r.routeNo === route.routeNo);
    if (!matches.length) return {weekdayRoute: route, vacationRoute: route};

    const wRoute =
        matches.find((r) => r.dayType === "평일" || r.dayType === "매일") || matches[0];
    const vRoute =
        matches.find(
            (r) =>
                r.dayType === "방학,휴일" ||
                r.dayType.includes("방학") ||
                r.dayType.includes("휴일") ||
                r.dayType.includes("토요일") ||
                r.dayType.includes("공휴일") ||
                r.dayType === "매일"
        ) || matches[0];

    return {weekdayRoute: wRoute, vacationRoute: vRoute};
}

export function computeDualHourlyTimetable({
    route,
    weekdayRoute,
    vacationRoute,
    tableSearch,
    now,
    footnoteMap,
    currentHourStr,
}: {
    route: BusRoute | null;
    weekdayRoute: BusRoute | null;
    vacationRoute: BusRoute | null;
    tableSearch: string;
    now: Date;
    footnoteMap: Map<string, number>;
    currentHourStr: string;
}): HourlyRow[] {
    if (!route || !weekdayRoute || !vacationRoute) return [];

    const currentMins = now.getHours() * 60 + now.getMinutes();

    const getValidEntries = (r: BusRoute) => {
        return (r.timetable || [])
            .filter(
                (item) =>
                    item.destDepTime &&
                    item.destDepTime !== "-" &&
                    item.destDepTime !== ""
            )
            .slice()
            .sort((a, b) => {
                const aMins = parseTimeToMinutes(a.destDepTime) ?? 9999;
                const bMins = parseTimeToMinutes(b.destDepTime) ?? 9999;
                if (aMins !== bMins) return aMins - bMins;
                return a.seq - b.seq;
            });
    };

    const wEntries = getValidEntries(weekdayRoute);
    const vEntries = getValidEntries(vacationRoute);

    const filterBySearch = (entries: typeof wEntries) => {
        if (!tableSearch) return entries;
        const q = tableSearch.toLowerCase();
        return entries.filter(
            (item) =>
                item.destDepTime.includes(q) ||
                (item.type && item.type.toLowerCase().includes(q)) ||
                (item.notes && item.notes.toLowerCase().includes(q))
        );
    };

    const filteredW = filterBySearch(wEntries);
    const filteredV = filterBySearch(vEntries);

    const hourMap = new Map<
        string,
        {
            weekdayMinutes: MinuteItem[];
            vacationMinutes: MinuteItem[];
        }
    >();

    const addEntriesToMap = (entries: typeof wEntries, isVacation: boolean) => {
        for (const item of entries) {
            const parts = item.destDepTime.trim().split(":");
            if (parts.length < 2) continue;

            const hourStr = parts[0].padStart(2, "0");
            const minuteStr = parts[1].padStart(2, "0");

            if (!hourMap.has(hourStr)) {
                hourMap.set(hourStr, {weekdayMinutes: [], vacationMinutes: []});
            }

            const noteTrimmed = (item.notes || "").trim();
            const fnNum = noteTrimmed ? footnoteMap.get(noteTrimmed) : undefined;
            const fnSymbol = fnNum ? getFootnoteSymbol(fnNum) : undefined;

            const minuteItem: MinuteItem = {
                seq: item.seq,
                destDepTime: item.destDepTime,
                minuteStr,
                type: item.type || "",
                notes: noteTrimmed,
                footnoteSymbol: fnSymbol,
                footnoteNumber: fnNum,
                isNextBus: false,
            };

            if (isVacation) {
                hourMap.get(hourStr)!.vacationMinutes.push(minuteItem);
            } else {
                hourMap.get(hourStr)!.weekdayMinutes.push(minuteItem);
            }
        }
    };

    addEntriesToMap(filteredW, false);
    addEntriesToMap(filteredV, true);

    let nextWeekdaySeq = -1;
    let minWeekdayMins = Infinity;
    for (const item of wEntries) {
        const mins = parseTimeToMinutes(item.destDepTime);
        if (mins !== null && mins >= currentMins && mins < minWeekdayMins) {
            minWeekdayMins = mins;
            nextWeekdaySeq = item.seq;
        }
    }

    let nextVacationSeq = -1;
    let minVacationMins = Infinity;
    for (const item of vEntries) {
        const mins = parseTimeToMinutes(item.destDepTime);
        if (mins !== null && mins >= currentMins && mins < minVacationMins) {
            minVacationMins = mins;
            nextVacationSeq = item.seq;
        }
    }

    const sortedHours = Array.from(hourMap.keys()).sort(
        (a, b) => parseInt(a, 10) - parseInt(b, 10)
    );

    const sortMinutes = (a: MinuteItem, b: MinuteItem) => {
        const aM = parseInt(a.minuteStr, 10);
        const bM = parseInt(b.minuteStr, 10);
        if (aM !== bM) return aM - bM;
        return a.seq - b.seq;
    };

    return sortedHours.map((hourStr) => {
        const data = hourMap.get(hourStr)!;
        const isCurrentHour = hourStr === currentHourStr;

        return {
            hourStr,
            displayHour: String(parseInt(hourStr, 10)),
            isCurrentHour,
            weekdayMinutes: data.weekdayMinutes
                .slice()
                .sort(sortMinutes)
                .map((m) => ({
                    ...m,
                    isNextBus: m.seq === nextWeekdaySeq,
                })),
            vacationMinutes: data.vacationMinutes
                .slice()
                .sort(sortMinutes)
                .map((m) => ({
                    ...m,
                    isNextBus: m.seq === nextVacationSeq,
                })),
        };
    });
}
