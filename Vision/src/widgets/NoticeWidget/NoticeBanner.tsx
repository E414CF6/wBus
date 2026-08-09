"use client";

import React from "react";
import {useNoticeList} from "@entities/notice/hooks";
import {UI_TEXT} from "@shared/config/locale";
import {ChevronRight, Megaphone, Sparkles} from "lucide-react";

interface NoticeBannerProps {
    onClick: () => void;
}

export const NoticeBanner: React.FC<NoticeBannerProps> = ({onClick}) => {
    const {data: noticeData, loading} = useNoticeList(1);

    // Get latest pinned or top notice
    const latestNotice = noticeData?.notices?.[0] ?? null;
    const pinnedCount = noticeData?.notices?.filter((n) => n.isNotice).length ?? 0;

    return (
        <div
            onClick={onClick}
            className="mb-6 group relative overflow-hidden rounded-3xl p-5 border border-amber-500/20 dark:border-amber-400/20 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-600/10 dark:from-amber-500/15 dark:via-orange-500/10 dark:to-amber-500/5 backdrop-blur-2xl shadow-xs hover:shadow-xl hover:border-amber-500/40 transition-all duration-300 cursor-pointer select-none active:scale-[0.99]"
        >
            {/* Background Decorative Glow */}
            <div
                className="absolute -right-10 -bottom-10 w-40 h-40 bg-amber-500/10 dark:bg-amber-400/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-500 pointer-events-none"/>

            <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Left Side: Icon & Headline */}
                <div className="flex items-start sm:items-center space-x-3.5 min-w-0">
                    <div
                        className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20 shrink-0 group-hover:scale-105 transition-transform duration-200">
                        <Megaphone className="w-5 h-5 stroke-[2.4]"/>
                        {pinnedCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span
                                    className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"/>
                                <span
                                    className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white dark:border-slate-900"/>
                            </span>
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                            <span
                                className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                {UI_TEXT.NOTICE.WIDGET_TITLE}
                            </span>
                            {pinnedCount > 0 && (
                                <span
                                    className="hidden xs:inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                    <Sparkles className="w-3 h-3"/>
                                    <span>중요 공지 {pinnedCount}건</span>
                                </span>
                            )}
                        </div>

                        {loading ? (
                            <div className="h-5 w-64 bg-amber-500/10 rounded-lg animate-pulse my-1"/>
                        ) : latestNotice ? (
                            <div className="flex items-center space-x-2 min-w-0">
                                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                    {latestNotice.title}
                                </h3>
                                <span
                                    className="hidden md:inline text-xs text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                                    ({latestNotice.date})
                                </span>
                            </div>
                        ) : (
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                                {UI_TEXT.NOTICE.LATEST_ITS}
                            </h3>
                        )}
                    </div>
                </div>

                {/* Right Side: Action Link Button */}
                <div
                    className="flex items-center justify-end shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-amber-500/10">
                    <div
                        className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-black border border-amber-500/30 transition-all group-hover:bg-amber-500 group-hover:text-white group-hover:shadow-md group-hover:shadow-amber-500/20">
                        <span>{UI_TEXT.NOTICE.VIEW_ALL}</span>
                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1"/>
                    </div>
                </div>
            </div>
        </div>
    );
};
