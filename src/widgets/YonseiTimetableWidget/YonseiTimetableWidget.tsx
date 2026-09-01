"use client";

import React, {useCallback, useEffect, useMemo, useState} from "react";
import {BusRoute, CacheMetadata, RouteDataset} from "@shared/types/bus";
import {YonseiRouteCard} from "./YonseiRouteCard";
import {YonseiRouteDetailModal} from "./YonseiRouteDetailModal";
import {YonseiShuttleCard} from "./YonseiShuttleCard";
import {YonseiShuttleModal} from "./YonseiShuttleModal";
import {NoticeBanner, NoticeModal} from "@widgets/NoticeWidget";
import {CacheInfoBanner} from "@widgets/TimetableWidget/CacheInfoBanner";
import {Footer} from "@shared/ui/Footer";
import {TARGET_ROUTE_NUMBERS} from "@/data/yonseiRoutes";
import {selectRouteVariant} from "@shared/lib/timeUtils";
import {STORAGE_KEYS} from "@shared/config/env";
import {CheckCircle2, Info, X} from "lucide-react";

interface YonseiTimetableWidgetProps {
    onSelectMapRoute?: (routeName: string) => void;
    isEmbedded?: boolean;
    dayMode?: "AUTO" | "WEEKDAY" | "VACATION";
    onDayModeChange?: (mode: "AUTO" | "WEEKDAY" | "VACATION") => void;
}

