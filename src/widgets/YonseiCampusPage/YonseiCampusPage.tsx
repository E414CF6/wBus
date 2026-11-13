"use client";

import React, {useCallback, useEffect, useMemo, useState, useSyncExternalStore} from "react";
import Link from "next/link";
import {useTheme} from "next-themes";
import {
    ArrowLeft,
    Bus,
    Calendar,
    CheckCircle2,
    Coffee,
    GraduationCap,
    Info,
    Moon,
    Settings,
    Sparkles,
    Sun,
    X,
} from "lucide-react";

import {NoticeBanner, NoticeModal} from "@entities/notice";
import {TARGET_ROUTE_NUMBERS} from "@entities/route";
import {type BusRoute, CacheInfoBanner, resolveActiveScheduleVariant, useSchedule,} from "@entities/schedule";
import {RouteScheduleModal} from "@features/map-view/RouteScheduleModal";
import {OnboardingModal} from "@features/onboarding";
import {SettingsModal} from "@features/settings";
import {resolveInitialCampusDirection} from "@shared/config/settingsCookie";
import {UI_TEXT} from "@shared/config/locale";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {isWeekend} from "@shared/lib/timeUtils";
import type {DayMode} from "@shared/types/navigation";
import {Footer} from "@shared/ui/Footer";
import {triggerHaptic} from "@shared/utils/haptics";

import type {CampusDirectionMode} from "./lib/yonseiShuttleUtils";
import {YonseiCityBusCard} from "./ui/YonseiCityBusCard";
import {YonseiShuttleSection} from "./ui/YonseiShuttleSection";
import {YonseiShuttleStopsSection} from "./ui/YonseiShuttleStopsSection";

const emptySubscribe = () => () => {
};

