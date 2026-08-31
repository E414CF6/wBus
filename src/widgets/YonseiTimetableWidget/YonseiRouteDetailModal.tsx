"use client";

import React, {useEffect, useMemo, useState} from "react";
import {createPortal} from "react-dom";
import {BusRoute} from "@shared/types/bus";
import {parseTimeToMinutes} from "@shared/lib/timeUtils";
import {UI_TEXT} from "@shared/config/locale";
import {Clock, Info, MapPin, Palmtree, RotateCcw, Search, Sparkles, Sun, X} from "lucide-react";

interface YonseiRouteDetailModalProps {
    route: BusRoute | null;
    allYonseiRoutes?: BusRoute[];
    onClose: () => void;
    isBookmarked?: boolean;
    onToggleBookmark?: (routeId: string) => void;
    onSelectMapRoute?: (routeName: string) => void;
    currentTime?: Date;
}

interface MinuteItem {
    seq: number;
    destDepTime: string;
    minuteStr: string;
    type: string;
    notes: string;
    footnoteSymbol?: string;
    footnoteNumber?: number;
    isNextBus: boolean;
}

const CIRCLED_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

const getFootnoteSymbol = (num: number) => {
    if (num >= 1 && num <= 10) return CIRCLED_NUMBERS[num - 1];
    return `[${num}]`;
};