export default function YonseiTimetableWidget({
                                                  onSelectMapRoute,
                                                  isEmbedded: _isEmbedded = false,
                                                  dayMode: externalDayMode,
                                                  onDayModeChange: _onDayModeChange,
                                              }: YonseiTimetableWidgetProps) {
    const [routes, setRoutes] = useState<BusRoute[]>([]);
    const [meta, setMeta] = useState<CacheMetadata | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

    // Internal dayMode if not controlled externally
    const [internalDayMode] = useState<"AUTO" | "WEEKDAY" | "VACATION">("AUTO");
    const dayMode = externalDayMode ?? internalDayMode;

    // Toast notification state
    const [toastNotice, setToastNotice] = useState<{
        type: "success" | "info" | "error";
        message: string;
    } | null>(null);

    // Modals
    const [selectedRoute, setSelectedRoute] = useState<BusRoute | null>(null);
    const [isShuttleModalOpen, setIsShuttleModalOpen] = useState<boolean>(false);
    const [isNoticeModalOpen, setIsNoticeModalOpen] = useState<boolean>(false);
    const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);

    // Instant initial load from browser persistent cache (localStorage)
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.SCHEDULE_CACHE);
            if (raw) {
                const parsed: { data: RouteDataset; meta: CacheMetadata } = JSON.parse(raw);
                if (parsed?.data?.routes?.length) {
                    setRoutes(parsed.data.routes);
                    setMeta(parsed.meta || null);
                    setIsLoading(false);
                }
            }
        } catch {
            // Ignore corrupted local cache
        }
    }, []);

    // Live clock update
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 10000);
        return () => clearInterval(timer);
    }, []);

    // Fetch timetable schedule with HTTP browser cache & persistent storage sync
    const fetchScheduleData = useCallback(async (force = false) => {
        if (force) {
            setIsRefreshing(true);
        }

        try {
            const endpoint = force ? "/api/schedule/refresh?force=true" : "/api/schedule";
            const method = force ? "POST" : "GET";

            const res = await fetch(endpoint, {
                method,
                ...(force ? {cache: "no-store", headers: {"Cache-Control": "no-cache"}} : {}),
            });

            if (res.status === 304) {
                // Not modified - browser / local cache is perfectly up to date
                setIsLoading(false);
                if (force) setIsRefreshing(false);
                return;
            }

            const json = await res.json();

            if (!json.success || !json.data) {
                throw new Error(json.error || "시간표 데이터를 불러올 수 없습니다.");
            }

            const dataset: RouteDataset = json.data;
            const updatedMeta: CacheMetadata = json.meta || null;
            setRoutes(dataset.routes || []);
            setMeta(updatedMeta);

            // Persist to browser localStorage
            try {
                localStorage.setItem(
                    STORAGE_KEYS.SCHEDULE_CACHE,
                    JSON.stringify({data: dataset, meta: updatedMeta})
                );
            } catch {
                // Storage quota limit fallback
            }

            if (force) {
                if (json.refreshed) {
                    setToastNotice({
                        type: "success",
                        message: json.message || "원주시 ITS 실시간 최신 시간표로 갱신되었습니다.",
                    });
                } else {
                    setToastNotice({
                        type: "info",
                        message: json.message || "최신 시간표가 이미 유지되고 있습니다.",
                    });
                }
            }
        } catch (err) {
            // If network fails but we already have routes loaded from cache, don't break UI
            if (routes.length === 0) {
                setToastNotice({
                    type: "error",
                    message: err instanceof Error ? err.message : "시간표 데이터를 불러오는데 실패했습니다.",
                });
            }
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [routes.length]);

    useEffect(() => {
        fetchScheduleData(false);
    }, [fetchScheduleData]);

    const isTodayWeekendOrHoliday = useMemo(() => {
        const day = currentTime.getDay();
        return day === 0 || day === 6;
    }, [currentTime]);

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

    const handleOpenNoticeModal = (noticeId?: string) => {
        setSelectedNoticeId(noticeId || null);
        setIsNoticeModalOpen(true);
    };

    return (
        <div className="w-full flex flex-col gap-4 sm:gap-6 animate-fadeIn">
            {/* Toast Message Notification */}
            {toastNotice && (
                <div
                    className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between transition-all animate-fadeIn shadow-sm shrink-0 ${
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
                        <span className="text-xs sm:text-sm font-semibold leading-relaxed">
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

            {/* Wonju ITS Live Notice Banner */}
            <NoticeBanner onClick={handleOpenNoticeModal}/>

            {/* 3 Route Cards Grid (30, 34, 34-1) */}
            {isLoading && activeRoutes.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="glass-panel rounded-3xl p-6 space-y-4 animate-pulse backdrop-blur-2xl bg-white/75 dark:bg-[#111622]/80 border border-slate-200/80 dark:border-white/10"
                        >
                            <div className="h-8 w-1/3 bg-slate-200 dark:bg-white/10 rounded-xl"/>
                            <div className="h-4 w-2/3 bg-slate-200 dark:bg-white/10 rounded-md"/>
                            <div className="h-24 w-full bg-slate-200 dark:bg-white/10 rounded-2xl"/>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                    {activeRoutes.map((route) => (
                        <YonseiRouteCard
                            key={route.id}
                            route={route}
                            currentTime={currentTime}
                            onSelectRoute={setSelectedRoute}
                            onSelectMapRoute={onSelectMapRoute}
                        />
                    ))}
                </div>
            )}

            {/* Free Shuttle Bus Card (Yeoju / Wonju <-> Yonsei Mirae Campus) */}
            <YonseiShuttleCard
                onOpenModal={() => setIsShuttleModalOpen(true)}
                currentTime={currentTime}
            />

            {/* Timetable Criteria & Refresh Banner */}
            <CacheInfoBanner
                meta={meta}
                onRefresh={() => fetchScheduleData(true)}
                isRefreshing={isRefreshing}
            />

            {/* Minimal Footer */}
            <Footer/>

            {/* Detailed Timetable Modal */}
            {selectedRoute && (
                <YonseiRouteDetailModal
                    route={selectedRoute}
                    allYonseiRoutes={routes}
                    onClose={() => setSelectedRoute(null)}
                    onSelectMapRoute={onSelectMapRoute}
                    currentTime={currentTime}
                />
            )}

            {/* Detailed Free Shuttle Bus Modal */}
            <YonseiShuttleModal
                isOpen={isShuttleModalOpen}
                onClose={() => setIsShuttleModalOpen(false)}
                currentTime={currentTime}
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
        </div>
    );
}

export {YonseiTimetableWidget};
