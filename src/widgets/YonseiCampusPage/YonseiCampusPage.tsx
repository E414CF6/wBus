"use client";

import React, {useCallback, useEffect, useMemo, useState, useSyncExternalStore} from "react";
import {useTheme} from "next-themes";
import {
    AlertCircle,
    ArrowDownLeft,
    ArrowRight,
    ArrowUpRight,
    Bus,
    Calendar,
    Clock,
    GraduationCap,
    Info,
    MapPin,
    Moon,
    Sun,
    Table2,
} from "lucide-react";

import {TARGET_ROUTE_NUMBERS} from "@entities/route";
import {
    type BusRoute,
    getStaticYonseiBusRoutes,
    selectRouteVariant,
    YONSEI_SHUTTLE_SCHEDULE,
} from "@entities/schedule";
import {UI_TEXT} from "@shared/config/locale";
import {isWeekend} from "@shared/lib/timeUtils";
import type {DayMode} from "@shared/types/navigation";
import {Footer} from "@shared/ui/Footer";
import {triggerHaptic} from "@shared/utils/haptics";

import {type CampusDirectionMode, getNextShuttleDepartures} from "./lib/yonseiShuttleUtils";
import {CityBusTimetableModal} from "./ui/CityBusTimetableModal";
import {FloatingBottomNav} from "./ui/FloatingBottomNav";
import {SettingsModal} from "./ui/SettingsModal";
import {ShuttleStopsModal} from "./ui/ShuttleStopsModal";
import {ShuttleTimetableModal} from "./ui/ShuttleTimetableModal";
import {YonseiCityBusCard} from "./ui/YonseiCityBusCard";

const emptySubscribe = () => () => {};
const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function getDefaultDirection(now: Date): CampusDirectionMode {
    return now.getHours() < 12 ? "INBOUND" : "OUTBOUND";
}

function formatHeaderClock(date: Date): string {
    const hh = date.getHours().toString().padStart(2, "0");
    const mm = date.getMinutes().toString().padStart(2, "0");
    const dayName = KOREAN_WEEKDAYS[date.getDay()];
    return `${hh}:${mm} (${dayName})`;
}

function getShuttleWaitBadge(waitMins: number): {
    pillClass: string;
    dotClass: string | null;
    label: string;
} {
    if (waitMins <= 10) {
        return {
            pillClass: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30 font-black",
            dotClass: "bg-rose-500",
            label: waitMins === 0 ? "곧 출발" : `${waitMins}분 후`,
        };
    }
    if (waitMins <= 30) {
        return {
            pillClass:
                "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-black",
            dotClass: null,
            label: `${waitMins}분 후`,
        };
    }
    return {
        pillClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25 font-extrabold",
        dotClass: null,
        label: `${waitMins}분 후`,
    };
}

