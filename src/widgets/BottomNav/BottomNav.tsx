"use client";

import React, {memo, useCallback, useEffect, useState, useSyncExternalStore} from "react";
import {Bus, Calendar, ChevronDown, Coffee, Compass, MapIcon, MapPin, Moon, Sparkles, Sun, X,} from "lucide-react";
import {useTheme} from "next-themes";

import {APP_CONFIG, MAP_SETTINGS} from "@shared/config/env";
import {UI_TEXT} from "@shared/config/locale";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useIsDesktop} from "@shared/ui/useIsDesktop";
import {useCityContext} from "@entities/city";
import {YONSEI_ROUTE_SET} from "@entities/route/routeMetadata";
import {CitySelectModal} from "@features/city-select";
import {RouteSelectModal} from "@features/map-view/RouteSelectModal";

import {BusListDrawer} from "./BusListDrawer";

import type {BusItem, LiveConnectionStatus} from "@entities/bus/types";
import type {DirectionCode} from "@entities/route/types";
import type {DayMode} from "@shared/types/navigation";

export type {DayMode};

const emptySubscribe = () => () => {
};

export interface BottomNavProps {
    // Timetable day mode options (Wonju only)
    dayMode?: DayMode;
    onDayModeChange?: (mode: DayMode) => void;
    isTodayWeekendOrHoliday?: boolean;

    // Real-time Map & Route options
    allRoutes?: string[];
    selectedRoute?: string;
    onSelectRoute?: (route: string) => void;
    selectedVariantId?: string | null;
    onSelectVariant?: (variantId: string | null) => void;
    runningBuses?: BusItem[];
    getDirection?: (nodeId: string | null | undefined, nodeOrd: number, routeId?: string | null) => DirectionCode;
    onBusClick?: (lat: number, lng: number) => void;
    connectionStatus?: LiveConnectionStatus;
    hasFetched?: boolean;
    lastUpdated?: number | null;
    onReconnect?: () => void;
    className?: string;
}

/**
 * Unified Floating Pill Navigation Bar (Map-Centric Architecture):
 * - Brand Identity (Click to recenter current city)
 * - Region Selector Button (139-city modal + detected city indicator)
 * - Route Selector & Running Bus List Drawer Toggle
 * - Wonju Timetable DayMode Switcher (Auto / Weekday / Holiday)
 * - Theme Switcher (Light / Dark)
 */
