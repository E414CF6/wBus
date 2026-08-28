"use client";

import React from "react";
import {Clock, RefreshCw} from "lucide-react";
import {CacheMetadata} from "@/types/bus";
import {formatCooldownRemaining} from "@lib/timeUtils";

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
    const formattedDate = meta?.updatedAt
        ? new Date(meta.updatedAt).toLocaleString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        })
        : "-";

    const cooldown = formatCooldownRemaining(meta?.updatedAt, 24);

    return (
        <div
            className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-4 py-2.5 mb-2 rounded-2xl bg-white/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400 select-none">
            {/* Timetable Criteria Timestamp & Cooldown Status */}
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0"/>
                    <span>
                        시간표 기준:{" "}
                        <strong
                            suppressHydrationWarning
                            className="font-mono text-slate-700 dark:text-slate-300 font-bold"
                        >
                            {formattedDate}
                        </strong>
                    </span>
                </div>

                <span
                    suppressHydrationWarning
                    className={`hidden sm:inline-block px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                        cooldown.isReady
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30"
                            : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10"
                    }`}
                >
                    {cooldown.text}
                </span>
            </div>

            {/* Action Button: Dedicated Refresh Button */}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    disabled={!cooldown.isReady || isRefreshing}
                    onClick={() => {
                        if (cooldown.isReady && !isRefreshing) {
                            onRefresh();
                        }
                    }}
                    className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black transition-all text-[11px] select-none ${
                        isRefreshing
                            ? "bg-blue-600 text-white cursor-wait border border-blue-400/40 shadow-xs"
                            : cooldown.isReady
                                ? "bg-blue-600 hover:bg-blue-700 text-white border border-blue-400/50 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/40 cursor-pointer active:scale-95 animate-pulse"
                                : "bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 border border-slate-200/60 dark:border-white/5 cursor-not-allowed opacity-75"
                    }`}
                    title={
                        cooldown.isReady
                            ? "원주시 ITS에서 최신 시간표를 새로고침합니다."
                            : `${cooldown.text}`
                    }
                >
                    <RefreshCw
                        className={`w-3.5 h-3.5 ${
                            isRefreshing
                                ? "animate-spin text-white"
                                : cooldown.isReady
                                    ? "text-white"
                                    : "text-slate-400 dark:text-slate-500"
                        }`}
                    />
                    <span>
                        {isRefreshing
                            ? "시간표 갱신 중..."
                            : cooldown.isReady
                                ? "시간표 새로고침"
                                : "새로고침 대기 중"}
                    </span>
                </button>
            </div>
        </div>
    );
};
