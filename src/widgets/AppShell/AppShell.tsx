"use client";

import dynamic from "next/dynamic";
import React, {useEffect, useMemo, useState} from "react";
import {MapPin, X} from "lucide-react";

import {APP_CONFIG, MAP_SETTINGS, STORAGE_KEYS} from "@shared/config/env";

import {useBusRouteMap} from "@entities/route/hooks";
import {useCityContext} from "@entities/city";

import {useBusSortedList} from "@features/live-tracking/useBusSortedList";
import {MapRouteHeader} from "@features/map-view/MapRouteHeader";

import {isWeekend} from "@shared/lib/timeUtils";
import {BottomNav} from "@widgets/BottomNav";

import {TimetableWidget} from "@widgets/TimetableWidget";
import {YonseiTimetableWidget} from "@widgets/YonseiTimetableWidget";
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

    // Auto-switch back to map if user moves to non-Wonju city while on schedule tab
    useEffect(() => {
        if (!isWonju && activeTab === "schedule") {
            handleTabChange("map");
        }
    }, [isWonju, activeTab, handleTabChange]);

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
        handleRouteChange(activeRoute);
    }, [routeMap, activeRoute, selectedRoute, handleRouteChange]);

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
                        enabled={true}
                        selectedDirection={selectedDirection}
                        cityCode={currentCity.code}
                    />
                </MapWrapper>
            </div>

            {/* 2. Schedule Timetable Slide-Over Sheet (Interactive layer over live map, Wonju only) */}
            {activeTab === "schedule" && isWonju && (
                <div
                    className="fixed inset-0 z-40 flex flex-col justify-end sm:justify-center items-center bg-black/40 backdrop-blur-md transition-opacity duration-300 animate-fadeIn"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            handleTabChange("map");
                        }
                    }}
                >
                    <div
                        className="relative w-full sm:max-w-5xl max-h-[90dvh] sm:max-h-[86dvh] bg-white dark:bg-[#111218] rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-black/10 dark:border-white/10 flex flex-col overflow-hidden animate-slideUp"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header Bar */}
                        <div className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-black/5 dark:border-white/5 shrink-0 bg-white/80 dark:bg-[#111218]/80 backdrop-blur-xl">
                            <div className="flex items-center gap-2.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                    {currentCity.name} 버스 시간표 및 노선 안내
                                </h2>
                                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                    {currentCity.province}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
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