export const YonseiRouteDetailModal: React.FC<YonseiRouteDetailModalProps> = ({
                                                                                  route,
                                                                                  allYonseiRoutes,
                                                                                  onClose,
                                                                                  isBookmarked: _isBookmarked,
                                                                                  onToggleBookmark: _onToggleBookmark,
                                                                                  onSelectMapRoute,
                                                                                  currentTime,
                                                                              }) => {
    const [mounted, setMounted] = useState(false);
    const [tableSearch, setTableSearch] = useState("");
    const [selectedFootnote, setSelectedFootnote] = useState<number | null>(null);
    const [now, setNow] = useState<Date>(() => currentTime || new Date());

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (currentTime) {
            setNow(currentTime);
        }
    }, [currentTime]);

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 10000);
        return () => clearInterval(timer);
    }, []);

    const currentHourStr = useMemo(() => {
        return String(now.getHours()).padStart(2, "0");
    }, [now]);

    // Key via stops
    const viaStops = useMemo(() => {
        if (!route) return "";
        if (route.routeNo === "30") {
            return UI_TEXT.YONSEI.VIA_30;
        }
        if (route.routeNo === "34") {
            return UI_TEXT.YONSEI.VIA_34;
        }
        if (route.routeNo === "34-1") {
            return UI_TEXT.YONSEI.VIA_34_1;
        }
        return "";
    }, [route]);

    // Resolve Weekday & Vacation route variants for dual-column view
    const {weekdayRoute, vacationRoute} = useMemo(() => {
        if (!route) return {weekdayRoute: null, vacationRoute: null};
        if (!allYonseiRoutes || !allYonseiRoutes.length) {
            return {weekdayRoute: route, vacationRoute: route};
        }

        const matches = allYonseiRoutes.filter((r) => r.routeNo === route.routeNo);
        if (!matches.length) return {weekdayRoute: route, vacationRoute: route};

        const wRoute = matches.find((r) => r.dayType === "평일" || r.dayType === "통상") || matches[0];
        const vRoute = matches.find(
            (r) =>
                r.dayType === "방학,휴일" ||
                r.dayType.includes("방학") ||
                r.dayType.includes("휴일") ||
                r.dayType.includes("토요일") ||
                r.dayType.includes("공휴일") ||
                r.dayType === "통상"
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
    const dualHourlyTimetable = useMemo(() => {
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

        const addEntriesToMap = (
            entries: typeof wEntries,
            isVacation: boolean
        ) => {
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
    const selectedFootnoteInfo = useMemo(() => {
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

    if (!route || !mounted) return null;

    const targetRouteNo = route.routeNo;
    const isHoechon = targetRouteNo === "34-1";
    const locationLabel = isHoechon ? UI_TEXT.YONSEI.LOCATION_HOECHON : UI_TEXT.YONSEI.LOCATION_YONSEI;

    const getRouteBadgeGradient = (no: string) => {
        if (no === "30") return "from-[#003876] to-blue-700 shadow-blue-900/30";
        if (no === "34") return "from-blue-600 to-indigo-600 shadow-blue-500/20";
        if (no === "34-1") return "from-indigo-600 to-purple-600 shadow-indigo-500/20";
        return "from-[#003876] to-blue-700 shadow-blue-900/30";
    };

    // Render individual minute badge with footnote highlight and dimming logic
    const renderMinuteBadge = (item: MinuteItem, isVacationCol = false) => {
        const isFootnoteActive = selectedFootnote !== null;
        const isMatchingFootnote = isFootnoteActive && item.footnoteNumber === selectedFootnote;
        const isDimmed = isFootnoteActive && !isMatchingFootnote;
        const hasFootnote = Boolean(item.footnoteNumber);

        let chipStyle = "";
        if (isMatchingFootnote) {
            chipStyle =
                "bg-amber-400 dark:bg-amber-500 text-slate-950 dark:text-black border-amber-500 dark:border-amber-400 ring-2 ring-amber-400/90 dark:ring-amber-300 shadow-lg scale-105 sm:scale-110 z-10 font-black animate-pulse";
        } else if (isDimmed) {
            chipStyle =
                "opacity-25 dark:opacity-20 hover:opacity-80 transition-opacity bg-slate-100 dark:bg-white/5 text-slate-400 border-slate-200/40 dark:border-white/5";
        } else if (item.isNextBus) {
            chipStyle = isVacationCol
                ? "bg-indigo-600 text-white border-indigo-600 shadow-md scale-105"
                : "bg-blue-600 text-white border-blue-600 shadow-md scale-105";
        } else {
            chipStyle = isVacationCol
                ? "bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 border-indigo-200/60 dark:border-indigo-500/20 hover:border-indigo-400/60"
                : "bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 border-blue-200/60 dark:border-blue-500/20 hover:border-blue-400/60";
        }

        const handleItemClick = () => {
            if (item.footnoteNumber) {
                setSelectedFootnote(
                    selectedFootnote === item.footnoteNumber ? null : item.footnoteNumber
                );
            }
        };

        const tooltip = item.notes
            ? `${item.destDepTime} 출발 (비고: ${item.notes}) - ${
                isMatchingFootnote
                    ? UI_TEXT.YONSEI.FOOTNOTE_TOOLTIP_CLEAR
                    : UI_TEXT.YONSEI.FOOTNOTE_TOOLTIP_ACTIVE
            }`
            : `${item.destDepTime} 출발`;

        return (
            <button
                key={item.seq}
                type="button"
                onClick={handleItemClick}
                title={tooltip}
                className={`inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-xl font-mono text-[11px] sm:text-xs font-bold border transition-all active:scale-95 ${
                    hasFootnote ? "cursor-pointer" : "cursor-default"
                } ${chipStyle}`}
            >
                <span className="font-extrabold">{item.minuteStr}</span>
                {item.isNextBus && (
                    <span
                        className={`text-[8px] sm:text-[9px] px-0.5 sm:px-1 py-0.2 rounded font-sans font-black ${
                            isMatchingFootnote
                                ? "bg-amber-900/30 text-amber-950 dark:text-black"
                                : "bg-white/20 text-white"
                        }`}
                    >
                        {UI_TEXT.YONSEI.NEXT_BUS_BADGE}
                    </span>
                )}
                {item.footnoteSymbol && (
                    <span
                        className={`text-xs font-black font-mono ml-0.5 ${
                            isMatchingFootnote
                                ? "text-amber-950 dark:text-black font-black"
                                : item.isNextBus
                                    ? isVacationCol
                                        ? "text-indigo-200"
                                        : "text-amber-200"
                                    : "text-amber-600 dark:text-amber-400"
                        }`}
                    >
                        {item.footnoteSymbol}
                    </span>
                )}
            </button>
        );
    };

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3.5 sm:p-6 bg-slate-950/60 dark:bg-black/80 backdrop-blur-lg animate-fadeIn pointer-events-auto"
            onClick={onClose}
        >
            <div
                className="w-full max-w-4xl h-[90dvh] sm:h-auto sm:max-h-[90vh] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-[#121620] transition-colors duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="p-4 sm:p-6 border-b border-slate-200/70 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.03] flex items-center justify-between gap-3 sm:gap-4 shrink-0">
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <div
                            className={`px-3.5 sm:px-4 py-1 sm:py-1.5 rounded-2xl bg-gradient-to-r ${getRouteBadgeGradient(
                                targetRouteNo
                            )} font-black text-white text-lg sm:text-xl tracking-tight shadow-md font-mono shrink-0`}
                        >
                            {UI_TEXT.COMMON.ROUTE_LABEL(targetRouteNo)}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
                                <span>{UI_TEXT.YONSEI.TIMETABLE_TITLE(locationLabel)}</span>
                                {isSingleSchedule && (
                                    <span
                                        className="px-1.5 sm:px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-black bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 shrink-0">
                                        {UI_TEXT.YONSEI.SCHEDULE_APPLIED_ALL_DAYS}
                                    </span>
                                )}
                            </h3>
                        </div>
                    </div>

                    <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
                        {onSelectMapRoute && (
                            <button
                                onClick={() => {
                                    onClose();
                                    onSelectMapRoute(targetRouteNo);
                                }}
                                className="flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-md shadow-blue-600/20 transition-all cursor-pointer active:scale-95"
                            >
                                <MapPin className="h-3.5 w-3.5"/>
                                <span className="hidden sm:inline">{UI_TEXT.YONSEI.REALTIME_MAP_BTN}</span>
                                <span className="sm:hidden text-[11px]">{UI_TEXT.YONSEI.MAP_SHORT_BTN}</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer active:scale-95"
                        >
                            <X className="h-4 w-4"/>
                        </button>
                    </div>
                </div>

                {/* Full-width Via Marquee Strip */}
                {viaStops && (
                    <div
                        className="w-full px-3.5 sm:px-6 py-1.5 sm:py-2 bg-slate-100/90 dark:bg-white/[0.03] border-b border-slate-200/70 dark:border-white/10 flex items-center gap-2 sm:gap-2.5 overflow-hidden shrink-0">
                        <span
                            className="px-1.5 sm:px-2 py-0.5 rounded-md bg-blue-600 text-white font-black text-[9px] sm:text-[10px] shrink-0 shadow-2xs">
                            {UI_TEXT.YONSEI.VIA_LABEL}
                        </span>
                        <div
                            className="relative overflow-hidden flex-1 flex items-center h-4 sm:h-4.5 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200">
                            <div className="animate-marquee-fast flex shrink-0 items-center whitespace-nowrap">
                                <span className="mr-10 sm:mr-12">{viaStops}</span>
                                <span className="mr-10 sm:mr-12">{viaStops}</span>
                            </div>
                            <div
                                className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-l from-slate-100/95 dark:from-[#121620] to-transparent z-10"/>
                        </div>
                    </div>
                )}

                {/* Search Bar & Total count */}
                <div
                    className="p-3 sm:p-4 border-b border-slate-200/70 dark:border-white/10 bg-white/50 dark:bg-[#121620]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
                    <div className="relative flex-1">
                        <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input
                            type="text"
                            value={tableSearch}
                            onChange={(e) => setTableSearch(e.target.value)}
                            placeholder={UI_TEXT.YONSEI.SEARCH_MODAL_PLACEHOLDER}
                            className="w-full pl-9 pr-4 py-1.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-transparent focus:border-blue-500/50 text-xs font-semibold text-slate-900 dark:text-white outline-none transition-all"
                        />
                    </div>
                    <div
                        className="text-[11px] sm:text-xs font-extrabold text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-2">
                        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <Clock className="w-3.5 h-3.5"/>
                            <span>{UI_TEXT.YONSEI.CURRENT_HOUR_STR(currentHourStr)}</span>
                        </span>
                        <span>·</span>
                        <span>{UI_TEXT.YONSEI.HOURS_DISPLAYED(dualHourlyTimetable.length)}</span>
                    </div>
                </div>

                {/* Active Footnote Highlight Filter Banner */}
                {selectedFootnoteInfo && (
                    <div
                        className="px-3.5 sm:px-6 py-2 bg-amber-500/15 dark:bg-amber-500/20 border-b border-amber-400/40 dark:border-amber-500/30 flex items-center justify-between gap-2 shrink-0 animate-fadeIn">
                        <div
                            className="flex items-center gap-2 min-w-0 text-xs font-bold text-amber-950 dark:text-amber-200 truncate">
                            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0"/>
                            <span className="truncate">
                                <span className="font-mono font-black mr-1 text-amber-700 dark:text-amber-300">
                                    {selectedFootnoteInfo.symbol}
                                </span>
                                &quot;{selectedFootnoteInfo.noteText}&quot; 각주 적용 시간표 강조 중
                            </span>
                            <span
                                className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-900 dark:text-amber-300 text-[10px] font-black shrink-0">
                                {UI_TEXT.YONSEI.FOOTNOTE_COUNT_SUFFIX(selectedFootnoteInfo.count)}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedFootnote(null)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 text-[11px] font-black transition-all cursor-pointer shrink-0 active:scale-95"
                        >
                            <RotateCcw className="w-3 h-3"/>
                            <span>{UI_TEXT.YONSEI.FOOTNOTE_CLEAR}</span>
                        </button>
                    </div>
                )}

                {/* Timetable Table Header */}
                <div
                    className="sticky top-0 z-10 bg-slate-100/95 dark:bg-[#181d2a]/95 backdrop-blur-md px-4 py-3 border-b border-slate-200/80 dark:border-white/10 grid grid-cols-12 gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    <div
                        className="col-span-3 sm:col-span-2 text-center border-r border-slate-200/80 dark:border-white/10 pr-2">
                        {UI_TEXT.YONSEI.HOUR_LABEL}
                    </div>

                    {isSingleSchedule ? (
                        /* Single Column Header for Route 30 */
                        <div
                            className="col-span-9 sm:col-span-10 flex items-center justify-center gap-1.5 text-blue-600 dark:text-blue-400">
                            <Sun className="w-3.5 h-3.5 text-amber-500"/>
                            <span>{UI_TEXT.YONSEI.SINGLE_COLUMN_TITLE}</span>
                        </div>
                    ) : (
                        /* Dual Columns Header for Routes 34, 34-1 */
                        <>
                            <div
                                className="col-span-4 sm:col-span-5 flex items-center justify-center gap-1.5 text-blue-600 dark:text-blue-400 border-r border-slate-200/80 dark:border-white/10 pr-2">
                                <Sun className="w-3.5 h-3.5 text-amber-500"/>
                                <span>{UI_TEXT.YONSEI.WEEKDAY_COLUMN}</span>
                            </div>
                            <div
                                className="col-span-5 flex items-center justify-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                                <Palmtree className="w-3.5 h-3.5 text-emerald-500"/>
                                <span>{UI_TEXT.YONSEI.VACATION_COLUMN}</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Timetable Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {dualHourlyTimetable.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 dark:text-slate-500 font-sans text-xs">
                            {UI_TEXT.YONSEI.NO_TIMES_MATCH}
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                            {dualHourlyTimetable.map(({
                                                          hourStr,
                                                          displayHour,
                                                          isCurrentHour,
                                                          weekdayMinutes,
                                                          vacationMinutes
                                                      }) => (
                                <div
                                    key={hourStr}
                                    className={`grid grid-cols-12 gap-2 p-3 sm:p-4 transition-colors items-center text-xs ${
                                        isCurrentHour
                                            ? "bg-blue-500/[0.08] dark:bg-blue-500/[0.14] border-l-4 border-l-blue-600 font-semibold"
                                            : "hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                                    }`}
                                >
                                    {/* Hour Column */}
                                    <div
                                        className="col-span-3 sm:col-span-2 text-center border-r border-slate-200/80 dark:border-white/10 pr-2 flex flex-col items-center justify-center">
                                        <div className="flex items-baseline gap-0.5">
                                            <span
                                                className={`text-lg sm:text-2xl font-black font-mono ${
                                                    isCurrentHour
                                                        ? "text-blue-600 dark:text-blue-400"
                                                        : "text-slate-900 dark:text-white"
                                                }`}
                                            >
                                                {displayHour}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                                {UI_TEXT.YONSEI.HOUR_SUFFIX}
                                            </span>
                                        </div>
                                        {isCurrentHour && (
                                            <span
                                                className="mt-0.5 px-1.5 py-0.2 rounded-md bg-blue-600 text-white text-[9px] font-extrabold">
                                                {UI_TEXT.YONSEI.CURRENT_HOUR_BADGE}
                                            </span>
                                        )}
                                    </div>

                                    {isSingleSchedule ? (
                                        /* Single Column Body for Route 30 */
                                        <div className="col-span-9 sm:col-span-10 pl-2">
                                            {weekdayMinutes.length === 0 ? (
                                                <span
                                                    className="text-slate-300 dark:text-slate-600 italic text-[11px]">-</span>
                                            ) : (
                                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                                    {weekdayMinutes.map((item) => renderMinuteBadge(item, false))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* Dual Column Body for Routes 34, 34-1 */
                                        <>
                                            {/* Weekday Minutes Column */}
                                            <div
                                                className="col-span-4 sm:col-span-5 border-r border-slate-200/80 dark:border-white/10 pr-1.5 sm:pr-2">
                                                {weekdayMinutes.length === 0 ? (
                                                    <span
                                                        className="text-slate-300 dark:text-slate-600 italic text-[11px]">-</span>
                                                ) : (
                                                    <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                                                        {weekdayMinutes.map((item) => renderMinuteBadge(item, false))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Vacation Minutes Column */}
                                            <div className="col-span-5 pl-1.5 sm:pl-2">
                                                {vacationMinutes.length === 0 ? (
                                                    <span
                                                        className="text-slate-300 dark:text-slate-600 italic text-[11px]">-</span>
                                                ) : (
                                                    <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                                                        {vacationMinutes.map((item) => renderMinuteBadge(item, true))}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footnote Strip Box */}
                {footnoteMap.size > 0 && (
                    <div
                        className="p-3 sm:p-4 bg-slate-100/90 dark:bg-white/[0.04] border-t border-slate-200/80 dark:border-white/10 text-xs shrink-0">
                        <div
                            className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
                            <div
                                className="flex items-center gap-1.5 font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                                <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"/>
                                <span>{UI_TEXT.YONSEI.FOOTNOTE_TITLE}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedFootnote !== null && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedFootnote(null)}
                                        className="text-[10px] sm:text-[11px] font-black text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                                    >
                                        {UI_TEXT.YONSEI.FOOTNOTE_CLEAR}
                                    </button>
                                )}
                                <span
                                    className="text-[10px] sm:text-[11px] font-semibold text-slate-400 dark:text-slate-400">
                                    {UI_TEXT.YONSEI.FOOTNOTE_SCROLL_HINT} →
                                </span>
                            </div>
                        </div>

                        {/* Single-row Horizontal Scroll Strip */}
                        <div
                            className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-1 scroll-smooth touch-pan-x overscroll-x-contain">
                            {Array.from(footnoteMap.entries()).map(([noteText, num]) => {
                                const isHighlighted = selectedFootnote === num;
                                const count = footnoteCounts.get(num) || 0;

                                return (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => setSelectedFootnote(isHighlighted ? null : num)}
                                        title={
                                            isHighlighted
                                                ? UI_TEXT.YONSEI.FOOTNOTE_TOOLTIP_CLEAR
                                                : UI_TEXT.YONSEI.FOOTNOTE_TOOLTIP_ACTIVE
                                        }
                                        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border shrink-0 transition-all cursor-pointer select-none active:scale-95 ${
                                            isHighlighted
                                                ? "bg-amber-100 dark:bg-amber-950/80 border-amber-500 dark:border-amber-400 text-amber-950 dark:text-amber-100 shadow-md ring-2 ring-amber-400"
                                                : "bg-white dark:bg-[#181d2a] border-slate-200/80 dark:border-white/10 hover:border-blue-400/60 text-slate-700 dark:text-slate-200"
                                        }`}
                                    >
                                        <span
                                            className="font-black text-amber-600 dark:text-amber-400 text-xs sm:text-sm shrink-0 font-mono">
                                            {getFootnoteSymbol(num)}
                                        </span>
                                        <span
                                            className="font-bold text-[11px] sm:text-xs whitespace-nowrap">
                                            {noteText}
                                        </span>
                                        {count > 0 && (
                                            <span
                                                className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                                                    isHighlighted
                                                        ? "bg-amber-500/20 text-amber-900 dark:text-amber-200"
                                                        : "bg-slate-100 dark:bg-white/5 text-slate-400"
                                                }`}
                                            >
                                                {UI_TEXT.YONSEI.FOOTNOTE_COUNT_SUFFIX(count)}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
