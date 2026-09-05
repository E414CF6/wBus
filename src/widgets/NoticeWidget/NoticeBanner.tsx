"use client";

import React, {useEffect, useMemo, useState} from "react";
import {useNoticeList} from "@entities/notice/hooks";
import {UI_TEXT} from "@shared/config/locale";
import {ChevronLeft, ChevronRight, Megaphone} from "lucide-react";

interface NoticeBannerProps {
    onClick: (noticeId?: string) => void;
    className?: string;
}

export const NoticeBanner: React.FC<NoticeBannerProps> = ({onClick, className = ""}) => {
    const {data: noticeData, loading} = useNoticeList(1);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    // Sort notices strictly by date descending (YYYY-MM-DD), then by numeric ID descending
    const sortedNotices = useMemo(() => {
        if (!noticeData?.notices?.length) return [];
        return [...noticeData.notices].sort((a, b) => {
            if (a.date && b.date && a.date !== b.date) {
                return b.date.localeCompare(a.date);
            }
            const idA = parseInt(a.id, 10) || 0;
            const idB = parseInt(b.id, 10) || 0;
            return idB - idA;
        });
    }, [noticeData?.notices]);

    // Keep top 5 latest notices for cycling carousel
    const latestNotices = useMemo(() => sortedNotices.slice(0, 5), [sortedNotices]);

    const safeIndex = currentIndex < latestNotices.length ? currentIndex : 0;

    // Auto cycle through top latest notices every 5 seconds
    useEffect(() => {
        if (isHovered || latestNotices.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % latestNotices.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [isHovered, latestNotices.length]);

    const currentNotice = latestNotices[safeIndex] ?? null;

    // Check if notice is recent (within 14 days) or is top 1 latest notice
    const isNew = useMemo(() => {
        if (!currentNotice?.date) return safeIndex === 0;
        const noticeDate = new Date(currentNotice.date);
        if (isNaN(noticeDate.getTime())) return safeIndex === 0;
        const now = new Date();
        const diffDays = Math.ceil(Math.abs(now.getTime() - noticeDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 14 || safeIndex === 0;
    }, [safeIndex, currentNotice?.date]);

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (latestNotices.length <= 1) return;
        setCurrentIndex((prev) => (prev - 1 + latestNotices.length) % latestNotices.length);
    };

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (latestNotices.length <= 1) return;
        setCurrentIndex((prev) => (prev + 1) % latestNotices.length);
    };

    const handleDotClick = (e: React.MouseEvent, idx: number) => {
        e.stopPropagation();
        setCurrentIndex(idx);
    };

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => onClick(currentNotice?.id)}
            className={`group relative overflow-hidden rounded-3xl p-5 border border-amber-500/20 dark:border-amber-400/20 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-600/10 dark:from-amber-500/15 dark:via-orange-500/10 dark:to-amber-500/5 backdrop-blur-2xl shadow-xs hover:shadow-xl hover:border-amber-500/40 transition-all duration-300 cursor-pointer select-none active:scale-[0.99] ${className}`}
        >
            {/* Background Decorative Glow */}
            <div
                className="absolute -right-10 -bottom-10 w-40 h-40 bg-amber-500/10 dark:bg-amber-400/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-500 pointer-events-none"/>

            <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Left Side: Icon & Headline */}
                <div className="flex items-start sm:items-center space-x-3.5 min-w-0 flex-1">
                    <div
                        className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20 shrink-0 group-hover:scale-105 transition-transform duration-200">
                        <Megaphone className="w-5 h-5 stroke-[2.4]"/>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span
                                className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                {UI_TEXT.NOTICE.WIDGET_TITLE}
                            </span>

                            {isNew && (
                                <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-xs animate-pulse">
                                    <span>{UI_TEXT.NOTICE.BADGE_NEW}</span>
                                </span>
                            )}
                        </div>

                        {loading ? (
                            <div className="h-5 w-64 bg-amber-500/10 rounded-lg animate-pulse my-1"/>
                        ) : currentNotice ? (
                            <div className="flex items-center space-x-2 min-w-0">
                                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                    {currentNotice.title}
                                </h3>
                                {currentNotice.date && (
                                    <span
                                        className="hidden md:inline text-xs text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                                        ({currentNotice.date})
                                    </span>
                                )}
                            </div>
                        ) : (
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                                {UI_TEXT.NOTICE.LATEST_ITS}
                            </h3>
                        )}
                    </div>
                </div>

                {/* Right Side: Action Link Button & Carousel Navigation */}
                <div
                    className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-500/10">
                    {/* Carousel Dots & Controls */}
                    {latestNotices.length > 1 && (
                        <div
                            className="flex items-center space-x-1 bg-amber-500/10 dark:bg-amber-400/10 px-2 py-1 rounded-xl">
                            <button
                                type="button"
                                onClick={handlePrev}
                                aria-label={UI_TEXT.NOTICE.PREV_NOTICE_ARIA}
                                className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-colors cursor-pointer"
                            >
                                <ChevronLeft className="w-3.5 h-3.5"/>
                            </button>

                            <div className="flex items-center space-x-1 px-1">
                                {latestNotices.map((_, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={(e) => handleDotClick(e, idx)}
                                        aria-label={UI_TEXT.NOTICE.NOTICE_INDEX_ARIA(idx + 1)}
                                        className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                                            idx === currentIndex
                                                ? "w-4 bg-amber-600 dark:bg-amber-400"
                                                : "w-1.5 bg-amber-500/30 hover:bg-amber-500/50"
                                        }`}
                                    />
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={handleNext}
                                aria-label={UI_TEXT.NOTICE.NEXT_NOTICE_ARIA}
                                className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-colors cursor-pointer"
                            >
                                <ChevronRight className="w-3.5 h-3.5"/>
                            </button>
                        </div>
                    )}

                    {/* View All Button */}
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick();
                        }}
                        className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-black border border-amber-500/30 transition-all group-hover:bg-amber-500 group-hover:text-white group-hover:shadow-md group-hover:shadow-amber-500/20 cursor-pointer"
                    >
                        <span>{UI_TEXT.NOTICE.VIEW_ALL}</span>
                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1"/>
                    </div>
                </div>
            </div>
        </div>
    );
};