export function YonseiCampusPage() {
    const {settings} = useAppSettings();
    const [now, setNow] = useState<Date>(() => new Date());
    const [directionMode, setDirectionMode] = useState<CampusDirectionMode>(() =>
        resolveInitialCampusDirection(settings.yonseiDefaultDirection)
    );
    const [dayMode, setDayMode] = useState<DayMode>(settings.defaultDayMode);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Sync directionMode and dayMode when cookie settings change (render-phase state sync)
    const [prevDefaultDirection, setPrevDefaultDirection] = useState(settings.yonseiDefaultDirection);
    if (settings.yonseiDefaultDirection !== prevDefaultDirection) {
        setPrevDefaultDirection(settings.yonseiDefaultDirection);
        setDirectionMode(resolveInitialCampusDirection(settings.yonseiDefaultDirection, now));
    }

    const [prevDefaultDayMode, setPrevDefaultDayMode] = useState(settings.defaultDayMode);
    if (settings.defaultDayMode !== prevDefaultDayMode) {
        setPrevDefaultDayMode(settings.defaultDayMode);
        setDayMode(settings.defaultDayMode);
    }

    // Live clock update every 15 seconds
    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 15000);
        return () => clearInterval(timer);
    }, []);

    // Theme management
    const {setTheme, resolvedTheme} = useTheme();
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const isDark = mounted
        ? resolvedTheme === "dark" ||
          (typeof document !== "undefined" && document.documentElement.classList.contains("dark"))
        : false;

    const handleToggleTheme = useCallback(() => {
        triggerHaptic("light");
        const nextTheme = isDark ? "light" : "dark";
        setTheme(nextTheme);
        if (typeof document !== "undefined") {
            if (nextTheme === "dark") {
                document.documentElement.classList.add("dark");
                document.documentElement.style.colorScheme = "dark";
            } else {
                document.documentElement.classList.remove("dark");
                document.documentElement.style.colorScheme = "light";
            }
        }
    }, [isDark, setTheme]);

    const handleCycleDayMode = useCallback(() => {
        triggerHaptic("selection");
        setDayMode((prev) =>
            prev === "AUTO" ? "WEEKDAY" : prev === "WEEKDAY" ? "VACATION" : "AUTO"
        );
    }, []);

    const isTodayWeekendOrHoliday = useMemo(() => isWeekend(now), [now]);

    // Fetch Wonju bus schedule data
    const {
        routes,
        meta,
        isLoading,
        isRefreshing,
        refresh,
        refreshToast,
        clearRefreshToast,
    } = useSchedule(true);

    // Resolve active variant per target route (30, 34, 34-1)
    const routeScheduleMap = useMemo(() => {
        const map = new Map<string, BusRoute | null>();
        for (const routeNo of TARGET_ROUTE_NUMBERS) {
            const variants = routes.filter((r) => r.routeNo === routeNo);
            map.set(
                routeNo,
                resolveActiveScheduleVariant(variants, null, dayMode, isTodayWeekendOrHoliday)
            );
        }
        return map;
    }, [routes, dayMode, isTodayWeekendOrHoliday]);

    // Schedule modal state
    const [scheduleModalState, setScheduleModalState] = useState<{
        isOpen: boolean;
        routeName: string;
        location: "origin" | "dest";
    }>({
        isOpen: false,
        routeName: "30",
        location: "dest",
    });

    const handleOpenTimetable = useCallback((routeNo: string, location: "origin" | "dest") => {
        triggerHaptic("light");
        setScheduleModalState({
            isOpen: true,
            routeName: routeNo,
            location,
        });
    }, []);

    // Notice modal state
    const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
    const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);

    const handleOpenNoticeModal = useCallback((noticeId?: string) => {
        setSelectedNoticeId(noticeId || null);
        setIsNoticeModalOpen(true);
    }, []);

    const dayModeLabel =
        dayMode === "AUTO"
            ? `자동 (${isTodayWeekendOrHoliday ? "휴일" : "평일"})`
            : dayMode === "WEEKDAY"
                ? "평일 기준"
                : "휴일·방학";

    const currentTimeText = useMemo(() => {
        const hh = now.getHours().toString().padStart(2, "0");
        const mm = now.getMinutes().toString().padStart(2, "0");
        return `${hh}:${mm}`;
    }, [now]);

    return (
        <div className="h-dvh w-full overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors custom-scrollbar">
            {/* Sticky Header */}
            <header className="sticky top-0 z-40 bg-white/85 dark:bg-[#090d16]/85 backdrop-blur-2xl border-b border-slate-200/80 dark:border-white/10">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
                    {/* Left: Back to Map + Yonsei Brand */}
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Link
                            href="/?cityCode=32020"
                            className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 transition-colors shrink-0"
                            aria-label="실시간 지도로 돌아가기"
                            title="실시간 지도로 돌아가기"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-[#003876] flex items-center justify-center text-white shadow-xs shrink-0">
                                <GraduationCap className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-black text-sm sm:text-base tracking-tight text-slate-900 dark:text-white truncate">
                                        연세대학교 미래캠퍼스
                                    </span>
                                    <span className="hidden md:inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-[#003876]/10 dark:bg-blue-500/20 text-[#003876] dark:text-blue-300">
                                        교통 허브
                                    </span>
                                </div>
                                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                                    무료 셔틀버스 · 30 · 34 · 34-1번 실시간 운행 &amp; 시간표
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right: Direction Toggle + DayMode Toggle + Theme Toggle */}
                    <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
                        {/* One-Click Outbound / Inbound Mode Switcher */}
                        <div
                            className="flex items-center gap-0.5 p-0.5 rounded-full bg-slate-100 dark:bg-white/10 border border-black/5 dark:border-white/10"
                            role="group"
                            aria-label="등교 및 하교 모드 선택"
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic("selection");
                                    setDirectionMode("OUTBOUND");
                                }}
                                className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                                    directionMode === "OUTBOUND"
                                        ? "bg-[#003876] text-white shadow-xs"
                                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                하교 (학교 출발)
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic("selection");
                                    setDirectionMode("INBOUND");
                                }}
                                className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                                    directionMode === "INBOUND"
                                        ? "bg-indigo-600 text-white shadow-xs"
                                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                등교 (학교 도착)
                            </button>
                        </div>

                        {/* DayMode Cycle Pill */}
                        <button
                            type="button"
                            onClick={handleCycleDayMode}
                            title="운행 요일 기준 전환 (자동 / 평일 / 휴일·방학)"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200/80 dark:hover:bg-white/15 text-[11px] font-black text-slate-700 dark:text-slate-200 transition cursor-pointer active:scale-95 shrink-0"
                        >
                            {dayMode === "AUTO" && (
                                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            )}
                            {dayMode === "WEEKDAY" && (
                                <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            )}
                            {dayMode === "VACATION" && (
                                <Coffee className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            )}
                            <span className="hidden sm:inline whitespace-nowrap">{dayModeLabel}</span>
                        </button>

                        {/* Theme Toggle */}
                        <button
                            type="button"
                            onClick={handleToggleTheme}
                            aria-label={UI_TEXT.NAV.THEME_TOGGLE_LABEL}
                            className="p-2 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200/80 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 transition cursor-pointer active:scale-90 shrink-0"
                        >
                            {isDark ? (
                                <Moon className="w-4 h-4 text-blue-400" />
                            ) : (
                                <Sun className="w-4 h-4 text-amber-500" />
                            )}
                        </button>

                        {/* Settings Modal Trigger */}
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic("light");
                                setIsSettingsOpen(true);
                            }}
                            aria-label="환경설정 열기"
                            title="환경설정"
                            className="p-2 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200/80 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 transition cursor-pointer active:scale-90 shrink-0"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-6">
                {/* Toast Message Notification */}
                {refreshToast && (
                    <div
                        className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between transition-all shadow-sm ${
                            refreshToast.type === "success"
                                ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
                                : refreshToast.type === "error"
                                    ? "bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-200"
                                    : "bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-500/40 text-blue-800 dark:text-blue-200"
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            {refreshToast.type === "success" ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                                <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                            )}
                            <span className="text-xs sm:text-sm font-semibold">
                                {refreshToast.message}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={clearRefreshToast}
                            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 cursor-pointer"
                            aria-label="알림 닫기"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Criteria & Live Notice Banners */}
                <div className="space-y-3">
                    <CacheInfoBanner
                        meta={meta}
                        onRefresh={() => refresh(true)}
                        isRefreshing={isRefreshing}
                        variant="banner"
                    />
                    <NoticeBanner onClick={handleOpenNoticeModal} />
                </div>

                {/* Section 1: City Bus 30, 34, 34-1 Live & Next Departures */}
                <section className="space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                        <div className="flex items-center gap-2">
                            <Bus className="w-5 h-5 text-[#003876] dark:text-blue-400" />
                            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                캠퍼스 경유 시내버스 (30 · 34 · 34-1번)
                            </h2>
                        </div>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            {directionMode === "OUTBOUND"
                                ? "기준: 연세대·회촌 출발 시각 (하교)"
                                : "기준: 장양리 기점 출발 시각 (등교)"}
                        </span>
                    </div>

                    {isLoading && routes.length === 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className="rounded-3xl p-5 space-y-4 animate-pulse bg-white/80 dark:bg-[#111520]/80 border border-slate-200/80 dark:border-white/10"
                                >
                                    <div className="h-7 w-1/3 bg-slate-200 dark:bg-white/10 rounded-xl" />
                                    <div className="h-4 w-2/3 bg-slate-200 dark:bg-white/10 rounded" />
                                    <div className="h-24 w-full bg-slate-200 dark:bg-white/10 rounded-2xl" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {TARGET_ROUTE_NUMBERS.map((routeNo) => (
                                <YonseiCityBusCard
                                    key={routeNo}
                                    routeNo={routeNo}
                                    scheduleRoute={routeScheduleMap.get(routeNo) ?? null}
                                    directionMode={directionMode}
                                    now={now}
                                    onOpenTimetable={handleOpenTimetable}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* Section 2: Free Shuttle Bus Timetable & Search */}
                <YonseiShuttleSection
                    directionMode={directionMode}
                    onDirectionModeChange={setDirectionMode}
                    dayMode={dayMode}
                    now={now}
                />

                {/* Section 3: Shuttle Stop Guide & Interactive MiniMap */}
                <YonseiShuttleStopsSection directionMode={directionMode} />

                {/* Footer */}
                <Footer />
            </main>

            {/* Full City Bus Timetable Modal */}
            <RouteScheduleModal
                isOpen={scheduleModalState.isOpen}
                routeName={scheduleModalState.routeName}
                onClose={() =>
                    setScheduleModalState((prev) => ({
                        ...prev,
                        isOpen: false,
                    }))
                }
                dayMode={dayMode}
                isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                initialLocation={scheduleModalState.location}
            />

            {/* Wonju ITS Notice Modal */}
            <NoticeModal
                isOpen={isNoticeModalOpen}
                onClose={() => {
                    setIsNoticeModalOpen(false);
                    setSelectedNoticeId(null);
                }}
                initialNoticeId={selectedNoticeId}
            />

            {/* Cookie-backed Settings Modal */}
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />

            {/* First-Visit Onboarding Modal */}
            <OnboardingModal />
        </div>
    );
}

export default YonseiCampusPage;