export function YonseiCampusPage() {
    const [now, setNow] = useState<Date>(() => new Date());
    const [directionMode, setDirectionMode] = useState<CampusDirectionMode>(() =>
        getDefaultDirection(new Date())
    );
    const [dayMode, setDayMode] = useState<DayMode>("AUTO");

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
        setTheme(isDark ? "light" : "dark");
    }, [isDark, setTheme]);

    const isTodayWeekendOrHoliday = useMemo(() => isWeekend(now), [now]);
    const isHolidayOrVacation = useMemo(() => {
        if (dayMode === "WEEKDAY") return false;
        if (dayMode === "VACATION") return true;
        return isTodayWeekendOrHoliday;
    }, [dayMode, isTodayWeekendOrHoliday]);

    const allRoutes = useMemo(() => getStaticYonseiBusRoutes(), []);

    const routeScheduleMap = useMemo(() => {
        const map = new Map<string, BusRoute | null>();
        for (const routeNo of TARGET_ROUTE_NUMBERS) {
            if (routeNo === "30") {
                const variants = allRoutes.filter((r) => r.routeNo === "30");
                const targetDayType = isHolidayOrVacation ? "방학,휴일" : "평일";
                map.set("30", variants.find((v) => v.dayType === targetDayType) ?? variants[0] ?? null);
            } else {
                map.set(routeNo, selectRouteVariant(allRoutes, routeNo, isHolidayOrVacation));
            }
        }
        return map;
    }, [allRoutes, isHolidayOrVacation]);

    const {dayType: shuttleDayType, nextInbound, nextOutbound} = useMemo(
        () => getNextShuttleDepartures(YONSEI_SHUTTLE_SCHEDULE, dayMode, now),
        [dayMode, now]
    );

    // Modal states
    const [cityModalState, setCityModalState] = useState<{
        isOpen: boolean;
        routeNo: string;
        location: "origin" | "dest";
    }>({
        isOpen: false,
        routeNo: "30",
        location: "dest",
    });

    const [shuttleModalState, setShuttleModalState] = useState<{
        isOpen: boolean;
        tab: "OUTBOUND" | "INBOUND" | "GUIDELINES";
    }>({
        isOpen: false,
        tab: "OUTBOUND",
    });

    const [isStopsModalOpen, setIsStopsModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    const handleOpenCityTimetable = useCallback((routeNo: string, location: "origin" | "dest") => {
        triggerHaptic("light");
        setCityModalState({
            isOpen: true,
            routeNo,
            location,
        });
    }, []);

    const handleOpenShuttleModal = useCallback((tab: "OUTBOUND" | "INBOUND" | "GUIDELINES") => {
        triggerHaptic("light");
        setShuttleModalState({
            isOpen: true,
            tab,
        });
    }, []);

    const activeModal: "city" | "shuttle" | "stops" | "settings" | null = cityModalState.isOpen
        ? "city"
        : shuttleModalState.isOpen
            ? "shuttle"
            : isStopsModalOpen
                ? "stops"
                : isSettingsModalOpen
                    ? "settings"
                    : null;

    const dayModeBadgeLabel =
        dayMode === "AUTO"
            ? `자동 (${isTodayWeekendOrHoliday ? "휴일" : "평일"})`
            : dayMode === "WEEKDAY"
              ? UI_TEXT.YONSEI.MODE_WEEKDAY
              : UI_TEXT.YONSEI.MODE_VACATION;

    const outboundWait = nextOutbound ? getShuttleWaitBadge(nextOutbound.waitMins) : null;
    const inboundWait = nextInbound ? getShuttleWaitBadge(nextInbound.waitMins) : null;

    return (
        <div
            className="min-h-dvh pb-28 bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors">
            {/* Minimal Sticky Header */}
            <header
                className="sticky top-0 z-30 bg-white/85 dark:bg-[#090d16]/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/10">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div
                            className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#003876] to-blue-700 flex items-center justify-center text-white shadow-xs shrink-0">
                            <GraduationCap className="w-4 h-4"/>
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white truncate">
                                {UI_TEXT.YONSEI.TITLE}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {mounted && (
                            <span
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100/90 dark:bg-white/[0.06] text-[11px] sm:text-xs font-extrabold text-slate-600 dark:text-slate-300 tabular-nums">
                                <Clock className="w-3 h-3 text-[#003876] dark:text-blue-400"/>
                                <span>{formatHeaderClock(now)}</span>
                            </span>
                        )}

                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic("light");
                                setIsSettingsModalOpen(true);
                            }}
                            title={UI_TEXT.YONSEI.MODE_OVERRIDE_LABEL}
                            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.07] dark:hover:bg-white/15 text-xs font-extrabold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                        >
                            <Calendar className="w-3.5 h-3.5 text-[#003876] dark:text-blue-400"/>
                            <span>{dayModeBadgeLabel}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleToggleTheme}
                            aria-label={UI_TEXT.ACCESSIBILITY.THEME_SWITCH}
                            className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.07] dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                        >
                            {mounted ? (
                                isDark ? (
                                    <Sun className="w-4 h-4 text-amber-400"/>
                                ) : (
                                    <Moon className="w-4 h-4 text-slate-700"/>
                                )
                            ) : (
                                <span className="w-4 h-4"/>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5">
                {/* Compact Direction Command Bar */}
                <section
                    className="relative overflow-hidden rounded-3xl p-4 sm:p-5 bg-white dark:bg-[#111623] border border-slate-200/85 dark:border-white/10 shadow-xs">
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#003876]/[0.07] via-blue-500/[0.03] to-transparent dark:from-[#003876]/30 dark:via-blue-900/15 dark:to-transparent"
                    />
                    <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-[#003876] text-white">
                                    {UI_TEXT.YONSEI.HERO_BADGE}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsSettingsModalOpen(true)}
                                    className="sm:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                                >
                                    <Calendar className="w-2.5 h-2.5"/>
                                    {dayModeBadgeLabel}
                                </button>
                            </div>
                            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                                지금 탈 수 있는 버스
                            </h2>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                핵심 출발 시각만 한눈에 보고, 전체 시간표는 눌러서 확인하세요
                            </p>
                        </div>

                        {/* Segmented Direction Switcher */}
                        <div
                            role="tablist"
                            aria-label="이동 방향 선택"
                            className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-slate-100/90 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/[0.06] shrink-0"
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={directionMode === "OUTBOUND"}
                                onClick={() => {
                                    triggerHaptic("selection");
                                    setDirectionMode("OUTBOUND");
                                }}
                                className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                    directionMode === "OUTBOUND"
                                        ? "bg-[#003876] text-white shadow-sm"
                                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                <ArrowUpRight className="w-3.5 h-3.5 shrink-0"/>
                                <div className="text-left leading-tight">
                                    <div>하교 · 시내방면</div>
                                    <div
                                        className={`text-[10px] font-bold ${
                                            directionMode === "OUTBOUND"
                                                ? "text-blue-200"
                                                : "text-slate-400 dark:text-slate-500"
                                        }`}
                                    >
                                        연세대 출발
                                    </div>
                                </div>
                            </button>

                            <button
                                type="button"
                                role="tab"
                                aria-selected={directionMode === "INBOUND"}
                                onClick={() => {
                                    triggerHaptic("selection");
                                    setDirectionMode("INBOUND");
                                }}
                                className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                    directionMode === "INBOUND"
                                        ? "bg-indigo-600 text-white shadow-sm"
                                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                <ArrowDownLeft className="w-3.5 h-3.5 shrink-0"/>
                                <div className="text-left leading-tight">
                                    <div>등교 · 학교방면</div>
                                    <div
                                        className={`text-[10px] font-bold ${
                                            directionMode === "INBOUND"
                                                ? "text-indigo-200"
                                                : "text-slate-400 dark:text-slate-500"
                                        }`}
                                    >
                                        장양리·시내 출발
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                </section>

                {/* Core 1: City Bus Live Next Departures */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <Bus className="w-4 h-4 text-[#003876] dark:text-blue-400"/>
                            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                                시내버스 (30 · 34 · 34-1)
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={() =>
                                handleOpenCityTimetable(
                                    "30",
                                    directionMode === "OUTBOUND" ? "dest" : "origin"
                                )
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#003876] dark:text-blue-400 hover:underline cursor-pointer"
                        >
                            <span>전체 시간표</span>
                            <ArrowRight className="w-3 h-3"/>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {TARGET_ROUTE_NUMBERS.map((routeNo) => (
                            <YonseiCityBusCard
                                key={routeNo}
                                routeNo={routeNo}
                                scheduleRoute={routeScheduleMap.get(routeNo) ?? null}
                                directionMode={directionMode}
                                now={now}
                                onOpenTimetable={handleOpenCityTimetable}
                            />
                        ))}
                    </div>
                </section>

                {/* Core 2: Free Shuttle Next Spotlight (Details in Modals) */}
                <section
                    className="rounded-3xl p-4 sm:p-5 bg-white dark:bg-[#111623] border border-slate-200/85 dark:border-white/10 shadow-xs space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                            <span
                                className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#003876] to-blue-700 text-white flex items-center justify-center shadow-xs shrink-0">
                                <GraduationCap className="w-4 h-4"/>
                            </span>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                                        {YONSEI_SHUTTLE_SCHEDULE.title}
                                    </h2>
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                            shuttleDayType.isSaturday
                                                ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                                                : shuttleDayType.isSunday
                                                    ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30"
                                                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                        }`}
                                    >
                                        {shuttleDayType.label}
                                    </span>
                                </div>
                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                    학생·교직원 무료 · 세부 시간표와 탑승 위치는 모달에서 확인
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                                type="button"
                                onClick={() => handleOpenShuttleModal(directionMode)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/12 text-xs font-extrabold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
                            >
                                <Table2 className="w-3.5 h-3.5 text-[#003876] dark:text-blue-400"/>
                                <span>전체 시간표</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic("light");
                                    setIsStopsModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/12 text-xs font-extrabold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
                            >
                                <MapPin className="w-3.5 h-3.5 text-[#003876] dark:text-blue-400"/>
                                <span>탑승 장소</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleOpenShuttleModal("GUIDELINES")}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/12 text-xs font-extrabold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
                            >
                                <Info className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400"/>
                                <span>이용 안내</span>
                            </button>
                        </div>
                    </div>

                    {shuttleDayType.isSaturday && (
                        <div
                            className="p-3 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-200">
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0"/>
                            <span>{UI_TEXT.YONSEI_SHUTTLE.SATURDAY_NO_RUN_DESC}</span>
                        </div>
                    )}

                    {/* Dual Next Shuttle Spotlight Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => handleOpenShuttleModal("OUTBOUND")}
                            className={`text-left p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] ${
                                directionMode === "OUTBOUND"
                                    ? "bg-gradient-to-br from-blue-50/95 to-slate-50/80 dark:from-blue-950/40 dark:to-[#151c2e] border-[#003876] dark:border-blue-500 ring-1 ring-blue-500/20"
                                    : "bg-slate-50/80 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/10 hover:bg-blue-50/40 dark:hover:bg-blue-950/20"
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span
                                    className="flex items-center gap-1.5 text-xs font-black text-[#003876] dark:text-blue-300">
                                    <Clock className="w-3.5 h-3.5 shrink-0"/>
                                    <span>{UI_TEXT.YONSEI_SHUTTLE.NEXT_FROM_CAMPUS}</span>
                                </span>
                                {outboundWait && (
                                    <span
                                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] border tabular-nums ${outboundWait.pillClass}`}
                                    >
                                        {outboundWait.dotClass && (
                                            <span className="relative flex h-1.5 w-1.5">
                                                <span
                                                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${outboundWait.dotClass}`}
                                                />
                                                <span
                                                    className={`relative inline-flex rounded-full h-1.5 w-1.5 ${outboundWait.dotClass}`}
                                                />
                                            </span>
                                        )}
                                        <span>{outboundWait.label}</span>
                                    </span>
                                )}
                            </div>

                            {nextOutbound ? (
                                <div className="space-y-1">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span
                                            className="text-2xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white">
                                            {nextOutbound.item.departure_time}
                                        </span>
                                        <span
                                            className="text-xs font-extrabold text-blue-700 dark:text-blue-300 truncate">
                                            {nextOutbound.item.departure_point} → {nextOutbound.item.destination}
                                        </span>
                                    </div>
                                    {nextOutbound.item.via.length > 0 && (
                                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                            경유: {nextOutbound.item.via.map((v) => v.name).join(" → ")}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 py-1.5">
                                    {shuttleDayType.isSaturday
                                        ? "토요일은 셔틀 운행이 없습니다"
                                        : "금일 하교 셔틀 운행이 종료되었습니다"}
                                </p>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => handleOpenShuttleModal("INBOUND")}
                            className={`text-left p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] ${
                                directionMode === "INBOUND"
                                    ? "bg-gradient-to-br from-indigo-50/95 to-slate-50/80 dark:from-indigo-950/40 dark:to-[#151c2e] border-indigo-600 dark:border-indigo-400 ring-1 ring-indigo-500/20"
                                    : "bg-slate-50/80 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/10 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20"
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span
                                    className="flex items-center gap-1.5 text-xs font-black text-indigo-700 dark:text-indigo-300">
                                    <Bus className="w-3.5 h-3.5 shrink-0"/>
                                    <span>{UI_TEXT.YONSEI_SHUTTLE.NEXT_TO_CAMPUS}</span>
                                </span>
                                {inboundWait && (
                                    <span
                                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] border tabular-nums ${inboundWait.pillClass}`}
                                    >
                                        {inboundWait.dotClass && (
                                            <span className="relative flex h-1.5 w-1.5">
                                                <span
                                                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${inboundWait.dotClass}`}
                                                />
                                                <span
                                                    className={`relative inline-flex rounded-full h-1.5 w-1.5 ${inboundWait.dotClass}`}
                                                />
                                            </span>
                                        )}
                                        <span>{inboundWait.label}</span>
                                    </span>
                                )}
                            </div>

                            {nextInbound ? (
                                <div className="space-y-1">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span
                                            className="text-2xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white">
                                            {nextInbound.item.departure_time}
                                        </span>
                                        <span
                                            className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300 truncate">
                                            {nextInbound.item.departure_point} 발 → 미래캠퍼스
                                        </span>
                                    </div>
                                    {nextInbound.item.via.length > 0 ? (
                                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                            경유:{" "}
                                            {nextInbound.item.via
                                                .map((v) => (v.time ? `${v.name}(${v.time})` : v.name))
                                                .join(" → ")}
                                        </p>
                                    ) : (
                                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                            {nextInbound.item.note || UI_TEXT.YONSEI_SHUTTLE.NO_VIA_EXPRESS}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 py-1.5">
                                    {shuttleDayType.isSaturday
                                        ? "토요일은 셔틀 운행이 없습니다"
                                        : "금일 등교 셔틀 운행이 종료되었습니다"}
                                </p>
                            )}
                        </button>
                    </div>
                </section>
            </main>

            <Footer/>

            {/* Floating Pill Bottom Navigation Bar */}
            <FloatingBottomNav
                activeModal={activeModal}
                onScrollTop={() => {
                    triggerHaptic("light");
                    window.scrollTo({top: 0, behavior: "smooth"});
                }}
                onOpenCityBusModal={() =>
                    handleOpenCityTimetable(
                        "30",
                        directionMode === "OUTBOUND" ? "dest" : "origin"
                    )
                }
                onOpenShuttleModal={() => handleOpenShuttleModal(directionMode)}
                onOpenStopsModal={() => {
                    triggerHaptic("light");
                    setIsStopsModalOpen(true);
                }}
                onOpenSettingsModal={() => {
                    triggerHaptic("light");
                    setIsSettingsModalOpen(true);
                }}
            />

            {/* Detail Modals */}
            <CityBusTimetableModal
                key={`${cityModalState.routeNo}-${cityModalState.location}-${cityModalState.isOpen}`}
                isOpen={cityModalState.isOpen}
                initialRouteNo={cityModalState.routeNo}
                initialLocation={cityModalState.location}
                allRoutes={allRoutes}
                now={now}
                onClose={() => setCityModalState((prev) => ({...prev, isOpen: false}))}
            />

            <ShuttleTimetableModal
                key={`shuttle-${shuttleModalState.tab}-${shuttleModalState.isOpen}`}
                isOpen={shuttleModalState.isOpen}
                initialTab={shuttleModalState.tab}
                dayMode={dayMode}
                now={now}
                onClose={() => setShuttleModalState((prev) => ({...prev, isOpen: false}))}
            />

            <ShuttleStopsModal
                key={`stops-${directionMode}-${isStopsModalOpen}`}
                isOpen={isStopsModalOpen}
                initialDirectionMode={directionMode}
                onClose={() => setIsStopsModalOpen(false)}
            />

            <SettingsModal
                isOpen={isSettingsModalOpen}
                dayMode={dayMode}
                isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                directionMode={directionMode}
                onDayModeChange={setDayMode}
                onDirectionModeChange={setDirectionMode}
                onClose={() => setIsSettingsModalOpen(false)}
            />
        </div>
    );
}

export default YonseiCampusPage;
