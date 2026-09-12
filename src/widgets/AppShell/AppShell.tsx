"use client";

import dynamic from "next/dynamic";
import React, {useEffect, useMemo, useState} from "react";

import {APP_CONFIG, MAP_SETTINGS, STORAGE_KEYS} from "@shared/config/env";

import {useBusRouteMap} from "@entities/route/hooks";

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

    // Only fetch route map & telemetry when real-time map is active or visited
    const routeMap = useBusRouteMap(hasVisitedMap && isMapActive);
    const allRoutes = useMemo(
        () => (routeMap ? Object.keys(routeMap) : ["30", "34", "34-1"]),
        [routeMap]
    );
    const activeRoute = useMemo(() => {
        if (!routeMap) return selectedRoute;
        if (routeMap[selectedRoute]) return selectedRoute;

        return routeMap[MAP_SETTINGS.DEFAULT_ROUTE]
            ? MAP_SETTINGS.DEFAULT_ROUTE
            : Object.keys(routeMap)[0] ?? selectedRoute;
    }, [routeMap, selectedRoute]);

    // Live telemetry for active map route
    const liveBusData = useBusSortedList(activeRoute, hasVisitedMap && isMapActive);

    useEffect(() => {
        if (!routeMap) return;
        if (!activeRoute || activeRoute === selectedRoute) return;
        try {
            localStorage.setItem(STORAGE_KEYS.ROUTE_ID, activeRoute);
        } catch (e) {
            if (APP_CONFIG.IS_DEV) {
                console.warn(
                    "[handleRouteChange] Failed to save route preference to localStorage",
                    e
                );
            }
        }
    }, [routeMap, activeRoute, selectedRoute]);

    const isFixedLayout = activeTab !== "schedule";

    return (
        <div
            className={
                isFixedLayout
                    ? "fixed inset-0 flex flex-col w-full h-[100dvh] overflow-hidden bg-slate-50 dark:bg-[#0b0f19]"
                    : "relative min-h-[100dvh] w-full flex flex-col bg-slate-50 dark:bg-[#0b0f19]"
            }
        >
            {/* 1. Real-time Map View Container (Lazy mounted ONLY when map is activated by user) */}
            {hasVisitedMap && (
                <div
                    className={`relative flex-1 overflow-hidden ${
                        activeTab === "map" ? "block" : "hidden"
                    }`}
                >
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
                    />

                    <MapWrapper>
                        <RouteLayer
                            routeName={activeRoute}
                            onRouteChange={handleRouteChange}
                            enabled={isMapActive}
                        />
                    </MapWrapper>
                </div>
            )}

            {/* 2. Schedule Timetable View (Yonsei 30,34,34-1 & All Wonju routes) */}
            {activeTab === "schedule" && (
                <main
                    className="w-full min-h-dvh px-3 sm:px-6 lg:px-8 py-6 sm:py-10 pb-32 sm:pb-36 flex flex-col items-center">
                    <div className="w-full max-w-6xl flex-1 flex flex-col">
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
                </main>
            )}

            {/* Unified Bottom Floating Pill Navigation Bar */}
            <BottomNav
                activeTab={activeTab}
                onTabChange={handleTabChange}
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
            />
        </div>
    );
}

export default AppShell;
