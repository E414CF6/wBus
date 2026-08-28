"use client";

import React, {useCallback, useEffect, useState} from "react";
import {ChevronLeft, ChevronRight, Megaphone} from "lucide-react";

import {NoticeItem} from "@/types/notice";

interface NoticeBannerProps {
    onOpenNoticeModal: (noticeId?: string) => void;
}

export const NoticeBanner: React.FC<NoticeBannerProps> = ({
                                                              onOpenNoticeModal,
                                                          }) => {
    const [notices, setNotices] = useState<NoticeItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch notices from API and sort strictly by date (latest first)
    useEffect(() => {
        let isCancelled = false;
        const fetchNotices = async () => {
            try {
                const res = await fetch("/api/notice?page=1");
                const json = await res.json();
                if (!isCancelled && json.success && json.data) {
                    const list: NoticeItem[] = json.data.notices || [];

                    // Sort purely by date descending, then by id descending (newest first, ignoring pin priority)
                    const dateSorted = [...list].sort((a, b) => {
                        const dateA = a.date || "";
                        const dateB = b.date || "";
                        if (dateA !== dateB) {
                            return dateB.localeCompare(dateA);
                        }
                        return (parseInt(b.id, 10) || 0) - (parseInt(a.id, 10) || 0);
                    });

                    setNotices(dateSorted.slice(0, 5)); // Take top 5 newest
                }
            } catch (err) {
                console.warn("Failed to fetch notice banner:", err);
            } finally {
                if (!isCancelled) setIsLoading(false);
            }
        };
        fetchNotices();
        return () => {
            isCancelled = true;
        };
    }, []);

    const handleNext = useCallback(() => {
        if (notices.length <= 1) return;
        setCurrentIndex((prev) => (prev + 1) % notices.length);
    }, [notices.length]);

    const handlePrev = useCallback(() => {
        if (notices.length <= 1) return;
        setCurrentIndex((prev) => (prev - 1 + notices.length) % notices.length);
    }, [notices.length]);

    // Auto advance every 6 seconds
    useEffect(() => {
        if (notices.length <= 1) return;
        const timer = setInterval(() => {
            handleNext();
        }, 6000);
        return () => clearInterval(timer);
    }, [notices.length, handleNext]);

    const currentNotice = notices[currentIndex];

    return (
        <div
            onClick={() => onOpenNoticeModal(currentNotice?.id)}
            className="backdrop-blur-xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 dark:from-amber-500/15 dark:via-orange-500/10 dark:to-amber-500/15 rounded-3xl p-4 sm:p-5 border border-amber-500/30 shadow-xs hover:shadow-md transition-all duration-300 relative overflow-hidden group cursor-pointer select-none"
        >
            {/* Decorative Glow */}
            <div
                className="absolute -right-8 -bottom-8 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"/>

            <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Left Side: Icon + Headline */}
                <div className="flex items-start sm:items-center space-x-3 min-w-0 flex-1">
                    <div
                        className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25 shrink-0 group-hover:scale-105 transition-transform">
                        <Megaphone className="w-4 h-4 stroke-[2.5]"/>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                                원주시 교통정보 알림마당
                            </span>
                            {currentNotice?.date && (
                                <span
                                    className="text-[10px] font-bold text-amber-700/80 dark:text-amber-400/80 font-mono">
                                    {currentNotice.date}
                                </span>
                            )}
                        </div>

                        {isLoading ? (
                            <div className="h-4 w-60 bg-amber-500/15 rounded-md animate-pulse my-0.5"/>
                        ) : currentNotice ? (
                            <div className="flex items-center space-x-2 min-w-0">
                                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                    {currentNotice.title}
                                </h3>
                            </div>
                        ) : (
                            <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                                원주시 교통정보센터 최신 소식
                            </h3>
                        )}
                    </div>
                </div>

                {/* Right Side: Carousel Navigation + View All Button */}
                <div
                    className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-500/10">
                    {notices.length > 1 && (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center space-x-1 bg-amber-500/10 dark:bg-amber-400/10 px-1.5 py-0.5 rounded-xl"
                        >
                            <button
                                type="button"
                                onClick={handlePrev}
                                aria-label="이전 공지"
                                className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-colors cursor-pointer"
                            >
                                <ChevronLeft className="w-3 h-3"/>
                            </button>

                            <div className="flex items-center space-x-1 px-1">
                                {notices.map((_, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setCurrentIndex(idx)}
                                        className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                                            idx === currentIndex
                                                ? "w-3.5 bg-amber-600 dark:bg-amber-400"
                                                : "w-1.5 bg-amber-500/30 hover:bg-amber-500/50"
                                        }`}
                                    />
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={handleNext}
                                aria-label="다음 공지"
                                className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-colors cursor-pointer"
                            >
                                <ChevronRight className="w-3 h-3"/>
                            </button>
                        </div>
                    )}

                    <div
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-amber-500/15 group-hover:bg-amber-500 text-amber-700 group-hover:text-white dark:text-amber-300 text-xs font-black border border-amber-500/30 transition-all shadow-2xs group-hover:shadow-sm">
                        <span>전체보기</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"/>
                    </div>
                </div>
            </div>
        </div>
    );
};
