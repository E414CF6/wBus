"use client";

import React, {useEffect, useMemo, useState} from "react";
import {createPortal} from "react-dom";
import {BusRoute} from "@shared/types/bus";
import {parseTimeToMinutes} from "@shared/lib/timeUtils";
import {UI_TEXT} from "@shared/config/locale";
import {Info, MapPin, Palmtree, Search, Sun, X} from "lucide-react";

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
            return {
                hourStr,
                displayHour: String(parseInt(hourStr, 10)),
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
    }, [route, weekdayRoute, vacationRoute, tableSearch, now, footnoteMap]);

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

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 dark:bg-black/80 backdrop-blur-lg animate-fadeIn pointer-events-auto"
            onClick={onClose}
        >
            <div
                className="w-full max-w-4xl max-h-[92vh] rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-[#121212] transition-colors duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="p-5 sm:p-6 border-b border-black/5 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center space-x-3 mb-2">
                            <div
                                className={`px-4 py-1.5 rounded-2xl bg-gradient-to-r ${getRouteBadgeGradient(
                                    targetRouteNo
                                )} font-black text-white text-xl tracking-tight shadow-md`}
                            >
                                {targetRouteNo}번
                            </div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <span>{UI_TEXT.YONSEI.TIMETABLE_TITLE(locationLabel)}</span>
                            </h3>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        {onSelectMapRoute && (
                            <button
                                onClick={() => {
                                    onClose();
                                    onSelectMapRoute(targetRouteNo);
                                }}
                                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-md shadow-blue-600/20 transition-all cursor-pointer active:scale-95"
                            >
                                <MapPin className="h-3.5 w-3.5"/>
                                <span className="hidden sm:inline">{UI_TEXT.YONSEI.REALTIME_MAP_BTN}</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                        >
                            <X className="h-4 w-4"/>
                        </button>
                    </div>
                </div>

                {/* Search Bar & Total count */}
                <div
                    className="p-4 border-b border-black/5 dark:border-white/10 bg-white/50 dark:bg-[#121212]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                        <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input
                            type="text"
                            value={tableSearch}
                            onChange={(e) => setTableSearch(e.target.value)}
                            placeholder={UI_TEXT.YONSEI.SEARCH_MODAL_PLACEHOLDER}
                            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-transparent focus:border-blue-500/50 text-xs font-semibold text-slate-900 dark:text-white outline-none transition-all"
                        />
                    </div>
                    <div className="text-xs font-extrabold text-slate-500 dark:text-slate-400 shrink-0">
                        {UI_TEXT.YONSEI.HOURS_DISPLAYED(dualHourlyTimetable.length)}
                    </div>
                </div>

                {/* Dual Column Timetable Table Header */}
                <div
                    className="sticky top-0 z-10 bg-slate-100 dark:bg-[#1a1a1a] px-4 py-3 border-b border-black/10 dark:border-white/10 grid grid-cols-12 gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    <div className="col-span-2 text-center border-r border-black/10 dark:border-white/10 pr-2">
                        {UI_TEXT.YONSEI.HOUR_LABEL}
                    </div>
                    <div
                        className="col-span-5 flex items-center justify-center gap-1.5 text-blue-600 dark:text-blue-400 border-r border-black/10 dark:border-white/10 pr-2">
                        <Sun className="w-3.5 h-3.5 text-amber-500"/>
                        <span>{UI_TEXT.YONSEI.WEEKDAY_COLUMN}</span>
                    </div>
                    <div
                        className="col-span-5 flex items-center justify-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                        <Palmtree className="w-3.5 h-3.5 text-emerald-500"/>
                        <span>{UI_TEXT.YONSEI.VACATION_COLUMN}</span>
                    </div>
                </div>

                {/* Dual Column Timetable Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {dualHourlyTimetable.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 dark:text-slate-500 font-sans text-xs">
                            {UI_TEXT.YONSEI.NO_TIMES_MATCH}
                        </div>
                    ) : (
                        <div className="divide-y divide-black/5 dark:divide-white/10">
                            {dualHourlyTimetable.map(({hourStr, displayHour, weekdayMinutes, vacationMinutes}) => (
                                <div
                                    key={hourStr}
                                    className="grid grid-cols-12 gap-2 p-3 sm:p-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors items-center text-xs"
                                >
                                    {/* Hour Column */}
                                    <div
                                        className="col-span-2 text-center border-r border-black/10 dark:border-white/10 pr-2 flex items-baseline justify-center gap-0.5">
                                        <span
                                            className="text-base sm:text-xl font-black font-mono text-slate-900 dark:text-white">
                                            {displayHour}
                                        </span>
                                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                                            {UI_TEXT.YONSEI.HOUR_SUFFIX}
                                        </span>
                                    </div>

                                    {/* Weekday Minutes Column */}
                                    <div className="col-span-5 border-r border-black/10 dark:border-white/10 pr-2">
                                        {weekdayMinutes.length === 0 ? (
                                            <span
                                                className="text-slate-300 dark:text-slate-600 italic text-[11px]">-</span>
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {weekdayMinutes.map((item) => (
                                                    <div
                                                        key={item.seq}
                                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono text-xs font-bold border transition-all ${
                                                            item.isNextBus
                                                                ? "bg-blue-600 text-white border-blue-600 shadow-md scale-105"
                                                                : "bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 border-blue-200/50 dark:border-blue-500/20"
                                                        }`}
                                                    >
                                                        <span className="font-extrabold">{item.minuteStr}</span>
                                                        {item.isNextBus && (
                                                            <span
                                                                className="text-[9px] px-1 py-0.2 rounded bg-white/20 text-white font-sans font-black">
                                                                {UI_TEXT.YONSEI.NEXT_BUS_BADGE}
                                                            </span>
                                                        )}
                                                        {item.footnoteSymbol && (
                                                            <span
                                                                title={item.notes}
                                                                className={`text-xs font-black font-mono ml-0.5 cursor-help ${
                                                                    item.isNextBus
                                                                        ? "text-amber-200"
                                                                        : "text-amber-600 dark:text-amber-400"
                                                                }`}
                                                            >
                                                                {item.footnoteSymbol}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Vacation Minutes Column */}
                                    <div className="col-span-5">
                                        {vacationMinutes.length === 0 ? (
                                            <span
                                                className="text-slate-300 dark:text-slate-600 italic text-[11px]">-</span>
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {vacationMinutes.map((item) => (
                                                    <div
                                                        key={item.seq}
                                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono text-xs font-bold border transition-all ${
                                                            item.isNextBus
                                                                ? "bg-indigo-600 text-white border-indigo-600 shadow-md scale-105"
                                                                : "bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 border-indigo-200/50 dark:border-indigo-500/20"
                                                        }`}
                                                    >
                                                        <span className="font-extrabold">{item.minuteStr}</span>
                                                        {item.isNextBus && (
                                                            <span
                                                                className="text-[9px] px-1 py-0.2 rounded bg-white/20 text-white font-sans font-black">
                                                                {UI_TEXT.YONSEI.NEXT_BUS_BADGE}
                                                            </span>
                                                        )}
                                                        {item.footnoteSymbol && (
                                                            <span
                                                                title={item.notes}
                                                                className={`text-xs font-black font-mono ml-0.5 cursor-help ${
                                                                    item.isNextBus
                                                                        ? "text-indigo-200"
                                                                        : "text-amber-600 dark:text-amber-400"
                                                                }`}
                                                            >
                                                                {item.footnoteSymbol}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footnote Index Box (각주 안내) */}
                {footnoteMap.size > 0 && (
                    <div
                        className="p-4 bg-slate-100/90 dark:bg-white/[0.04] border-t border-black/10 dark:border-white/10 text-xs shrink-0">
                        <div
                            className="flex items-center gap-1.5 font-extrabold text-slate-800 dark:text-slate-200 mb-2.5">
                            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400"/>
                            <span>{UI_TEXT.YONSEI.FOOTNOTE_TITLE}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {Array.from(footnoteMap.entries()).map(([noteText, num]) => (
                                <div
                                    key={num}
                                    className="flex items-start gap-2 p-2.5 rounded-xl bg-white dark:bg-[#181818] border border-black/5 dark:border-white/5 shadow-2xs"
                                >
                                    <span className="font-black text-amber-600 dark:text-amber-400 text-sm shrink-0">
                                        {getFootnoteSymbol(num)}
                                    </span>
                                    <span className="text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                                        {noteText}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
