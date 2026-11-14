"use client";

import React, {useCallback, useEffect, useMemo, useState, useSyncExternalStore} from "react";
import Link from "next/link";
import {useTheme} from "next-themes";
import {ArrowRight, Bus, Calendar, Clock, GraduationCap, Map as MapIcon, Moon, Sun,} from "lucide-react";

import {TARGET_ROUTE_NUMBERS} from "@entities/route";
import {
    type BusRoute,
    getStaticYonseiBusRoutes,
    selectRouteVariant,
    YONSEI_SHUTTLE_SCHEDULE,
} from "@entities/schedule";
import {UI_TEXT} from "@shared/config/locale";
import {resolveInitialCampusDirection} from "@shared/config/settingsCookie";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {isWeekend} from "@shared/lib/timeUtils";
import {Footer} from "@shared/ui/Footer";
import {triggerHaptic} from "@shared/utils/haptics";

import {formatHeaderClock} from "./lib/campusPageHelpers";
import {type CampusDirectionMode, getNextShuttleDepartures} from "./lib/yonseiShuttleUtils";
import {CampusDirectionBar} from "./ui/CampusDirectionBar";
import {CityBusTimetableModal} from "./ui/CityBusTimetableModal";
import {FloatingBottomNav} from "./ui/FloatingBottomNav";
import {SettingsModal} from "./ui/SettingsModal";
import {ShuttleSpotlightSection} from "./ui/ShuttleSpotlightSection";
import {ShuttleStopsModal} from "./ui/ShuttleStopsModal";
import {ShuttleTimetableModal} from "./ui/ShuttleTimetableModal";
import {YonseiCityBusCard} from "./ui/YonseiCityBusCard";

const emptySubscribe = () => () => {
};

export function YonseiCampusPage() {
    const {settings, updateSettings} = useAppSettings();
    const [now, setNow] = useState<Date>(() => new Date());
    const [directionOverride, setDirectionOverride] = useState<CampusDirectionMode | null>(null);
    const dayMode = settings.defaultDayMode;
    const directionMode = useMemo(
        () => directionOverride ?? resolveInitialCampusDirection(settings.yonseiDefaultDirection, now),
        [directionOverride, settings.yonseiDefaultDirection, now]
    );

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

    return (
        <div
            className="min-h-dvh pb-28 sm:pb-32 bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors">
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
                                <span className="sm:hidden">연세대 미래캠</span>
                                <span className="hidden sm:inline">{UI_TEXT.YONSEI.TITLE}</span>
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

                        <Link
                            href="/?cityCode=32020"
                            title="실시간 버스 지도"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 border border-emerald-200/80 dark:border-emerald-400/25 text-[11px] sm:text-xs font-extrabold text-emerald-800 dark:text-emerald-300 transition-colors shrink-0"
                        >
                            <MapIcon className="w-3.5 h-3.5 shrink-0"/>
                            <span className="hidden sm:inline">실시간 지도</span>
                            <span className="sm:hidden">지도</span>
                        </Link>

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
                <CampusDirectionBar
                    directionMode={directionMode}
                    dayModeBadgeLabel={dayModeBadgeLabel}
                    onDirectionChange={setDirectionOverride}
                    onOpenSettings={() => setIsSettingsModalOpen(true)}
                />

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
                <ShuttleSpotlightSection
                    directionMode={directionMode}
                    shuttleDayType={shuttleDayType}
                    nextOutbound={nextOutbound}
                    nextInbound={nextInbound}
                    onOpenShuttleModal={handleOpenShuttleModal}
                    onOpenStopsModal={() => setIsStopsModalOpen(true)}
                />
            </main>

            <Footer isCampusPage/>

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
                isHolidayOrVacation={isHolidayOrVacation}
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
                directionPreference={settings.yonseiDefaultDirection}
                onDayModeChange={(mode) => updateSettings({defaultDayMode: mode})}
                onDirectionPreferenceChange={(pref) => {
                    setDirectionOverride(null);
                    updateSettings({yonseiDefaultDirection: pref});
                }}
                onClose={() => setIsSettingsModalOpen(false)}
            />
        </div>
    );
}

export default YonseiCampusPage;
