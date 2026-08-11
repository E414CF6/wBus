"use client";

import React from "react";
import {CacheMetadata} from "@shared/types/bus";
import {formatRemainingTime} from "@shared/lib/timeUtils";
import {UI_TEXT} from "@shared/config/locale";
import {Clock, RefreshCw} from "lucide-react";

interface CacheInfoBannerProps {
    meta: CacheMetadata | null;
    onRefresh: () => void;
    isRefreshing: boolean;
}

export const CacheInfoBanner: React.FC<CacheInfoBannerProps> = ({
                                                                    meta,
                                                                    onRefresh,
                                                                    isRefreshing,
                                                                }) => {
    if (!meta) return null;

    const formattedDate = meta.updatedAt
        ? new Date(meta.updatedAt).toLocaleString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        })
        : "-";

    const remainingText = formatRemainingTime(meta.nextRefreshAvailableAt);

    return (
        <div
            className="mb-6 rounded-2xl bg-white/70 dark:bg-[#121212]/70 border border-black/5 dark:border-white/10 backdrop-blur-2xl shadow-xs transition-all duration-300 overflow-hidden">
            <div className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                {/* Timetable Last Updated Timestamp */}
                <div className="flex items-center space-x-2.5 min-w-0">
                    <Clock className="h-4 w-4 text-blue-500 shrink-0"/>
                    <div className="flex items-center space-x-2 truncate">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {UI_TEXT.TIMETABLE.CACHE_CRITERIA(formattedDate)}
                        </span>
                        <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
                        <span className="hidden sm:inline text-slate-500 dark:text-slate-400 font-medium">
                            {meta.canRefresh ? "원주 ITS 갱신 가능" : `${remainingText}`}
                        </span>
                    </div>
                </div>

                {/* Refresh Button */}
                {meta.canRefresh && (
                    <div className="flex items-center shrink-0">
                        <button
                            onClick={onRefresh}
                            disabled={isRefreshing}
                            className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-bold transition-all border border-blue-500/20 cursor-pointer active:scale-95"
                        >
                            <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`}/>
                            <span>{isRefreshing ? UI_TEXT.TIMETABLE.CACHE_REFRESHING : UI_TEXT.TIMETABLE.CACHE_REFRESH_BUTTON}</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
