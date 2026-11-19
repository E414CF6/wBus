"use client";

import React from "react";
import {LocateFixed, Search, X} from "lucide-react";
import type {BusRoute, getNextDeparture} from "@entities/schedule";
import {UI_TEXT} from "@shared/config/locale";

type NextDepartureInfo = ReturnType<typeof getNextDeparture>;

interface FullTimetableTableProps {
    dayType: string;
    originName: string;
    destName: string;
    hourlyLocation: "origin" | "dest";
    filteredTimetable: BusRoute["timetable"];
    nextDepInfo: NextDepartureInfo | null;
    tableSearch: string;
    onTableSearchChange: (q: string) => void;
    tableRef: React.RefObject<HTMLDivElement | null>;
    onScrollToNextRow: () => void;
    embedded?: boolean;
}

export const FullTimetableTable: React.FC<FullTimetableTableProps> = ({
                                                                          dayType,
                                                                          originName,
                                                                          destName,
                                                                          hourlyLocation,
                                                                          filteredTimetable,
                                                                          nextDepInfo,
                                                                          tableSearch,
                                                                          onTableSearchChange,
                                                                          tableRef,
                                                                          onScrollToNextRow,
                                                                          embedded = false,
                                                                      }) => (
    <div className="space-y-3">
        <div
            className={`flex ${
                embedded ? "flex-col" : "flex-col sm:flex-row sm:items-center"
            } justify-between gap-2`}
        >
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                    {UI_TEXT.TIMETABLE.DAY_TRIP_COUNT(dayType, filteredTimetable.length)}
                </span>
                {nextDepInfo && (nextDepInfo.nextOrigin || nextDepInfo.nextDest) && (
                    <button
                        type="button"
                        onClick={onScrollToNextRow}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 text-[11px] font-extrabold border border-blue-200 dark:border-blue-800 cursor-pointer active:scale-95 transition whitespace-nowrap"
                    >
                        <LocateFixed className="w-3 h-3"/>
                        <span>{UI_TEXT.TIMETABLE.SCROLL_TO_NEXT_ROW}</span>
                    </button>
                )}
            </div>

            <div className={`relative w-full ${embedded ? "" : "sm:w-56"}`}>
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input
                    id="schedule-table-search"
                    name="schedule-table-search"
                    type="text"
                    value={tableSearch}
                    onChange={(e) => onTableSearchChange(e.target.value)}
                    placeholder={UI_TEXT.TIMETABLE.TABLE_SEARCH_PLACEHOLDER}
                    aria-label={UI_TEXT.TIMETABLE.TABLE_SEARCH_PLACEHOLDER}
                    className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#11131a] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {tableSearch && (
                    <button
                        type="button"
                        onClick={() => onTableSearchChange("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                        <X className="w-3 h-3"/>
                    </button>
                )}
            </div>
        </div>

        <div
            ref={tableRef}
            role="region"
            aria-label={UI_TEXT.TIMETABLE.FULL_TABLE_ARIA}
            tabIndex={0}
            className="max-h-96 overflow-auto overscroll-contain rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#11131a] shadow-xs custom-scrollbar focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
            <table className="w-full min-w-[520px] sm:min-w-full border-collapse text-left text-xs">
                <thead
                    className="sticky top-0 z-20 bg-slate-100/95 dark:bg-[#161922]/95 backdrop-blur-md text-slate-700 dark:text-slate-200 border-b border-black/5 dark:border-white/10 font-extrabold">
                <tr>
                    <th
                        scope="col"
                        className="sticky left-0 z-30 bg-slate-100 dark:bg-[#161922] py-2 px-2.5 w-12 text-center whitespace-nowrap border-r border-black/5 dark:border-white/10"
                    >
                        {UI_TEXT.TIMETABLE.TRIP_SEQ}
                    </th>
                    <th
                        scope="col"
                        className={`py-2 px-3 whitespace-nowrap border-r border-black/5 dark:border-white/10 transition-colors ${
                            hourlyLocation === "origin"
                                ? "bg-blue-100/70 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100"
                                : ""
                        }`}
                    >
                        <div className="flex items-center gap-1 whitespace-nowrap">
                            <span>{UI_TEXT.TIMETABLE.ORIGIN_DEP_HEADER(originName)}</span>
                            {hourlyLocation === "origin" && (
                                <span
                                    className="px-1 py-0.2 rounded text-[9px] font-black bg-blue-600 text-white shrink-0">
                                        {UI_TEXT.TIMETABLE.CRITERIA_BADGE}
                                    </span>
                            )}
                        </div>
                    </th>
                    <th
                        scope="col"
                        className={`py-2 px-3 whitespace-nowrap border-r border-black/5 dark:border-white/10 transition-colors ${
                            hourlyLocation === "dest"
                                ? "bg-amber-100/70 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100"
                                : ""
                        }`}
                    >
                        <div className="flex items-center gap-1 whitespace-nowrap">
                            <span>{UI_TEXT.TIMETABLE.DEST_DEP_HEADER(destName)}</span>
                            {hourlyLocation === "dest" && (
                                <span
                                    className="px-1 py-0.2 rounded text-[9px] font-black bg-amber-600 text-white shrink-0">
                                        {UI_TEXT.TIMETABLE.CRITERIA_BADGE}
                                    </span>
                            )}
                        </div>
                    </th>
                    <th scope="col" className="py-2 px-3 whitespace-nowrap min-w-[120px]">{UI_TEXT.TIMETABLE.NOTES}</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {filteredTimetable.length === 0 ? (
                    <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                            {UI_TEXT.TIMETABLE.NO_MATCHING_TRIPS}
                        </td>
                    </tr>
                ) : (
                    filteredTimetable.map((row) => {
                        const isNextOrigin = nextDepInfo?.nextOrigin?.seq === row.seq;
                        const isNextDest = nextDepInfo?.nextDest?.seq === row.seq;
                        const isTargetNext = hourlyLocation === "origin" ? isNextOrigin : isNextDest;

                        return (
                            <tr
                                key={row.seq}
                                data-next-departure={isNextOrigin || isNextDest ? "true" : undefined}
                                data-target-next={isTargetNext ? "true" : undefined}
                                className={`cv-auto-row ${
                                    isNextOrigin || isNextDest
                                        ? "bg-blue-50/80 dark:bg-blue-950/40 font-bold"
                                        : "hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                                }`}
                            >
                                <th
                                    scope="row"
                                    className={`sticky left-0 z-10 py-2 px-2.5 text-center font-mono font-medium whitespace-nowrap text-slate-400 border-r border-black/5 dark:border-white/10 ${
                                        isNextOrigin || isNextDest
                                            ? "bg-blue-50 dark:bg-[#141c33]"
                                            : "bg-white dark:bg-[#11131a]"
                                    }`}
                                >
                                    {row.seq}
                                </th>
                                <td
                                    className={`py-2 px-3 font-mono whitespace-nowrap border-r border-black/5 dark:border-white/10 ${
                                        hourlyLocation === "origin" ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                                    }`}
                                >
                                        <span
                                            className={
                                                isNextOrigin
                                                    ? "px-1.5 py-0.5 rounded bg-blue-600 text-white font-black"
                                                    : "font-bold text-slate-900 dark:text-slate-100"
                                            }
                                        >
                                            {row.originDepTime}
                                        </span>
                                </td>
                                <td
                                    className={`py-2 px-3 font-mono whitespace-nowrap border-r border-black/5 dark:border-white/10 ${
                                        hourlyLocation === "dest" ? "bg-amber-50/40 dark:bg-amber-950/20" : ""
                                    }`}
                                >
                                        <span
                                            className={
                                                isNextDest
                                                    ? "px-1.5 py-0.5 rounded bg-amber-600 text-white font-black"
                                                    : "font-bold text-slate-900 dark:text-slate-100"
                                            }
                                        >
                                            {row.destDepTime}
                                        </span>
                                </td>
                                <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                                    {row.notes || "-"}
                                </td>
                            </tr>
                        );
                    })
                )}
                </tbody>
            </table>
        </div>
    </div>
);
