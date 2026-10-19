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
import {TransitWiki} from "@widgets/TransitWiki";
import {useAppNavigation} from "./hooks/useAppNavigation";

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
        wikiDocId,
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

    // Handler for opening the Transit Wiki Drawer directly from Map Pins, Route Header, or Stop Popups
    const handleOpenWiki = useCallback(
        (docOrSubTab?: string) => {
            if (docOrSubTab) {
                handleScheduleSubTabChange(docOrSubTab);
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

    // Live telemetry for active map route
    const liveBusData = useBusSortedList(activeRoute, hasVisitedMap && isMapActive, currentCity.code);

    // Direction filter for map polyline rendering (all, up, down)
    const [selectedDirection, setSelectedDirection] = useState<"all" | "up" | "down">("all");
    const [prevActiveRoute, setPrevActiveRoute] = useState(activeRoute);
    if (activeRoute !== prevActiveRoute) {
        setPrevActiveRoute(activeRoute);
        setSelectedDirection("all");
    }

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
                    onSelectDirection={setSelectedDirection}
                    onOpenScheduleModal={handleOpenWiki}
                />

                <MapWrapper>
                    <RouteLayer
                        routeName={activeRoute}
                        onRouteChange={handleRouteChange}
                        onOpenScheduleModal={handleOpenWiki}
                        enabled={true}
                        selectedDirection={selectedDirection}
                        cityCode={currentCity.code}
                    />
                </MapWrapper>
            </div>

            {/* 2. Integrated Transit Wiki Drawer (Replaces all specialized timetable/shuttle/notice modals) */}
            {activeTab === "schedule" && (
                <TransitWiki
                    initialDocId={wikiDocId}
                    onDocChange={(docId) => handleScheduleSubTabChange(docId)}
                    onClose={() => handleTabChange("map")}
                    onSelectMapRoute={handleSelectMapRoute}
                    allRouteNames={allRoutes}
                    dayMode={dayMode}
                    onDayModeChange={setDayMode}
                    isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                />
            )}

            {/* 3. Unified Bottom Floating Pill Navigation Bar */}
            <BottomNav
                activeTab={activeTab}
                onTabChange={handleTabChange}
                showScheduleTab={true}
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
