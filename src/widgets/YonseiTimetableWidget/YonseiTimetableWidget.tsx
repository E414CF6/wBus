"use client";

import React, {useEffect, useMemo, useState} from "react";
import {CheckCircle2, Info, X} from "lucide-react";

import {BusRoute} from "@shared/types/bus";

import {YonseiRouteCard} from "./YonseiRouteCard";
import {YonseiRouteDetailModal} from "./YonseiRouteDetailModal";
import {YonseiShuttleCard} from "./YonseiShuttleCard";
import {YonseiShuttleModal} from "./YonseiShuttleModal";

import type {ShuttleTab} from "./types";

import {NoticeBanner, NoticeModal} from "@widgets/NoticeWidget";
import {CacheInfoBanner} from "@widgets/TimetableWidget/CacheInfoBanner";

import {TARGET_ROUTE_NUMBERS} from "@/data/yonseiRoutes";

import {Footer} from "@shared/ui/Footer";
import {selectRouteVariant} from "@shared/lib/timeUtils";

import {useSchedule} from "@entities/schedule/hooks";

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
    const {routes, meta, isLoading, isRefreshing, refresh, refreshToast, clearRefreshToast} = useSchedule();
    const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

    // Internal dayMode if not controlled externally
    const [internalDayMode] = useState<"AUTO" | "WEEKDAY" | "VACATION">("AUTO");
    const dayMode = externalDayMode ?? internalDayMode;

    // Modals
    const [selectedRoute, setSelectedRoute] = useState<BusRoute | null>(null);
    const [isShuttleModalOpen, setIsShuttleModalOpen] = useState<boolean>(false);
    const [shuttleModalInitialTab, setShuttleModalInitialTab] = useState<ShuttleTab>("inbound");
    const [isNoticeModalOpen, setIsNoticeModalOpen] = useState<boolean>(false);
    const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);

    // Live clock update
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 10000);
        return () => clearInterval(timer);
    }, []);

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
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-4 sm:gap-6 animate-fadeIn md:my-auto">
            {/* Toast Message Notification */}
            {refreshToast && (
                <div
                    className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between transition-all animate-fadeIn shadow-sm shrink-0 ${
                        refreshToast.type === "success"
                            ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
                            : refreshToast.type === "error"
                                ? "bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-200"
                                : "bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-500/40 text-blue-800 dark:text-blue-200"
                    }`}
                >
                    <div className="flex items-center space-x-2.5">
                        {refreshToast.type === "success" ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"/>
                        ) : (
                            <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"/>
                        )}
                        <span className="text-xs sm:text-sm font-semibold leading-relaxed">
                            {refreshToast.message}
                        </span>
                    </div>
                    <button
                        onClick={clearRefreshToast}
                        className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors shrink-0 ml-2 cursor-pointer"
                        title="닫기"
                    >
                        <X className="h-4 w-4"/>
                    </button>
                </div>
            )}

            {/* Timetable Criteria & Refresh Banner */}
            <CacheInfoBanner
                meta={meta}
                onRefresh={() => refresh(true)}
                isRefreshing={isRefreshing}
                variant="banner"
            />

            {/* Wonju ITS Live Notice Banner */}
            <NoticeBanner onClick={handleOpenNoticeModal}/>

            {/* Free Shuttle Bus Card (Yeoju / Wonju <-> Yonsei Mirae Campus) */}
            <YonseiShuttleCard
                onOpenModal={(tab?: ShuttleTab) => {
                    setShuttleModalInitialTab(tab || "inbound");
                    setIsShuttleModalOpen(true);
                }}
                currentTime={currentTime}
            />

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
                initialTab={shuttleModalInitialTab}
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
