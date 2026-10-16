"use client";

import dynamic from "next/dynamic";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Bus, GraduationCap, MapPin, X} from "lucide-react";

import {MAP_SETTINGS} from "@shared/config/env";
import {UI_TEXT} from "@shared/config/locale";

import {useBusRouteMap} from "@entities/route/hooks";
import {useCityContext} from "@entities/city";

import {useBusSortedList} from "@features/live-tracking/useBusSortedList";
import {MapRouteHeader} from "@features/map-view/MapRouteHeader";

import {isWeekend} from "@shared/lib/timeUtils";
import {BottomNav} from "@widgets/BottomNav";
import {DayModeToggleGroup} from "@widgets/BottomNav/ui/DayModeToggleGroup";

import {TimetableWidget} from "@widgets/TimetableWidget";
import {YonseiTimetableWidget} from "@widgets/YonseiTimetableWidget";
import type {TimetableSubTab} from "@shared/types/navigation";
import {useAppNavigation} from "./hooks/useAppNavigation";

/**
 * Dynamically import MapWrapper & RouteLayer with SSR disabled.
 * MapLibre references `window` at module level, so the map subtree must be kept out of SSR.
 */
const MapWrapper = dynamic(() => import("@widgets/MapContainer/MapWrapper"), {
    ssr: false,
});
const RouteLayer = dynamic(() => import("@widgets/MapContainer/RouteLayer"), {
    ssr: false,
});

