"use client";

import dynamic from "next/dynamic";
import React, {useCallback, useEffect, useMemo, useState} from "react";

import {MAP_SETTINGS} from "@shared/config/env";
import {useBusRouteMap} from "@entities/route/hooks";
import {useCityContext} from "@entities/city";

import {useBusSortedList} from "@features/live-tracking/useBusSortedList";
import {MapRouteHeader} from "@features/map-view/MapRouteHeader";

import {isWeekend} from "@shared/lib/timeUtils";
import {BottomNav} from "@widgets/BottomNav";
import {useAppNavigation} from "./hooks/useAppNavigation";

const MapWrapper = dynamic(() => import("@widgets/MapContainer/MapWrapper"), {
    ssr: false,
});
const RouteLayer = dynamic(() => import("@widgets/MapContainer/RouteLayer"), {
    ssr: false,
});
const RouteScheduleModal = dynamic(() => import("@features/map-view/RouteScheduleModal"), {
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
    } = useAppNavigation();

    // Live weekend check for timetable badge
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

    // Close wiki drawer on Escape key press
    useEffect(() => {
        if (activeTab !== "schedule") return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                handleTabChange("map");
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeTab, handleTabChange]);

    // Fetch route map for current city
    const routeMap = useBusRouteMap(true, currentCity.code);
    const allRoutes = useMemo(
        () => (routeMap ? Object.keys(routeMap) : isWonju ? ["30", "34", "34-1"] : []),
        [routeMap, isWonju]
    );
    const activeRoute = useMemo(() => {
        if (!routeMap || Object.keys(routeMap).length === 0) return selectedRoute;
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const urlCityCode = params.get("cityCode") || params.get("city");
            if (urlCityCode && urlCityCode !== currentCity.code) {
                return selectedRoute;
            }
        }
        if (routeMap[selectedRoute]) return selectedRoute;

        if (isWonju && routeMap[MAP_SETTINGS.DEFAULT_ROUTE]) {
            return MAP_SETTINGS.DEFAULT_ROUTE;
        }
        return Object.keys(routeMap)[0] ?? selectedRoute;
    }, [routeMap, selectedRoute, isWonju, currentCity.code]);

    // Handler for opening the Route Timetable Modal directly from Map Pins, Route Header, or Stop Popups
    const handleOpenSchedule = useCallback(
        (targetRouteOrDoc?: string) => {
            if (!isWonju) return;
            if (targetRouteOrDoc) {
                const cleanRoute = targetRouteOrDoc.replace(/^route:/, "");
                if (cleanRoute && cleanRoute !== activeRoute) {
                    handleRouteChange(cleanRoute, currentCity.code);
                }
            }
            handleTabChange("schedule");
        },
        [isWonju, activeRoute, handleRouteChange, currentCity.code, handleTabChange]
    );

    // Live telemetry for active map route
    const liveBusData = useBusSortedList(activeRoute, hasVisitedMap && isMapActive, currentCity.code);

    // Direction filter for map polyline rendering (all, up, down) scoped per active route
    const [directionMap, setDirectionMap] = useState<Record<string, "all" | "up" | "down">>({});
    const selectedDirection = directionMap[activeRoute] || "all";
    const handleSelectDirection = useCallback((dir: "all" | "up" | "down") => {
        setDirectionMap((prev) => ({...prev, [activeRoute]: dir}));
    }, [activeRoute]);

    useEffect(() => {
        if (!routeMap || Object.keys(routeMap).length === 0) return;
        if (!activeRoute || activeRoute === selectedRoute) return;
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const urlCityCode = params.get("cityCode") || params.get("city");
            if (urlCityCode && urlCityCode !== currentCity.code) {
                return;
            }
        }
        handleRouteChange(activeRoute, currentCity.code);
    }, [routeMap, activeRoute, selectedRoute, currentCity.code, handleRouteChange]);

    return (
        <div className="fixed inset-0 flex flex-col w-full h-full min-h-[100lvh] overflow-hidden bg-slate-50 dark:bg-[#0b0f19]">
            {/* 1. Real-time Map View Container */}
            <div className="relative flex-1 w-full h-full overflow-hidden">
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
                    onSelectDirection={handleSelectDirection}
                    onOpenScheduleModal={handleOpenSchedule}
                />

                <MapWrapper>
                    <RouteLayer
                        routeName={activeRoute}
                        onRouteChange={handleRouteChange}
                        onOpenScheduleModal={handleOpenSchedule}
                        enabled={true}
                        selectedDirection={selectedDirection}
                        cityCode={currentCity.code}
                        dayMode={dayMode}
                        isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                    />
                </MapWrapper>
            </div>

            {/* 2. Route-Focused Timetable Modal (Wonju Only) */}
            {isWonju && activeTab === "schedule" && (
                <RouteScheduleModal
                    isOpen={true}
                    routeName={activeRoute}
                    onClose={() => handleTabChange("map")}
                    dayMode={dayMode}
                    isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                />
            )}

            {/* 3. Unified Bottom Floating Pill Navigation Bar */}
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