function BottomNavComponent({
                                dayMode = "AUTO",
                                onDayModeChange,
                                isTodayWeekendOrHoliday = false,
                                allRoutes = [],
                                selectedRoute = "",
                                onSelectRoute,
                                selectedVariantId = null,
                                onSelectVariant,
                                runningBuses = [],
                                getDirection,
                                onBusClick,
                                connectionStatus = "connected",
                                hasFetched = true,
                                lastUpdated,
                                onReconnect,
                                className = "",
                            }: BottomNavProps) {
    const {map} = useAppMapContext();
    const {
        currentCity,
        detectedCity,
        confirmDetectedCity,
        dismissDetectedCity,
    } = useCityContext();

    // Theme state
    const {setTheme, resolvedTheme} = useTheme();
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const isDark = mounted
        ? resolvedTheme === "dark" ||
        (typeof document !== "undefined" && document.documentElement.classList.contains("dark"))
        : false;

    const handleToggleTheme = useCallback(() => {
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

    // SSR-safe desktop breakpoint subscription and modal/drawer states
    const isDesktop = useIsDesktop();
    const [isMobileBusListOpen, setIsMobileBusListOpen] = useState(false);
    const isBusListOpen = isDesktop || isMobileBusListOpen;
    const [isCityModalOpen, setIsCityModalOpen] = useState(false);
    const [isRoutePickerOpen, setIsRoutePickerOpen] = useState(false);

    const handleToggleBusList = useCallback(() => {
        if (isDesktop) {
            return;
        }
        const next = !isMobileBusListOpen;
        setIsMobileBusListOpen(next);
        if (next && typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("wbus:close-stop-popup"));
            window.dispatchEvent(new CustomEvent("wbus:close-timetable"));
        }
    }, [isDesktop, isMobileBusListOpen]);

    // Listen to close/open bus list custom events
    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleCloseBusList = () => setIsMobileBusListOpen(false);
        const handleOpenBusList = () => setIsMobileBusListOpen(true);
        window.addEventListener("wbus:close-bus-list", handleCloseBusList);
        window.addEventListener("wbus:open-bus-list", handleOpenBusList);
        return () => {
            window.removeEventListener("wbus:close-bus-list", handleCloseBusList);
            window.removeEventListener("wbus:open-bus-list", handleOpenBusList);
        };
    }, []);

    const handleDefaultBusClick = useCallback(
        (lat: number, lng: number) => {
            if (onBusClick) {
                onBusClick(lat, lng);
            } else if (map) {
                map.flyTo({
                    center: [lng, lat],
                    zoom: map.getZoom(),
                    duration: MAP_SETTINGS.ANIMATION.FLY_TO_MS,
                });
            }
        },
        [onBusClick, map]
    );

    const handleRecenterCity = useCallback(() => {
        if (!map) return;
        map.flyTo({
            center: [currentCity.lng, currentCity.lat],
            zoom: currentCity.zoom,
            duration: 900,
        });
    }, [map, currentCity]);

    const handleCycleDayMode = useCallback(() => {
        if (!onDayModeChange) return;
        if (dayMode === "AUTO") {
            onDayModeChange("WEEKDAY");
        } else if (dayMode === "WEEKDAY") {
            onDayModeChange("VACATION");
        } else {
            onDayModeChange("AUTO");
        }
    }, [dayMode, onDayModeChange]);

    const isConnecting = !hasFetched || connectionStatus === "connecting";
    const shortCityName = currentCity.name.split("/")[0];
    const hasPendingRegion = Boolean(detectedCity && detectedCity.code !== currentCity.code);
    const isWonju = currentCity.code === "32020";
    const isYonseiSelected = isWonju && YONSEI_ROUTE_SET.has(selectedRoute);

    const dayModeTitle =
        dayMode === "AUTO"
            ? `시간표 기준: 자동 (오늘: ${isTodayWeekendOrHoliday ? "휴일" : "평일"}) · 클릭 시 평일로 변경`
            : dayMode === "WEEKDAY"
                ? "시간표 기준: 평일 · 클릭 시 휴일로 변경"
                : "시간표 기준: 휴일 · 클릭 시 자동으로 변경";

    return (
        <>
            {/* 1. Region Selection Modal (139 Nationwide Cities) */}
            <CitySelectModal
                isOpen={isCityModalOpen}
                onClose={() => setIsCityModalOpen(false)}
            />

            {/* 2. Route Selection Modal (Search, Categories, Grid) */}
            <RouteSelectModal
                isOpen={isRoutePickerOpen}
                onClose={() => setIsRoutePickerOpen(false)}
                allRoutes={allRoutes}
                selectedRoute={selectedRoute}
                onSelectRoute={(route) => {
                    onSelectRoute?.(route);
                    setIsRoutePickerOpen(false);
                }}
            />

            {/* 3. Click-outside Backdrop when BusListDrawer is open (Mobile only) */}
            {!isDesktop && isMobileBusListOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/15 dark:bg-black/35 backdrop-blur-[1px] transition-opacity animate-fadeIn md:hidden"
                    onClick={() => setIsMobileBusListOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* 4. Expandable Floating Running Bus List & Stop Details Drawer */}
            {isBusListOpen && (
                <BusListDrawer
                    isOpen={isBusListOpen}
                    onClose={() => {
                        if (!isDesktop) setIsMobileBusListOpen(false);
                    }}
                    selectedRoute={selectedRoute}
                    runningBuses={runningBuses}
                    isConnecting={isConnecting}
                    getDirection={getDirection}
                    onBusClick={handleDefaultBusClick}
                    lastUpdated={lastUpdated}
                    onReconnect={onReconnect}
                    onRouteChange={onSelectRoute}
                    selectedVariantId={selectedVariantId}
                    onSelectVariant={onSelectVariant}
                />
            )}

            <div
                className={`fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1.125rem)] left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex flex-col items-center gap-2.5 max-w-[95vw] ${className}`}
            >
                {/* Floating Region Switch Prompt Pill */}
                {hasPendingRegion && detectedCity && !isBusListOpen && (
                    <div
                        className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-white/92 dark:bg-[#111111]/92 backdrop-blur-2xl text-slate-900 dark:text-white rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.16)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)] border border-black/10 dark:border-white/15 animate-fadeIn select-none"
                        role="status"
                        aria-live="polite"
                    >
                        <Compass
                            className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin shrink-0"
                            style={{animationDuration: "6s"}}
                        />
                        <span className="text-xs font-extrabold tracking-tight whitespace-nowrap">
                            지도 위치:{" "}
                            <strong className="text-blue-600 dark:text-blue-400 font-black">
                                {detectedCity.name}
                            </strong>
                        </span>
                        <button
                            type="button"
                            onClick={confirmDetectedCity}
                            className="px-2.5 py-1 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black transition-all cursor-pointer active:scale-95 whitespace-nowrap shadow-xs"
                        >
                            이 지역 노선 보기
                        </button>
                        <button
                            type="button"
                            onClick={dismissDetectedCity}
                            className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                            aria-label="지역 전환 알림 닫기"
                        >
                            <X className="w-3.5 h-3.5"/>
                        </button>
                    </div>
                )}

                {/* Unified Bottom Floating Pill Navigation Bar */}
                <nav
                    aria-label={UI_TEXT.ACCESSIBILITY.MAIN_NAV}
                    className="flex items-center justify-start gap-1 sm:gap-1.5 p-1.5 px-2 sm:px-3 bg-white/92 dark:bg-[#111111]/92 backdrop-blur-3xl border border-black/8 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.16)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)] rounded-full transition-all duration-300 w-[calc(100vw-1rem)] sm:w-auto max-w-full overflow-x-auto custom-scrollbar-hidden"
                >
                    {/* Brand Logo & Title (Recenter on Current City) */}
                    <button
                        type="button"
                        onClick={handleRecenterCity}
                        title={`${currentCity.name} 중심으로 지도 이동`}
                        className="hidden sm:flex items-center gap-2 pl-1 pr-1.5 py-0.5 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all select-none shrink-0 cursor-pointer active:scale-95"
                    >
                        <div
                            className="flex items-center justify-center w-7.5 h-7.5 rounded-full bg-black dark:bg-white text-white dark:text-black shrink-0 shadow-xs">
                            <MapIcon className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden="true"/>
                        </div>
                        <span
                            className="hidden md:inline-block text-sm sm:text-base font-black text-black dark:text-white tracking-tight shrink-0">
                            {APP_CONFIG.NAME}
                        </span>
                    </button>

                    <div className="hidden sm:block w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0"/>

                    {/* Region Selector Button */}
                    <button
                        type="button"
                        onClick={() => setIsCityModalOpen(true)}
                        className={`relative flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-extrabold tracking-tight transition-all duration-200 cursor-pointer select-none active:scale-95 shrink-0 ${
                            hasPendingRegion
                                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-2 ring-blue-400/40"
                                : "bg-black text-white dark:bg-white dark:text-black shadow-sm shadow-black/10 dark:shadow-white/10 hover:opacity-90"
                        }`}
                        title={
                            hasPendingRegion && detectedCity
                                ? `현재: ${currentCity.name} (화면 이동 지역: ${detectedCity.name} · 클릭하여 지역 변경)`
                                : `현재 지역: ${currentCity.name} (클릭하여 전국 지역 선택)`
                        }
                        aria-label="서비스 지역 선택"
                    >
                        {hasPendingRegion ? (
                            <Sparkles className="w-3.5 h-3.5 animate-pulse shrink-0"/>
                        ) : (
                            <MapPin className="w-3.5 h-3.5 stroke-[2.4] shrink-0"/>
                        )}
                        <span className="whitespace-nowrap font-black">{shortCityName}</span>
                        <ChevronDown className="w-3.5 h-3.5 opacity-75 shrink-0"/>

                        {hasPendingRegion && (
                            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                                <span
                                    className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"/>
                                <span
                                    className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 border border-white dark:border-black"/>
                            </span>
                        )}
                    </button>

                    {/* Route Selector Button */}
                    <button
                        type="button"
                        onClick={() => setIsRoutePickerOpen(true)}
                        className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-extrabold tracking-tight transition-all duration-200 cursor-pointer select-none active:scale-95 shrink-0 animate-fadeIn shadow-xs ${
                            isYonseiSelected
                                ? "bg-[#003876]/15 dark:bg-[#003876]/35 hover:bg-[#003876]/25 border border-[#003876]/40 text-[#003876] dark:text-blue-300"
                                : "bg-blue-600/10 dark:bg-blue-500/15 hover:bg-blue-600/20 dark:hover:bg-blue-500/25 border border-blue-500/30 text-blue-700 dark:text-blue-300"
                        }`}
                        title="노선 선택 (검색/목록)"
                    >
                        <Bus className="w-3.5 h-3.5"/>
                        <span className="whitespace-nowrap font-black">{selectedRoute || "노선"}번</span>
                        <ChevronDown className="w-3.5 h-3.5 opacity-70"/>
                    </button>

                    {/* Running Bus List Toggle Button (Mobile Only: on desktop the left panel is always displayed) */}
                    <button
                        type="button"
                        onClick={handleToggleBusList}
                        className={`flex md:hidden items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 shrink-0 animate-fadeIn ${
                            isBusListOpen
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                                : isConnecting
                                    ? "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                    : runningBuses.length > 0
                                        ? "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                        : "bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 border border-black/5 dark:border-white/10"
                        }`}
                        title={UI_TEXT.NAV.BUS_LIST_LABEL}
                    >
                        <Bus className="w-3.5 h-3.5 shrink-0"/>
                        <span className="whitespace-nowrap">
                            {isConnecting
                                ? "연결 중..."
                                : runningBuses.length > 0
                                    ? UI_TEXT.BOTTOM_NAV.RUNNING_LIST_BTN(runningBuses.length)
                                    : "운행 종료 (0)"}
                        </span>
                    </button>

                    {/* 3-state Day Mode Toggle (Wonju only: Auto / Weekday / Holiday for pin timetables) */}
                    {isWonju && onDayModeChange && (
                        <>
                            <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0"/>
                            <button
                                type="button"
                                onClick={handleCycleDayMode}
                                title={dayModeTitle}
                                aria-label={dayModeTitle}
                                className="p-2 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all duration-200 cursor-pointer select-none active:scale-90 shrink-0"
                            >
                                {dayMode === "AUTO" && (
                                    <Sparkles
                                        className="w-4 h-4 text-blue-600 dark:text-blue-400 stroke-[2.2] animate-fadeIn"/>
                                )}
                                {dayMode === "WEEKDAY" && (
                                    <Calendar
                                        className="w-4 h-4 text-amber-600 dark:text-amber-400 stroke-[2.2] animate-fadeIn"/>
                                )}
                                {dayMode === "VACATION" && (
                                    <Coffee
                                        className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.2] animate-fadeIn"/>
                                )}
                            </button>
                        </>
                    )}

                    {/* Divider before Theme Switcher */}
                    <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0"/>

                    {/* Theme Toggle Button */}
                    <button
                        type="button"
                        onClick={handleToggleTheme}
                        aria-label={UI_TEXT.NAV.THEME_TOGGLE_LABEL}
                        className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all duration-200 cursor-pointer select-none active:scale-90 shrink-0"
                    >
                        {isDark ? (
                            <Moon className="w-4 h-4 text-blue-400 stroke-[2.2] animate-fadeIn"/>
                        ) : (
                            <Sun className="w-4 h-4 text-amber-500 stroke-[2.2] animate-fadeIn"/>
                        )}
                    </button>
                </nav>
            </div>
        </>
    );
}

export const BottomNav = memo(BottomNavComponent);
export default BottomNav;
