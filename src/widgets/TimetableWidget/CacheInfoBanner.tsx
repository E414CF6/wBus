"use client";

import React from "react";
import {CacheMetadata} from "@shared/types/bus";
import {LOCALE, UI_TEXT} from "@shared/config/locale";
import {Clock, RefreshCw} from "lucide-react";

interface CacheInfoBannerProps {
    meta: CacheMetadata | null;
    onRefresh: () => void;
    isRefreshing: boolean;
    variant?: "minimal" | "banner";
    className?: string;
}

export const CacheInfoBanner: React.FC<CacheInfoBannerProps> = ({
                                                                    meta,
                                                                    onRefresh,
                                                                    isRefreshing,
                                                                    variant = "minimal",
                                                                    className = "",
                                                                }) => {
    if (!meta && variant === "minimal") return null;

    const formattedDate = meta?.updatedAt
        ? new Date(meta.updatedAt).toLocaleString(LOCALE, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        })
        : "-";

    const canShowRefresh = Boolean(meta?.canRefresh || isRefreshing);

    if (variant === "banner") {
        return (
            <div
                className={`relative overflow-hidden rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-2.5 border border-blue-500/20 dark:border-blue-400/20 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-sky-500/10 dark:from-blue-500/15 dark:via-indigo-500/10 dark:to-sky-500/5 backdrop-blur-2xl shadow-2xs transition-all duration-300 select-none ${className}`}
            >
                <div className="relative flex items-center justify-between gap-3">
                    {/* Left: Compact Icon & Criteria Timestamp */}
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <div
                            className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-2xs shadow-blue-500/20 shrink-0"
                        >
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]"/>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                            <span
                                className="px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 shrink-0">
                                {UI_TEXT.TIMETABLE.CACHE_BANNER_TITLE}
                            </span>
                            <span
                                className="text-xs sm:text-sm font-bold font-mono text-slate-800 dark:text-slate-200 truncate">
                                {formattedDate}
                            </span>
                        </div>
                    </div>

                    {/* Right: Refresh Button (Only shown when available / refreshing) */}
                    {canShowRefresh && (
                        <button
                            type="button"
                            onClick={onRefresh}
                            disabled={isRefreshing}
                            className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-600 hover:text-white dark:bg-blue-500/20 dark:hover:bg-blue-500 text-blue-700 dark:text-blue-300 text-[11px] sm:text-xs font-black border border-blue-500/30 transition-all cursor-pointer active:scale-95 shadow-2xs shrink-0 disabled:opacity-50 disabled:pointer-events-none"
                        >
                            <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isRefreshing ? "animate-spin" : ""}`}/>
                            <span>{isRefreshing ? UI_TEXT.TIMETABLE.CACHE_REFRESHING : UI_TEXT.TIMETABLE.CACHE_REFRESH_BUTTON}</span>
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`flex items-center justify-between px-1 mb-4 text-xs text-slate-500 dark:text-slate-400 select-none ${className}`}
        >
            {/* Minimal Timetable Criteria Timestamp */}
            <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0"/>
                <span>
                    {UI_TEXT.TIMETABLE.BASE_DATETIME_LABEL}{" "}
                    <strong className="font-mono text-slate-700 dark:text-slate-300 font-bold">
                        {formattedDate}
                    </strong>
                </span>
            </div>

            {/* Minimal Refresh Button */}
            {canShowRefresh && (
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-extrabold transition-all cursor-pointer active:scale-95 text-[11px] border border-blue-500/20 disabled:opacity-50"
                >
                    <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`}/>
                    <span>{isRefreshing ? UI_TEXT.TIMETABLE.CACHE_REFRESHING : UI_TEXT.TIMETABLE.CACHE_REFRESH_BUTTON}</span>
                </button>
            )}
        </div>
    );
};