export function AppShell() {
    const {
        activeTab,
        timetableSubTab,
        dayMode,
        setDayMode,
        selectedRoute,
        isMapActive,
        hasVisitedMap,
        handleTabChange,
        handleScheduleSubTabChange,
        handleRouteChange,
        handleSelectMapRoute,
    } = useAppNavigation();

    // Live weekend check for timetable badge (updates on minute change, re-renders only at midnight transition)
    const [isTodayWeekendOrHoliday, setIsTodayWeekendOrHoliday] = useState<boolean>(() => isWeekend());
    useEffect(() => {
        const timer = setInterval(() => {
            const current = isWeekend();
            setIsTodayWeekendOrHoliday((prev) => (prev !== current ? current : prev));
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    const {currentCity} = useCityContext();
    const isWonju = currentCity.code === "32020";

    // Auto-switch back to map if user moves to non-Wonju city while on schedule modal
    useEffect(() => {
        if (!isWonju && activeTab === "schedule") {
            handleTabChange("map");
        }
    }, [isWonju, activeTab, handleTabChange]);

    // Handler for opening the Timetable Modal directly from Map Pins or Stop Popups
    const handleOpenScheduleModal = useCallback(
        (subTab?: TimetableSubTab) => {
            if (subTab) {
                handleScheduleSubTabChange(subTab);
            }
            handleTabChange("schedule");
        },
        [handleScheduleSubTabChange, handleTabChange]
    );

    // Fetch route map for current city
    const routeMap = useBusRouteMap(true, currentCity.code);
    const allRoutes = useMemo(
        () => (routeMap ? Object.keys(routeMap) : isWonju ? ["30", "34", "34-1"] : []),
        [routeMap, isWonju]
    );
    const activeRoute = useMemo(() => {
        if (!routeMap || Object.keys(routeMap).length === 0) return selectedRoute;
        if (routeMap[selectedRoute]) return selectedRoute;

        if (isWonju && routeMap[MAP_SETTINGS.DEFAULT_ROUTE]) {
            return MAP_SETTINGS.DEFAULT_ROUTE;
        }
        return Object.keys(routeMap)[0] ?? selectedRoute;
    }, [routeMap, selectedRoute, isWonju]);

    // Live telemetry for active map route
    const liveBusData = useBusSortedList(activeRoute, hasVisitedMap && isMapActive, currentCity.code);

    // Direction filter for map polyline rendering (all, up, down)
    const [selectedDirection, setSelectedDirection] = useState<"all" | "up" | "down">("all");

    useEffect(() => {
        setSelectedDirection("all");
    }, [activeRoute]);

    useEffect(() => {
        if (!routeMap || Object.keys(routeMap).length === 0) return;
        if (!activeRoute || activeRoute === selectedRoute) return;
        handleRouteChange(activeRoute, currentCity.code);
    }, [routeMap, activeRoute, selectedRoute, currentCity.code, handleRouteChange]);

    return (
        <div className="fixed inset-0 flex flex-col w-full h-[100dvh] overflow-hidden bg-slate-50 dark:bg-[#0b0f19]">
            {/* 1. Real-time Map View Container (Always persistent & active, zero reload lag) */}
            <div className="relative flex-1 w-full h-full overflow-hidden">
                {/* Map Top Floating Header & Fast Route Switcher with Detailed Live Status */}
                <MapRouteHeader
                    selectedRoute={activeRoute}
                    onSelectRoute={handleRouteChange}
                    runningBuses={liveBusData.sortedList}
                    allRoutes={allRoutes}
                    connectionStatus={liveBusData.connectionStatus}
                    hasFetched={liveBusData.hasFetched}
                    isDegraded={liveBusData.isDegraded}
                    onReconnect={liveBusData.reconnect}
                    selectedDirection={selectedDirection}
                    onSelectDirection={setSelectedDirection}
                />

                <MapWrapper>
                    <RouteLayer
                        routeName={activeRoute}
                        onRouteChange={handleRouteChange}
                        onOpenScheduleModal={handleOpenScheduleModal}
                        enabled={true}
                        selectedDirection={selectedDirection}
                        cityCode={currentCity.code}
                    />
                </MapWrapper>
            </div>

            {/* 2. Schedule Timetable Modal Sheet (Opened by clicking Map Timetable Pins, Wonju only) */}
            {activeTab === "schedule" && isWonju && (
                <div
                    className="fixed inset-0 z-60 flex flex-col justify-end sm:justify-center items-center bg-black/50 backdrop-blur-md transition-opacity duration-300 animate-fadeIn"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            handleTabChange("map");
                        }
                    }}
                >
                    <div
                        className="relative w-full sm:max-w-5xl max-h-[90dvh] sm:max-h-[86dvh] bg-white/95 dark:bg-[#111218]/95 backdrop-blur-3xl rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-black/10 dark:border-white/10 flex flex-col overflow-hidden animate-slideUp"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header Bar + Integrated Sub-tab & DayMode Controls */}
                        <div className="flex flex-col gap-3 px-4 sm:px-8 py-4 border-b border-black/5 dark:border-white/5 shrink-0 bg-white/80 dark:bg-[#111218]/80 backdrop-blur-xl">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                                        {currentCity.name} 버스 시간표 및 노선 안내
                                    </h2>
                                    <span className="hidden md:inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shrink-0">
                                        {currentCity.province}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => handleTabChange("map")}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer active:scale-95"
                                        title="지도로 돌아가기"
                                    >
                                        <MapPin className="w-3.5 h-3.5" />
                                        <span>지도 보기</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleTabChange("map")}
                                        className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer active:scale-95"
                                        aria-label="닫기"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Integrated Timetable Mode Controls (Yonsei vs All + DayMode Toggle) */}
                            <div className="flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar-hidden pt-0.5">
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => handleScheduleSubTabChange("yonsei")}
                                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                                            timetableSubTab === "yonsei"
                                                ? "bg-[#003876] text-white shadow-md shadow-[#003876]/25 scale-[1.02]"
                                                : "bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 border border-black/5 dark:border-white/10"
                                        }`}
                                    >
                                        <GraduationCap className="w-3.5 h-3.5"/>
                                        <span className="whitespace-nowrap">{UI_TEXT.BOTTOM_NAV.TAB_YONSEI} 집중 안내</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleScheduleSubTabChange("all")}
                                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                                            timetableSubTab === "all"
                                                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md shadow-black/10 dark:shadow-white/10 scale-[1.02]"
                                                : "bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 border border-black/5 dark:border-white/10"
                                        }`}
                                    >
                                        <Bus className="w-3.5 h-3.5"/>
                                        <span className="whitespace-nowrap">원주시 {UI_TEXT.BOTTOM_NAV.TAB_ALL} 노선</span>
                                    </button>
                                </div>

                                {timetableSubTab === "yonsei" && (
                                    <DayModeToggleGroup
                                        dayMode={dayMode}
                                        onDayModeChange={setDayMode}
                                        isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto px-3 sm:px-8 py-5 pb-28 sm:pb-16 custom-scrollbar">
                            {timetableSubTab === "yonsei" ? (
                                <YonseiTimetableWidget
                                    onSelectMapRoute={handleSelectMapRoute}
                                    dayMode={dayMode}
                                    onDayModeChange={setDayMode}
                                />
                            ) : (
                                <TimetableWidget
                                    onSelectMapRoute={handleSelectMapRoute}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Unified Bottom Floating Pill Navigation Bar */}
            <BottomNav
                activeTab={activeTab}
                onTabChange={handleTabChange}
                showScheduleTab={isWonju}
                scheduleSubTab={timetableSubTab}
                onScheduleSubTabChange={handleScheduleSubTabChange}
                dayMode={dayMode}
                onDayModeChange={setDayMode}
                isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                allRoutes={allRoutes}
                selectedRoute={activeRoute}
                onSelectRoute={handleRouteChange}
                runningBuses={liveBusData.sortedList}
                getDirection={liveBusData.getDirection}
                connectionStatus={liveBusData.connectionStatus}
                hasFetched={liveBusData.hasFetched}
                lastUpdated={liveBusData.lastUpdated}
                onReconnect={liveBusData.reconnect}
            />
        </div>
    );
}

export default AppShell;

