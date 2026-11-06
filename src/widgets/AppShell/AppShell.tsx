"use client";

import dynamic from "next/dynamic";
import React, {useCallback, useEffect, useMemo, useState} from "react";

import {MAP_SETTINGS} from "@shared/config/env";
import {useBusRouteMap} from "@entities/route/hooks";
import {useCityContext} from "@entities/city";

import {useBusSortedList} from "@features/live-tracking/useBusSortedList";
import {MapRouteHeader} from "@features/map-view/MapRouteHeader";
import {RouteScheduleModal} from "@features/map-view/RouteScheduleModal";

import {isWeekend} from "@shared/lib/timeUtils";
import {BottomNav} from "@widgets/BottomNav";
import {useAppNavigation} from "./hooks/useAppNavigation";

const MapWrapper = dynamic(() => import("@widgets/MapContainer/MapWrapper"), {
    ssr: false,
});
const RouteLayer = dynamic(() => import("@widgets/MapContainer/RouteLayer"), {
    ssr: false,
});

export function AppShell() {
    const {
        dayMode,
        setDayMode,
        selectedRoute,
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

    // Centered floating RouteScheduleModal state (Wonju only)
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [scheduleLocation, setScheduleLocation] = useState<"origin" | "dest">("dest");

    // Handler for opening the centered Route Timetable Modal from Map Pins or Route Header
    const handleOpenSchedule = useCallback(
        (targetRouteOrDoc?: string, location?: "origin" | "dest") => {
            if (!isWonju) return;
            if (targetRouteOrDoc) {
                const cleanRoute = targetRouteOrDoc.replace(/^route:/, "");
                const [targetRoute, routeLoc] = cleanRoute.split(":");
                if (targetRoute && targetRoute !== activeRoute) {
                    handleRouteChange(targetRoute, currentCity.code);
                }
                const parsedLoc = location || (routeLoc === "origin" || routeLoc === "dest" ? routeLoc : undefined);
                if (parsedLoc) {
                    setScheduleLocation(parsedLoc);
                }
            } else if (location) {
                setScheduleLocation(location);
            }
            setIsScheduleModalOpen(true);
        },
        [isWonju, activeRoute, handleRouteChange, currentCity.code]
    );

    // Live telemetry for active map route
    const liveBusData = useBusSortedList(activeRoute, true, currentCity.code);

    // Route Variation state scoped per active route (e.g. 30 base route vs via-Sangji)
    const [variantMap, setVariantMap] = useState<Record<string, string | null>>({});
    const selectedVariantId = variantMap[activeRoute] || null;
    const handleSelectVariant = useCallback((variantId: string | null) => {
        setVariantMap((prev) => ({...prev, [activeRoute]: variantId}));
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
        <div className="fixed inset-0 w-full h-full overflow-hidden bg-slate-50 dark:bg-[#0b0f19]">
            {/* 1. Real-time Map View Container (Main View) */}
            <div className="absolute inset-0 w-full h-full overflow-hidden block">
                <MapRouteHeader
                    selectedRoute={activeRoute}
                    onSelectRoute={handleRouteChange}
                    runningBuses={liveBusData.sortedList}
                    allRoutes={allRoutes}
                    connectionStatus={liveBusData.connectionStatus}
                    hasFetched={liveBusData.hasFetched}
                    isDegraded={liveBusData.isDegraded}
                    onReconnect={liveBusData.reconnect}
                    selectedVariantId={selectedVariantId}
                    onSelectVariant={handleSelectVariant}
                    onOpenScheduleModal={handleOpenSchedule}
                />

                <MapWrapper>
                    <RouteLayer
                        routeName={activeRoute}
                        onRouteChange={handleRouteChange}
                        onOpenScheduleModal={handleOpenSchedule}
                        enabled={true}
                        selectedVariantId={selectedVariantId}
                        cityCode={currentCity.code}
                        dayMode={dayMode}
                        isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                    />
                </MapWrapper>
            </div>

            {/* 2. Centered Floating Full Route Timetable Modal (Wonju only) */}
            {isWonju && (
                <RouteScheduleModal
                    isOpen={isWonju && isScheduleModalOpen}
                    routeName={activeRoute}
                    onClose={() => setIsScheduleModalOpen(false)}
                    dayMode={dayMode}
                    isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                    initialLocation={scheduleLocation}
                />
            )}

            {/* 3. Unified Bottom Floating Pill Navigation Bar */}
            <BottomNav
                dayMode={dayMode}
                onDayModeChange={setDayMode}
                isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                allRoutes={allRoutes}
                selectedRoute={activeRoute}
                onSelectRoute={handleRouteChange}
                selectedVariantId={selectedVariantId}
                onSelectVariant={handleSelectVariant}
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
