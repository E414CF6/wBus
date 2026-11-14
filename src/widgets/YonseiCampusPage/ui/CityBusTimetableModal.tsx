"use client";

import React, {useCallback, useId, useMemo, useRef, useState} from "react";
import {Clock, Info, MapPin, Search, X} from "lucide-react";

import {ROUTE_CONFIG, TARGET_ROUTE_NUMBERS} from "@entities/route";
import {
    buildFootnoteMap,
    type BusRoute,
    computeDualHourlyTimetable,
    getFootnoteSymbol,
    type MinuteItem,
    resolveWeekdayAndVacationRoutes,
} from "@entities/schedule";
import {UI_TEXT} from "@shared/config/locale";
import {isWeekend, parseTimeToMinutes} from "@shared/lib/timeUtils";
import {useDialogModal} from "@shared/lib/useDialogModal";

export interface CityBusTimetableModalProps {
    isOpen: boolean;
    initialRouteNo: string;
    initialLocation: "origin" | "dest";
    allRoutes: BusRoute[];
    isHolidayOrVacation?: boolean;
    now: Date;
    onClose: () => void;
}

export const CityBusTimetableModal: React.FC<CityBusTimetableModalProps> = ({
                                                                                isOpen,
                                                                                initialRouteNo,
                                                                                initialLocation,
                                                                                allRoutes,
                                                                                isHolidayOrVacation,
                                                                                now,
                                                                                onClose,
                                                                            }) => {
    const activeIsVacation = isHolidayOrVacation ?? isWeekend(now);
    const [routeNo, setRouteNo] = useState(initialRouteNo);
    const [location, setLocation] = useState<"origin" | "dest">(initialLocation);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedFootnoteNum, setSelectedFootnoteNum] = useState<number | null>(null);
    const [showStops, setShowStops] = useState(false);

    const dialogRef = useRef<HTMLDialogElement>(null);
    const currentHourRowRef = useRef<HTMLTableRowElement>(null);
    const titleId = useId();
    const tableCaptionId = useId();

    const handleDialogOpen = useCallback(() => {
        requestAnimationFrame(() => {
            currentHourRowRef.current?.scrollIntoView({
                block: "center",
                behavior: "smooth",
            });
        });
    }, []);

    useDialogModal(dialogRef, isOpen, handleDialogOpen);

    const config = ROUTE_CONFIG[routeNo];
    const primaryRoute = useMemo(
        () => allRoutes.find((r) => r.routeNo === routeNo) ?? null,
        [allRoutes, routeNo]
    );

    const {weekdayRoute, vacationRoute} = useMemo(
        () => resolveWeekdayAndVacationRoutes(primaryRoute, allRoutes),
        [primaryRoute, allRoutes]
    );

    const footnoteMap = useMemo(
        () => buildFootnoteMap(weekdayRoute, vacationRoute),
        [weekdayRoute, vacationRoute]
    );

    const footnoteEntries = useMemo(
        () =>
            Array.from(footnoteMap.entries()).map(([noteText, num]) => ({
                num,
                symbol: getFootnoteSymbol(num),
                noteText,
            })),
        [footnoteMap]
    );

    const currentHourStr = now.getHours().toString().padStart(2, "0");
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const hourlyRows = useMemo(() => {
        return computeDualHourlyTimetable({
            route: primaryRoute,
            weekdayRoute,
            vacationRoute,
            tableSearch: searchQuery,
            now,
            footnoteMap,
            currentHourStr,
            departureLocation: location,
        });
    }, [primaryRoute, weekdayRoute, vacationRoute, searchQuery, now, footnoteMap, currentHourStr, location]);

    const destLabel = config?.destLabel ?? "연세대 출발";
    const originLabel = config?.originLabel ?? "장양리 출발";

    const handleRouteChange = (no: string) => {
        setRouteNo(no);
        setSelectedFootnoteNum(null);
    };

    const renderMinuteChip = (item: MinuteItem, variant: "weekday" | "vacation") => {
        const depMins = parseTimeToMinutes(item.destDepTime);
        const isPast =
            depMins !== null &&
            depMins < currentMins &&
            !item.isNextBus &&
            !searchQuery &&
            selectedFootnoteNum === null;

        const isHighlightedByFootnote =
            selectedFootnoteNum !== null && item.footnoteNumber === selectedFootnoteNum;
        const isDimmedByFootnote =
            selectedFootnoteNum !== null && item.footnoteNumber !== selectedFootnoteNum;

        const nextClass =
            variant === "weekday"
                ? "bg-[#003876] text-white shadow-sm ring-2 ring-[#003876]/25 dark:ring-blue-400/30"
                : "bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/25";

        const baseClass = isHighlightedByFootnote
            ? "bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/50 ring-1 ring-amber-500/30"
            : item.isNextBus
                ? nextClass
                : "bg-slate-100 dark:bg-white/[0.08] text-slate-800 dark:text-slate-100 border border-slate-200/60 dark:border-white/[0.06]";

        return (
            <span
                key={`${variant}-${item.seq}-${item.destDepTime}`}
                title={item.notes || undefined}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-extrabold tabular-nums transition-opacity ${baseClass} ${
                    isPast || isDimmedByFootnote ? "opacity-40" : ""
                }`}
            >
                <span>{item.minuteStr}</span>
                {item.footnoteSymbol && (
                    <span
                        className={`text-[10px] font-black ${
                            item.isNextBus ? "text-amber-200" : "text-amber-600 dark:text-amber-400"
                        }`}
                    >
                        {item.footnoteSymbol}
                    </span>
                )}
                {item.isNextBus && (
                    <span className="text-[9px] font-black px-1 py-0.2 rounded bg-white/20">
                        {UI_TEXT.YONSEI.NEXT_BUS_BADGE}
                    </span>
                )}
            </span>
        );
    };

    return (
        <dialog
            ref={dialogRef}
            {...({closedby: "any"} as Record<string, unknown>)}
            onClose={onClose}
            aria-labelledby={titleId}
            className="m-auto w-full sm:max-w-2xl max-h-[90dvh] open:flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#111623] text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden p-0 mb-0 sm:mb-auto"
        >
            {/* Modal Header */}
            <div
                className="px-4 sm:px-6 pt-4 pb-3.5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] space-y-3 shrink-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                        <span
                            className={`inline-flex items-center justify-center px-3 py-1.5 rounded-2xl text-xs font-black text-white shadow-xs bg-gradient-to-br ${config?.gradient ?? "from-[#003876] to-blue-700"} shrink-0 tabular-nums`}
                        >
                            {routeNo}번
                        </span>
                        <div className="min-w-0">
                            <h3
                                id={titleId}
                                className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate"
                            >
                                {location === "dest" ? destLabel : originLabel} ·{" "}
                                {UI_TEXT.YONSEI.FULL_TIMETABLE_DETAIL}
                            </h3>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                {config?.description}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={UI_TEXT.ACCESSIBILITY.CLOSE_MODAL}
                        className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-300/80 dark:hover:bg-white/20 transition-colors shrink-0 cursor-pointer"
                    >
                        <X className="w-4 h-4"/>
                    </button>
                </div>

                {/* Route Switcher & Direction Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div
                        role="tablist"
                        aria-label="버스 노선 선택"
                        className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-200/60 dark:bg-white/[0.06] overflow-x-auto no-scrollbar max-w-full"
                    >
                        {TARGET_ROUTE_NUMBERS.map((no) => {
                            const selected = routeNo === no;
                            return (
                                <button
                                    key={no}
                                    type="button"
                                    role="tab"
                                    aria-selected={selected}
                                    onClick={(e) => {
                                        handleRouteChange(no);
                                        e.currentTarget.scrollIntoView({
                                            block: "nearest",
                                            inline: "nearest",
                                        });
                                    }}
                                    className={`relative px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                                        selected
                                            ? "bg-white dark:bg-[#1b2234] text-[#003876] dark:text-blue-300 shadow-xs border-b-2 border-[#003876] dark:border-blue-400"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                    }`}
                                >
                                    {no}번
                                </button>
                            );
                        })}
                    </div>

                    <div
                        role="tablist"
                        aria-label="출발지 방향 선택"
                        className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-200/60 dark:bg-white/[0.06] overflow-x-auto no-scrollbar max-w-full"
                    >
                        <button
                            type="button"
                            role="tab"
                            aria-selected={location === "dest"}
                            onClick={() => setLocation("dest")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                                location === "dest"
                                    ? "bg-[#003876] text-white shadow-xs border-b-2 border-blue-300"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            {destLabel}
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={location === "origin"}
                            onClick={() => setLocation("origin")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                                location === "origin"
                                    ? "bg-[#003876] text-white shadow-xs border-b-2 border-blue-300"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            {originLabel}
                        </button>
                    </div>
                </div>

                {/* Search + Route Stops Toggle */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search
                            className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"/>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={UI_TEXT.YONSEI.SEARCH_MODAL_PLACEHOLDER}
                            aria-label={UI_TEXT.YONSEI.SEARCH_MODAL_PLACEHOLDER}
                            className="w-full pl-8 pr-8 py-2 rounded-xl bg-white dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 focus:border-[#003876] dark:focus:border-blue-400 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-colors"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                aria-label="검색어 지우기"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5"/>
                            </button>
                        )}
                    </div>

                    {config?.viaStops && (
                        <button
                            type="button"
                            onClick={() => setShowStops((v) => !v)}
                            aria-expanded={showStops}
                            className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-extrabold border transition-colors shrink-0 cursor-pointer ${
                                showStops
                                    ? "bg-[#003876]/10 dark:bg-blue-500/20 text-[#003876] dark:text-blue-300 border-[#003876]/30 dark:border-blue-400/30"
                                    : "bg-white dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                            }`}
                        >
                            <MapPin className="w-3.5 h-3.5"/>
                            <span>경유지</span>
                        </button>
                    )}
                </div>

                {/* Collapsible Via Stops Strip */}
                {showStops && config?.viaStops && (
                    <div
                        className="p-3 rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 text-[11px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                        <span className="font-black text-[#003876] dark:text-blue-300 mr-1.5">
                            전체 경유지:
                        </span>
                        {config.viaStops}
                    </div>
                )}

                {/* Footnotes Legend & Filter */}
                {footnoteEntries.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                        <span
                            className="inline-flex items-center gap-1 text-[10px] font-black text-slate-400 dark:text-slate-500 shrink-0 mr-0.5">
                            <Info className="w-3 h-3"/>
                            {UI_TEXT.YONSEI.FOOTNOTE_TITLE}
                        </span>
                        {footnoteEntries.map((fn) => {
                            const active = selectedFootnoteNum === fn.num;
                            return (
                                <button
                                    key={fn.num}
                                    type="button"
                                    onClick={() =>
                                        setSelectedFootnoteNum((prev) =>
                                            prev === fn.num ? null : fn.num
                                        )
                                    }
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                                        active
                                            ? "bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-500/50"
                                            : "bg-white dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                                    }`}
                                >
                                    <span className="font-black text-amber-600 dark:text-amber-400">
                                        {fn.symbol}
                                    </span>
                                    <span>{fn.noteText}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Semantic Responsive Timetable */}
            <div
                tabIndex={0}
                role="region"
                aria-labelledby={tableCaptionId}
                className="timetable-wrapper flex-1 px-4 sm:px-6 py-4"
            >
                {hourlyRows.length === 0 ? (
                    <div className="py-14 text-center text-xs font-bold text-slate-400 dark:text-slate-500">
                        <span id={tableCaptionId} className="sr-only">
                            {routeNo}번 버스 시간표
                        </span>
                        {UI_TEXT.YONSEI.NO_TIMES_MATCH}
                    </div>
                ) : (
                    <table
                        className="timetable-table text-xs"
                        style={
                            {
                                "--label-weekday": `"${UI_TEXT.YONSEI.WEEKDAY_COLUMN}"`,
                                "--label-vacation": `"${UI_TEXT.YONSEI.VACATION_COLUMN}"`,
                            } as React.CSSProperties
                        }
                    >
                        <caption id={tableCaptionId} className="sr-only">
                            {routeNo}번 {location === "dest" ? destLabel : originLabel} 시간표
                        </caption>
                        <thead>
                        <tr className="bg-slate-100 dark:bg-[#192033] text-[11px] font-black text-slate-600 dark:text-slate-300">
                            <th
                                scope="col"
                                className="w-16 px-3 py-2.5 text-center border-y border-l border-slate-200/80 dark:border-white/10 rounded-tl-xl"
                            >
                                {UI_TEXT.YONSEI.HOUR_LABEL}
                            </th>
                            <th
                                scope="col"
                                className={`px-3 py-2.5 text-left border-y border-l border-slate-200/80 dark:border-white/10 ${
                                    !activeIsVacation
                                        ? "bg-blue-50/90 dark:bg-blue-950/45 text-[#003876] dark:text-blue-200"
                                        : ""
                                }`}
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    <span>{UI_TEXT.YONSEI.WEEKDAY_COLUMN}</span>
                                    {!activeIsVacation && (
                                        <span
                                            className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-[#003876] text-white dark:bg-blue-500">
                                            오늘 적용
                                        </span>
                                    )}
                                </span>
                            </th>
                            <th
                                scope="col"
                                className={`px-3 py-2.5 text-left border border-slate-200/80 dark:border-white/10 rounded-tr-xl ${
                                    activeIsVacation
                                        ? "bg-blue-50/90 dark:bg-blue-950/45 text-[#003876] dark:text-blue-200"
                                        : ""
                                }`}
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    <span>{UI_TEXT.YONSEI.VACATION_COLUMN}</span>
                                    {activeIsVacation && (
                                        <span
                                            className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-[#003876] text-white dark:bg-blue-500">
                                            오늘 적용
                                        </span>
                                    )}
                                </span>
                            </th>
                        </tr>
                        </thead>

                        <tbody>
                        {hourlyRows.map((row) => (
                            <tr
                                key={row.hourStr}
                                ref={row.isCurrentHour ? currentHourRowRef : undefined}
                                data-current-hour={row.isCurrentHour ? "true" : undefined}
                                className={
                                    row.isCurrentHour
                                        ? "bg-blue-50/70 dark:bg-blue-950/25"
                                        : "bg-white dark:bg-[#111623]"
                                }
                            >
                                <th
                                    scope="row"
                                    className={`px-2 py-2.5 text-center font-black tabular-nums border-b border-l border-slate-200/70 dark:border-white/10 ${
                                        row.isCurrentHour
                                            ? "bg-blue-50 dark:bg-[#152038] text-[#003876] dark:text-blue-300 border-l-4 border-l-[#003876] dark:border-l-blue-400"
                                            : "bg-slate-50/90 dark:bg-[#141a29] text-slate-700 dark:text-slate-200"
                                    }`}
                                >
                                    <span className="text-sm">{row.displayHour}시</span>
                                    {row.isCurrentHour && (
                                        <span
                                            className="sm:mt-0.5 inline-flex items-center justify-center gap-0.5 text-[10px] font-black text-blue-600 dark:text-blue-400 sm:block">
                                                <Clock className="w-2.5 h-2.5 inline mr-0.5"/>
                                                현재
                                            </span>
                                    )}
                                </th>

                                {/* Weekday minutes */}
                                <td
                                    className={`px-3 py-2.5 border-b border-l border-slate-200/70 dark:border-white/10 align-middle ${
                                        !activeIsVacation ? "bg-blue-50/25 dark:bg-blue-950/10" : ""
                                    }`}
                                >
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                        {row.weekdayMinutes.length === 0 ? (
                                            <span className="text-[11px] text-slate-300 dark:text-slate-700">
                                                    -
                                                </span>
                                        ) : (
                                            row.weekdayMinutes.map((item) =>
                                                renderMinuteChip(item, "weekday")
                                            )
                                        )}
                                    </div>
                                </td>

                                {/* Vacation / Holiday minutes */}
                                <td
                                    className={`px-3 py-2.5 border-b border-x border-slate-200/70 dark:border-white/10 align-middle ${
                                        activeIsVacation ? "bg-blue-50/25 dark:bg-blue-950/10" : ""
                                    }`}
                                >
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                        {row.vacationMinutes.length === 0 ? (
                                            <span className="text-[11px] text-slate-300 dark:text-slate-700">
                                                    -
                                                </span>
                                        ) : (
                                            row.vacationMinutes.map((item) =>
                                                renderMinuteChip(item, "vacation")
                                            )
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>
        </dialog>
    );
};
