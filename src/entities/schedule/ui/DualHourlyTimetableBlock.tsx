"use client";

import React, {useMemo, useState} from "react";
import {Clock, Hash, Search, X} from "lucide-react";
import type {MinuteItem} from "../lib/hourlyTimetable";
import {
    buildFootnoteMap,
    computeDualHourlyTimetable,
    getFootnoteSymbol,
    resolveWeekdayAndVacationRoutes,
} from "../lib/hourlyTimetable";
import type {BusRoute} from "../types";

export interface DualHourlyTimetableBlockProps {
    route: BusRoute;
    allRoutes: BusRoute[];
    now: Date;
    locationLabel?: string;
}

function MinuteBadge({
    item,
    variant,
    selectedFootnote,
    onSelectFootnote,
}: {
    item: MinuteItem;
    variant: "weekday" | "vacation";
    selectedFootnote: number | null;
    onSelectFootnote: (fn: number | null) => void;
}) {
    const isSelectedFn =
        selectedFootnote !== null && item.footnoteNumber === selectedFootnote;
    const isDimmed =
        selectedFootnote !== null && item.footnoteNumber !== selectedFootnote;

    const baseBadge = item.isNextBus
        ? variant === "weekday"
            ? "bg-teal-600 text-white border-teal-500 ring-2 ring-teal-400/50 font-black"
            : "bg-amber-600 text-white border-amber-500 ring-2 ring-amber-400/50 font-black"
        : isSelectedFn
            ? "bg-blue-600 text-white border-blue-500 font-black"
            : "bg-slate-100 dark:bg-[#1d2230] text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 font-bold";

    return (
        <button
            type="button"
            onClick={() => {
                if (item.footnoteNumber) {
                    onSelectFootnote(
                        selectedFootnote === item.footnoteNumber ? null : item.footnoteNumber
                    );
                }
            }}
            title={
                item.notes
                    ? `${item.destDepTime} 출발 · 비고: ${item.notes}`
                    : `${item.destDepTime} 출발`
            }
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded border text-xs font-mono transition-all ${baseBadge} ${
                isDimmed ? "opacity-35" : ""
            } ${item.footnoteNumber ? "cursor-pointer hover:scale-105" : "cursor-default"}`}
        >
            <span>{item.minuteStr}분</span>
            {item.footnoteSymbol && (
                <span className="text-[10px] font-sans text-blue-600 dark:text-blue-300 font-extrabold ml-0.5">
                    {item.footnoteSymbol}
                </span>
            )}
            {item.isNextBus && (
                <span className="ml-1 px-1 py-0.2 rounded bg-black/20 text-[9px] font-sans font-black">
                    다음
                </span>
            )}
        </button>
    );
}

export const DualHourlyTimetableBlock: React.FC<DualHourlyTimetableBlockProps> = ({
    route,
    allRoutes,
    now,
    locationLabel = "종점 출발 시각",
}) => {
    const [tableSearch, setTableSearch] = useState("");
    const [selectedFootnote, setSelectedFootnote] = useState<number | null>(null);

    const currentHourStr = useMemo(
        () => String(now.getHours()).padStart(2, "0"),
        [now]
    );

    const {weekdayRoute, vacationRoute} = useMemo(
        () => resolveWeekdayAndVacationRoutes(route, allRoutes),
        [route, allRoutes]
    );

    const footnoteMap = useMemo(
        () => buildFootnoteMap(weekdayRoute, vacationRoute),
        [weekdayRoute, vacationRoute]
    );

    const dualHourlyTimetable = useMemo(
        () =>
            computeDualHourlyTimetable({
                route,
                weekdayRoute,
                vacationRoute,
                tableSearch,
                now,
                footnoteMap,
                currentHourStr,
            }),
        [route, weekdayRoute, vacationRoute, tableSearch, now, footnoteMap, currentHourStr]
    );

    const isSingleSchedule =
        route.routeNo === "30" ||
        !weekdayRoute ||
        !vacationRoute ||
        weekdayRoute.id === vacationRoute.id;

    return (
        <div className="space-y-2.5">
            {/* Search & Legend Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 dark:bg-[#171b26] p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>
                        기준: <strong>{locationLabel}</strong> (시각 뒤 기호는 경유지·행선지 각주)
                    </span>
                </div>
                <div className="relative w-full sm:w-52">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                        placeholder="시간·경유지 검색 (예: 08:, 원주역)"
                        className="w-full pl-8 pr-7 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11141c] text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                    {tableSearch && (
                        <button
                            type="button"
                            onClick={() => setTableSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Footnote Interactive Legend */}
            {footnoteMap.size > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-extrabold text-amber-800 dark:text-amber-300">
                        <span className="flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            각주 안내 (클릭하면 해당 경유 시간만 강조됩니다)
                        </span>
                        {selectedFootnote !== null && (
                            <button
                                type="button"
                                onClick={() => setSelectedFootnote(null)}
                                className="underline cursor-pointer text-blue-600 dark:text-blue-400"
                            >
                                필터 해제
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {Array.from(footnoteMap.entries()).map(([noteText, fnNum]) => {
                            const active = selectedFootnote === fnNum;
                            return (
                                <button
                                    key={fnNum}
                                    type="button"
                                    onClick={() =>
                                        setSelectedFootnote(active ? null : fnNum)
                                    }
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                                        active
                                            ? "bg-blue-600 text-white border-blue-600"
                                            : "bg-white dark:bg-[#161a24] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-blue-400"
                                    }`}
                                >
                                    <span className="font-extrabold text-blue-600 dark:text-blue-400">
                                        {getFootnoteSymbol(fnNum)}
                                    </span>
                                    <span>{noteText}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700">
                <table className="w-full border-collapse text-left text-xs">
                    <thead>
                        <tr className="bg-slate-100 dark:bg-[#1b202e] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 font-extrabold">
                            <th className="py-2 px-3 w-16 text-center border-r border-slate-300 dark:border-slate-700">
                                시각
                            </th>
                            <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">
                                {isSingleSchedule
                                    ? "운행 시각 (연중·매일 동일)"
                                    : "평일 (학기중) 출발 분"}
                            </th>
                            {!isSingleSchedule && (
                                <th className="py-2 px-3">
                                    방학 · 토요일 · 공휴일 출발 분
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {dualHourlyTimetable.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={isSingleSchedule ? 2 : 3}
                                    className="py-6 text-center text-slate-400"
                                >
                                    검색 조건에 일치하는 출발 시각이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            dualHourlyTimetable.map((row) => (
                                <tr
                                    key={row.hourStr}
                                    className={
                                        row.isCurrentHour
                                            ? "bg-blue-50/60 dark:bg-blue-950/25"
                                            : "bg-white dark:bg-[#12151e]"
                                    }
                                >
                                    <td className="py-2 px-2.5 text-center font-mono font-black text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800 align-middle">
                                        <span>{row.displayHour}시</span>
                                        {row.isCurrentHour && (
                                            <span className="block text-[9px] font-sans font-extrabold text-blue-600 dark:text-blue-400">
                                                현재
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 align-middle">
                                        <div className="flex flex-wrap gap-1.5">
                                            {row.weekdayMinutes.length === 0 ? (
                                                <span className="text-slate-300 dark:text-slate-600">-</span>
                                            ) : (
                                                row.weekdayMinutes.map((m) => (
                                                    <MinuteBadge
                                                        key={`w-${m.seq}`}
                                                        item={m}
                                                        variant="weekday"
                                                        selectedFootnote={selectedFootnote}
                                                        onSelectFootnote={setSelectedFootnote}
                                                    />
                                                ))
                                            )}
                                        </div>
                                    </td>
                                    {!isSingleSchedule && (
                                        <td className="py-2 px-3 align-middle">
                                            <div className="flex flex-wrap gap-1.5">
                                                {row.vacationMinutes.length === 0 ? (
                                                    <span className="text-slate-300 dark:text-slate-600">-</span>
                                                ) : (
                                                    row.vacationMinutes.map((m) => (
                                                        <MinuteBadge
                                                            key={`v-${m.seq}`}
                                                            item={m}
                                                            variant="vacation"
                                                            selectedFootnote={selectedFootnote}
                                                            onSelectFootnote={setSelectedFootnote}
                                                        />
                                                    ))
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DualHourlyTimetableBlock;
