"use client";

import {UI_TEXT} from "@shared/config/locale";
import {Palmtree, Sun} from "lucide-react";
import React from "react";
import type {HourlyRow} from "../../types";
import {MinuteBadge} from "./MinuteBadge";

interface RouteDetailTableProps {
    dualHourlyTimetable: HourlyRow[];
    isSingleSchedule: boolean;
    selectedFootnote: number | null;
    onSelectFootnote: (num: number | null) => void;
}

export const RouteDetailTable: React.FC<RouteDetailTableProps> = ({
                                                                      dualHourlyTimetable,
                                                                      isSingleSchedule,
                                                                      selectedFootnote,
                                                                      onSelectFootnote,
                                                                  }) => {
    return (
        <>
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
                        {dualHourlyTimetable.map(
                            ({
                                 hourStr,
                                 displayHour,
                                 isCurrentHour,
                                 weekdayMinutes,
                                 vacationMinutes,
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
                                                <span className="text-slate-300 dark:text-slate-600 italic text-[11px]">
                                                    -
                                                </span>
                                            ) : (
                                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                                    {weekdayMinutes.map((item) => (
                                                        <MinuteBadge
                                                            key={item.seq}
                                                            item={item}
                                                            isVacationCol={false}
                                                            selectedFootnote={selectedFootnote}
                                                            onSelectFootnote={onSelectFootnote}
                                                        />
                                                    ))}
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
                                                        className="text-slate-300 dark:text-slate-600 italic text-[11px]">
                                                        -
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                                                        {weekdayMinutes.map((item) => (
                                                            <MinuteBadge
                                                                key={item.seq}
                                                                item={item}
                                                                isVacationCol={false}
                                                                selectedFootnote={selectedFootnote}
                                                                onSelectFootnote={onSelectFootnote}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Vacation Minutes Column */}
                                            <div className="col-span-5 pl-1.5 sm:pl-2">
                                                {vacationMinutes.length === 0 ? (
                                                    <span
                                                        className="text-slate-300 dark:text-slate-600 italic text-[11px]">
                                                        -
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                                                        {vacationMinutes.map((item) => (
                                                            <MinuteBadge
                                                                key={item.seq}
                                                                item={item}
                                                                isVacationCol={true}
                                                                selectedFootnote={selectedFootnote}
                                                                onSelectFootnote={onSelectFootnote}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>
        </>
    );
};
