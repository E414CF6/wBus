import {parseTimeToMinutes} from "@shared/lib/timeUtils";
import type {BusRoute} from "@shared/types/bus";
import {useMemo} from "react";
import type {HourlyRow, MinuteItem, SelectedFootnoteInfo} from "../types";
import {getFootnoteSymbol} from "../utils/footnoteUtils";

interface UseYonseiRouteDetailOptions {
    route: BusRoute | null;
    allYonseiRoutes?: BusRoute[];
    tableSearch: string;
    now: Date;
    selectedFootnote: number | null;
}

export function useYonseiRouteDetail({
                                         route,
                                         allYonseiRoutes,
                                         tableSearch,
                                         now,
                                         selectedFootnote,
                                     }: UseYonseiRouteDetailOptions) {
    const currentHourStr = useMemo(() => {
        return String(now.getHours()).padStart(2, "0");
    }, [now]);

    // Resolve Weekday & Vacation route variants for dual-column view
    const {weekdayRoute, vacationRoute} = useMemo(() => {
        if (!route) return {weekdayRoute: null, vacationRoute: null};
        if (!allYonseiRoutes || !allYonseiRoutes.length) {
            return {weekdayRoute: route, vacationRoute: route};
        }

        const matches = allYonseiRoutes.filter((r) => r.routeNo === route.routeNo);
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
    }, [route, allYonseiRoutes]);

    // Build Footnote Index Map (unique notes mapped to numbered index)
    const footnoteMap = useMemo(() => {
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
    }, [weekdayRoute, vacationRoute]);

    // Group departure times into Dual Hourly Columns (Hour | Weekday Minutes | Vacation Minutes)
    const dualHourlyTimetable: HourlyRow[] = useMemo(() => {
        if (!route || !weekdayRoute || !vacationRoute) return [];

        const currentMins = now.getHours() * 60 + now.getMinutes();

        const getValidEntries = (r: BusRoute) => {
            return (r.timetable || []).filter(
                (item) => item.destDepTime && item.destDepTime !== "-" && item.destDepTime !== ""
            );
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

        // Identify next bus sequence for Weekday schedule
        let nextWeekdaySeq = -1;
        for (const item of filteredW) {
            const mins = parseTimeToMinutes(item.destDepTime);
            if (mins !== null && mins >= currentMins) {
                nextWeekdaySeq = item.seq;
                break;
            }
        }

        // Identify next bus sequence for Vacation/Holiday schedule
        let nextVacationSeq = -1;
        for (const item of filteredV) {
            const mins = parseTimeToMinutes(item.destDepTime);
            if (mins !== null && mins >= currentMins) {
                nextVacationSeq = item.seq;
                break;
            }
        }

        const sortedHours = Array.from(hourMap.keys()).sort(
            (a, b) => parseInt(a, 10) - parseInt(b, 10)
        );

        return sortedHours.map((hourStr) => {
            const data = hourMap.get(hourStr)!;
            const isCurrentHour = hourStr === currentHourStr;

            return {
                hourStr,
                displayHour: String(parseInt(hourStr, 10)),
                isCurrentHour,
                weekdayMinutes: data.weekdayMinutes.map((m) => ({
                    ...m,
                    isNextBus: m.seq === nextWeekdaySeq,
                })),
                vacationMinutes: data.vacationMinutes.map((m) => ({
                    ...m,
                    isNextBus: m.seq === nextVacationSeq,
                })),
            };
        });
    }, [route, weekdayRoute, vacationRoute, tableSearch, now, footnoteMap, currentHourStr]);

    // Check if weekday and vacation schedules are identical (e.g. route 30)
    const isSingleSchedule = useMemo(() => {
        if (!route) return false;
        if (route.routeNo === "30") return true;
        if (!weekdayRoute || !vacationRoute) return true;
        return weekdayRoute.id === vacationRoute.id;
    }, [route, weekdayRoute, vacationRoute]);

    // Calculate occurrences of each footnote number in the current route
    const footnoteCounts = useMemo(() => {
        const counts = new Map<number, number>();
        for (const hourRow of dualHourlyTimetable) {
            for (const item of hourRow.weekdayMinutes) {
                if (item.footnoteNumber) {
                    counts.set(item.footnoteNumber, (counts.get(item.footnoteNumber) || 0) + 1);
                }
            }
            if (!isSingleSchedule) {
                for (const item of hourRow.vacationMinutes) {
                    if (item.footnoteNumber) {
                        counts.set(item.footnoteNumber, (counts.get(item.footnoteNumber) || 0) + 1);
                    }
                }
            }
        }
        return counts;
    }, [dualHourlyTimetable, isSingleSchedule]);

    // Active selected footnote details
    const selectedFootnoteInfo: SelectedFootnoteInfo | null = useMemo(() => {
        if (!selectedFootnote) return null;
        for (const [noteText, num] of footnoteMap.entries()) {
            if (num === selectedFootnote) {
                return {
                    num,
                    symbol: getFootnoteSymbol(num),
                    noteText,
                    count: footnoteCounts.get(num) || 0,
                };
            }
        }
        return null;
    }, [selectedFootnote, footnoteMap, footnoteCounts]);

    return {
        currentHourStr,
        weekdayRoute,
        vacationRoute,
        footnoteMap,
        dualHourlyTimetable,
        isSingleSchedule,
        footnoteCounts,
        selectedFootnoteInfo,
    };
}
