"use client";

import {BusRoute, CacheMetadata, DayMode} from "@/types/bus";
import {CommentItem} from "@/types/comment";

import {TARGET_ROUTE_NUMBERS} from "@data/yonseiRoutes";

import {isWeekend, selectRouteVariant} from "@lib/timeUtils";

import {Header} from "@components/Header";
import {RouteCard} from "@components/RouteCard";
import {RouteDetailModal} from "@components/RouteDetailModal";
import {NoticeBanner} from "@components/NoticeBanner";
import {NoticeModal} from "@components/NoticeModal";
import {CacheInfoBanner} from "@components/CacheInfoBanner";
import {CommentsModal} from "@components/CommentsModal";
import {Footer} from "@components/Footer";

import React, {useCallback, useEffect, useMemo, useState} from "react";
import {CheckCircle2, Info, MessageSquare, X} from "lucide-react";

export default function YonseiTimetablePage() {
    const [routes, setRoutes] = useState<BusRoute[]>([]);
    const [meta, setMeta] = useState<CacheMetadata | null>(null);
    const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Modals state
    const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false);
    const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
    const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);

    const [comments, setComments] = useState<CommentItem[]>([]);
    const [isRefreshingComments, setIsRefreshingComments] = useState<boolean>(false);
    const [toastNotice, setToastNotice] = useState<{
        type: "success" | "info" | "error";
        message: string;
    } | null>(null);

    const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
    const [dayMode, setDayMode] = useState<DayMode>("AUTO");
    const [selectedRoute, setSelectedRoute] = useState<BusRoute | null>(null);

    // Update live clock for departure time calculations every 10 seconds
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 10000);
        return () => clearInterval(timer);
    }, []);

    // Load cached meta from localStorage
    useEffect(() => {
        try {
            const savedMeta = localStorage.getItem("yonsei_last_meta");
            if (savedMeta) {
                const parsedMeta = JSON.parse(savedMeta);
                if (parsedMeta && parsedMeta.updatedAt) {
                    setMeta((prev) => (prev ? {...prev, ...parsedMeta} : parsedMeta));
                }
            }
        } catch {
            // Ignore
        }
    }, []);

    // Fetch latest schedule data on mount
    const fetchScheduleData = useCallback(async () => {
        setIsLoadingSchedule(true);
        try {
            const res = await fetch(`/api/schedule?t=${Date.now()}`, {
                cache: "no-store",
                headers: {"Cache-Control": "no-cache"},
            });
            const json = await res.json();
            if (json.success) {
                if (json.data && Array.isArray(json.data.routes)) {
                    setRoutes(json.data.routes);
                }
                if (json.meta) {
                    setMeta(json.meta);
                    try {
                        localStorage.setItem("yonsei_last_meta", JSON.stringify(json.meta));
                    } catch {
                        // Ignore
                    }
                }
            }
        } catch (err) {
            console.warn("Failed to fetch current schedule:", err);
        } finally {
            setIsLoadingSchedule(false);
        }
    }, []);

    useEffect(() => {
        fetchScheduleData();
    }, [fetchScheduleData]);

    // Load comments from API (strictly recent 24 hours)
    const fetchComments = useCallback(async (force = false) => {
        setIsRefreshingComments(true);
        try {
            const res = await fetch(
                `/api/comments?force=${force ? "true" : "false"}&t=${Date.now()}`,
                {
                    cache: "no-store",
                    headers: {"Cache-Control": "no-cache"},
                }
            );
            const json = await res.json();
            if (json.success && Array.isArray(json.comments)) {
                setComments(json.comments);
            }
        } catch (err) {
            console.warn("Failed to fetch comments:", err);
        } finally {
            setIsRefreshingComments(false);
        }
    }, []);

    useEffect(() => {
        fetchComments(false);
    }, [fetchComments]);

    // Fetch or refresh schedule from Wonju ITS API
    const handleRefreshSchedule = async (force = true) => {
        setIsRefreshing(true);
        setToastNotice(null);
        try {
            const endpoint = force
                ? `/api/schedule/refresh?force=true&t=${Date.now()}`
                : `/api/schedule?t=${Date.now()}`;
            const method = force ? "POST" : "GET";

            const res = await fetch(endpoint, {
                method,
                cache: "no-store",
                headers: {"Cache-Control": "no-cache"},
            });
            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error || "시간표 정보를 불러오는 데 실패했습니다.");
            }

            if (json.data && Array.isArray(json.data.routes)) {
                setRoutes(json.data.routes);
            }
            if (json.meta) {
                setMeta(json.meta);
                try {
                    localStorage.setItem("yonsei_last_meta", JSON.stringify(json.meta));
                } catch {
                    // Ignore
                }
            }

            if (force) {
                setToastNotice({
                    type: json.refreshed ? "success" : "info",
                    message:
                        json.message ||
                        (json.refreshed
                            ? "최신 시간표를 성공적으로 가져왔습니다."
                            : "기존 저장된 최신 시간표를 유지합니다."),
                });
            }
        } catch (err) {
            setToastNotice({
                type: "error",
                message:
                    err instanceof Error
                        ? err.message
                        : "시간표 갱신 중 오류가 발생했습니다.",
            });
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleAddComment = async (data: {
        author?: string;
        content: string;
        routeNo?: string;
        category?: string;
    }) => {
        const res = await fetch("/api/comments", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!json.success) {
            throw new Error(json.error || "댓글 등록에 실패했습니다.");
        }
        if (json.comment) {
            setComments((prev) => [json.comment, ...prev]);
        }
    };

    const handleLikeComment = async (id: string) => {
        try {
            const res = await fetch("/api/comments", {
                method: "PATCH",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({id, action: "like"}),
            });
            const json = await res.json();
            if (json.success && json.comment) {
                setComments((prev) =>
                    prev.map((c) => (c.id === id ? json.comment : c))
                );
            }
        } catch (err) {
            console.warn("Failed to like comment:", err);
        }
    };

    const handleOpenNoticeModal = (noticeId?: string) => {
        setSelectedNoticeId(noticeId || null);
        setIsNoticeModalOpen(true);
    };

    // Check if today is actual weekend
    const isTodayWeekendOrHoliday = useMemo(() => {
        return isWeekend(currentTime);
    }, [currentTime]);

    // Effective holiday flag taking DayMode into account
    const effectiveIsHoliday = useMemo(() => {
        if (dayMode === "WEEKDAY") return false;
        if (dayMode === "VACATION") return true;
        return isTodayWeekendOrHoliday;
    }, [dayMode, isTodayWeekendOrHoliday]);

    // Pair each target routeNo (30, 34, 34-1) with its matching active schedule variant
    const activeRoutes = useMemo(() => {
        const list: BusRoute[] = [];
        for (const rNo of TARGET_ROUTE_NUMBERS) {
            const route = selectRouteVariant(routes, rNo, effectiveIsHoliday);
            if (route) {
                list.push(route);
            }
        }
        return list;
    }, [routes, effectiveIsHoliday]);

    return (
        <main
            className="min-h-screen w-full flex flex-col justify-center items-center py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
            {/* Centered Dashboard Container */}
            <div className="w-full max-w-6xl flex flex-col justify-center my-auto">
                {/* Top Header with Day Mode Switcher, Notice, Talk & Theme Toggle */}
                <Header
                    dayMode={dayMode}
                    onDayModeChange={setDayMode}
                    isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                    onOpenNoticeModal={() => handleOpenNoticeModal()}
                    onOpenCommentsModal={() => setIsCommentsModalOpen(true)}
                    commentCount={comments.length}
                />

                {/* Toast Message Notification */}
                {toastNotice && (
                    <div
                        className={`p-3.5 sm:p-4 mb-5 rounded-2xl border flex items-center justify-between transition-all animate-fadeIn shadow-sm ${
                            toastNotice.type === "success"
                                ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
                                : toastNotice.type === "error"
                                    ? "bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-200"
                                    : "bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-500/40 text-blue-800 dark:text-blue-200"
                        }`}
                    >
                        <div className="flex items-center space-x-2.5">
                            {toastNotice.type === "success" ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"/>
                            ) : (
                                <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"/>
                            )}
                            <span className="text-xs sm:text-sm font-semibold">
                                {toastNotice.message}
                            </span>
                        </div>
                        <button
                            onClick={() => setToastNotice(null)}
                            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors shrink-0 ml-2 cursor-pointer"
                            title="닫기"
                        >
                            <X className="h-4 w-4"/>
                        </button>
                    </div>
                )}

                {/* Wonju ITS Live Notice Banner (Date-sorted, latest first) */}
                <NoticeBanner onOpenNoticeModal={handleOpenNoticeModal}/>

                {/* 3 Route Cards Grid (30, 34, 34-1) */}
                {isLoadingSchedule && activeRoutes.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-4">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="glass-panel rounded-3xl p-6 space-y-4 animate-pulse"
                            >
                                <div className="h-8 w-1/3 bg-slate-200 dark:bg-white/10 rounded-xl"/>
                                <div className="h-4 w-2/3 bg-slate-200 dark:bg-white/10 rounded-md"/>
                                <div className="h-24 w-full bg-slate-200 dark:bg-white/10 rounded-2xl"/>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-4">
                        {activeRoutes.map((route) => (
                            <RouteCard
                                key={route.id}
                                route={route}
                                currentTime={currentTime}
                                onOpenModal={setSelectedRoute}
                            />
                        ))}
                    </div>
                )}

                {/* Timetable Criteria & Refresh Banner (Above Footer) */}
                <CacheInfoBanner
                    meta={meta}
                    onRefresh={() => handleRefreshSchedule(true)}
                    isRefreshing={isRefreshing}
                />

                {/* Minimal Footer */}
                <Footer/>
            </div>

            {/* Floating Action Button (FAB) for Comments / Chat */}
            <button
                type="button"
                onClick={() => setIsCommentsModalOpen(true)}
                className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer border border-white/20"
                title="실시간 버스 톡 & 메모"
            >
                <div className="relative">
                    <MessageSquare className="w-4 h-4"/>
                    {comments.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping"/>
                    )}
                </div>
                <span>실시간 톡</span>
                {comments.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-white text-blue-600 text-[11px] font-black shadow-xs">
                        {comments.length}
                    </span>
                )}
            </button>

            {/* Detailed Timetable Modal */}
            {selectedRoute && (
                <RouteDetailModal
                    route={selectedRoute}
                    allRoutes={routes}
                    onClose={() => setSelectedRoute(null)}
                    currentTime={currentTime}
                />
            )}

            {/* Dedicated Comments Modal */}
            <CommentsModal
                isOpen={isCommentsModalOpen}
                onClose={() => setIsCommentsModalOpen(false)}
                comments={comments}
                onAddComment={handleAddComment}
                onLikeComment={handleLikeComment}
                onRefresh={fetchComments}
                isRefreshing={isRefreshingComments}
            />

            {/* Wonju ITS Notice Center Modal */}
            <NoticeModal
                isOpen={isNoticeModalOpen}
                onClose={() => {
                    setIsNoticeModalOpen(false);
                    setSelectedNoticeId(null);
                }}
                initialNoticeId={selectedNoticeId}
            />
        </main>
    );
}
