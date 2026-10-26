"use client";

import React, {memo, useCallback, useEffect, useState} from "react";
import {ChevronDown, Compass, MapIcon, MapPin, Sparkles, X} from "lucide-react";
import {APP_CONFIG, MAP_SETTINGS} from "@shared/config/env";
import {UI_TEXT} from "@shared/config/locale";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useIsDesktop} from "@shared/ui/useIsDesktop";
import {useCityContext} from "@entities/city";
import {CitySelectModal} from "@features/city-select";

import {MapNavControls} from "./ui/MapNavControls";
import {NavThemeToggle} from "./ui/NavThemeToggle";
import {BusListDrawer} from "./ui/BusListDrawer";
import {DayModeToggle} from "./ui/DayModeToggleGroup";

import type {BusItem, LiveConnectionStatus} from "@entities/bus/types";
import type {DirectionCode} from "@entities/route/types";
import type {DayMode, NavTab} from "@shared/types/navigation";

export type {DayMode, NavTab};

export interface BottomNavProps {
    activeTab?: NavTab;
    onTabChange?: (tab: NavTab) => void;
    showScheduleTab?: boolean;

    // Timetable options (Wonju only)
    dayMode?: DayMode;
    onDayModeChange?: (mode: DayMode) => void;
    isTodayWeekendOrHoliday?: boolean;

