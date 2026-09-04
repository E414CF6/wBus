"use client";

import React from "react";
import {Search} from "lucide-react";

import {UI_TEXT} from "@shared/config/locale";

interface RouteDetailSearchProps {
    tableSearch: string;
    onSearchChange: (val: string) => void;
}

export const RouteDetailSearch: React.FC<RouteDetailSearchProps> = ({
                                                                        tableSearch,
                                                                        onSearchChange,
                                                                    }) => {
    return (
        <div
            className="p-3 sm:p-4 border-b border-slate-200/70 dark:border-white/10 bg-white/50 dark:bg-[#121620]/50 shrink-0">
            <div className="relative w-full">
                <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={UI_TEXT.YONSEI.SEARCH_MODAL_PLACEHOLDER}
                    className="w-full pl-9 pr-4 py-1.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-transparent focus:border-blue-500/50 text-xs font-semibold text-slate-900 dark:text-white outline-none transition-all"
                />
            </div>
        </div>
    );
};
