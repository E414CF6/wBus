"use client";

import {UI_TEXT} from "@shared/config/locale";
import {Clock, Search} from "lucide-react";
import React from "react";

interface RouteDetailSearchProps {
    tableSearch: string;
    onSearchChange: (val: string) => void;
    currentHourStr: string;
    totalHoursCount: number;
}

export const RouteDetailSearch: React.FC<RouteDetailSearchProps> = ({
                                                                        tableSearch,
                                                                        onSearchChange,
                                                                        currentHourStr,
                                                                        totalHoursCount,
                                                                    }) => {
    return (
        <div
            className="p-3 sm:p-4 border-b border-slate-200/70 dark:border-white/10 bg-white/50 dark:bg-[#121620]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
            <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => onSearchChange(e.target.value)}
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
                <span>{UI_TEXT.YONSEI.HOURS_DISPLAYED(totalHoursCount)}</span>
            </div>
        </div>
    );
};