    // Dynamic Map options
    allRoutes?: string[];
    selectedRoute?: string;
    onSelectRoute?: (route: string) => void;
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
 * Unified Floating Pill Navigation Bar.
 * Redesigned around Map-Centric Philosophy:
 * - Brand Identity (Click to recenter current city)
 * - Region Selector Button (Manual confirmation when panning to new region + 138-city modal)
 * - Timetable Button (Wonju Only)
 * - Route Selector & Running Bus List Drawer Toggle
 * - Theme Switcher
 */
function BottomNavComponent({
                                activeTab: _activeTab = "map",
                                onTabChange: _onTabChange,
                                showScheduleTab: _showScheduleTab = true,
                                dayMode = "AUTO",
                                onDayModeChange,
                                isTodayWeekendOrHoliday = false,
                                allRoutes = [],
                                selectedRoute = "",
                                onSelectRoute,
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

    // SSR-safe desktop breakpoint subscription and mobile drawer state
    const isDesktop = useIsDesktop();
    const [isMobileBusListOpen, setIsMobileBusListOpen] = useState(false);
    const isBusListOpen = isDesktop || isMobileBusListOpen;
    const [isCityModalOpen, setIsCityModalOpen] = useState(false);

    const handleToggleBusList = useCallback(() => {
        if (isDesktop) {
            // Cannot toggle on desktop - always open
            return;
        }
        setIsMobileBusListOpen((prev) => {
            const next = !prev;
            if (next && typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("wbus:close-stop-popup"));
                window.dispatchEvent(new CustomEvent("wbus:close-timetable"));
            }
            return next;
        });
    }, [isDesktop]);

    // Listen to close/open bus list custom events
    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleCloseBusList = () => {
            setIsMobileBusListOpen(false);
        };
        const handleOpenBusList = () => {
            setIsMobileBusListOpen(true);
        };
        window.addEventListener("wbus:close-bus-list", handleCloseBusList);
        window.addEventListener("wbus:open-bus-list", handleOpenBusList);
        return () => {
            window.removeEventListener("wbus:close-bus-list", handleCloseBusList);
            window.removeEventListener("wbus:open-bus-list", handleOpenBusList);
        };
    }, []);

    const handleDefaultBusClick = useCallback((lat: number, lng: number) => {
        if (onBusClick) {
            onBusClick(lat, lng);
        } else if (map) {
            map.flyTo({
                center: [lng, lat],
                zoom: map.getZoom(),
                duration: MAP_SETTINGS.ANIMATION.FLY_TO_MS,
            });
        }
    }, [onBusClick, map]);

    const handleRecenterCity = useCallback(() => {
        if (!map) return;
        map.flyTo({
            center: [currentCity.lng, currentCity.lat],
            zoom: currentCity.zoom,
            duration: 900,
        });
    }, [map, currentCity]);

    const isConnecting = !hasFetched || connectionStatus === "connecting";
    const shortCityName = currentCity.name.split("/")[0];
    const hasPendingRegion = Boolean(detectedCity && detectedCity.code !== currentCity.code);
    const isWonju = currentCity.code === "32020";

    return (
        <>
            {/* Region Selection Modal (138 Nationwide Cities) */}
            <CitySelectModal
                isOpen={isCityModalOpen}
                onClose={() => setIsCityModalOpen(false)}
            />

            {/* Click-outside Backdrop when BusListDrawer is open (Mobile only) */}
            {!isDesktop && isMobileBusListOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/15 dark:bg-black/35 backdrop-blur-[1px] transition-opacity animate-fadeIn md:hidden"
                    onClick={() => setIsMobileBusListOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Expandable Floating Running Bus List & Split Stop Details Drawer */}
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
                    dayMode={dayMode}
                    isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                />
            )}

            <div
                className={`fixed bottom-[calc(env(safe-area-inset-bottom,0)+1rem)] left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex flex-col items-center gap-2.5 max-w-[95vw] ${className}`}
            >
                {/* 1. Floating Region Switch Prompt Pill (Appears when panning map to another city without auto-switching) */}
                {hasPendingRegion && detectedCity && !isBusListOpen && (
                    <div
                        className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-white/92 dark:bg-[#111111]/92 backdrop-blur-2xl text-slate-900 dark:text-white rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.16)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)] border border-black/10 dark:border-white/15 animate-fadeIn select-none"
                        role="status"
                        aria-live="polite"
                    >
                        <Compass className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin shrink-0"
                                 style={{animationDuration: "6s"}}/>
                        <span className="text-xs font-extrabold tracking-tight whitespace-nowrap">
                            지도 위치: <strong
                            className="text-blue-600 dark:text-blue-400 font-black">{detectedCity.name}</strong>
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

                {/* 3. Unified Bottom Floating Pill Navigation Bar */}
                <nav
                    aria-label={UI_TEXT.ACCESSIBILITY.MAIN_NAV}
                    className="flex items-center gap-1 sm:gap-1.5 p-1.5 px-2 sm:px-3 bg-white/92 dark:bg-[#111111]/92 backdrop-blur-3xl border border-black/8 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.16)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)] rounded-full transition-all duration-300 max-w-full overflow-x-auto custom-scrollbar-hidden"
                >
                    {/* Brand Logo & Title (Click to Recenter on Current City; hidden on compact mobile to prevent horizontal overflow) */}
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

                    {/* Divider */}
                    <div className="hidden sm:block w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0"/>

                    {/* Region Selector Button (Replaces old Tab Buttons; shows indicator dot when map panned to new city) */}
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
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"/>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 border border-white dark:border-black"/>
                            </span>
                        )}
                    </button>

                    {/* Real-time Map Route & Running Bus Controls (Placed right next to City Selector) */}
                    <MapNavControls
                        allRoutes={allRoutes}
                        selectedRoute={selectedRoute}
                        onSelectRoute={onSelectRoute}
                        runningBuses={runningBuses}
                        connectionStatus={connectionStatus}
                        hasFetched={hasFetched}
                        isBusListOpen={isBusListOpen}
                        onToggleBusList={handleToggleBusList}
                    />

                    {/* Divider before Toggles */}
                    <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0"/>

                    {/* 3-state Day Mode Toggle (Wonju Only) */}
                    {isWonju && onDayModeChange && (
                        <DayModeToggle
                            dayMode={dayMode}
                            onDayModeChange={onDayModeChange}
                            isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                        />
                    )}

                    {/* Theme Toggle Button */}
                    <NavThemeToggle/>
                </nav>
            </div>
        </>
    );
}

export const BottomNav = memo(BottomNavComponent);
export default BottomNav;

