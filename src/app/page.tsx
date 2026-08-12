"use client";

import {useBusRouteMap} from "@entities/route/hooks";
import {useBusSortedList} from "@features/live-tracking/useBusSortedList";

import {APP_CONFIG, MAP_SETTINGS, STORAGE_KEYS} from "@shared/config/env";

import BottomNav, {NavTab, TimetableSubTab} from "@shared/ui/BottomNav";
import Splash from "@shared/ui/Splash";

import {TimetableWidget} from "@widgets/TimetableWidget";

import dynamic from "next/dynamic";
import {useCallback, useEffect, useMemo, useState} from "react";

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

/**
 * Combined wBus Application Page.
 * Integrates Bus Timetables ('시간표') as default main view and Real-time Bus Map ('실시간 지도')
 * into a single unified layout with a floating pill bottom navigation bar containing dynamic route controls.
 */
export default function HomePage() {
    const [activeTab, setActiveTab] = useState<NavTab>("schedule");
    const [timetableSubTab, setTimetableSubTab] = useState<TimetableSubTab>("yonsei");
    const [isSplashVisible, setIsSplashVisible] = useState(false);
    const [selectedRoute, setSelectedRoute] = useState<string>(MAP_SETTINGS.DEFAULT_ROUTE);

    // Track whether user has activated the real-time map view
    const [hasVisitedMap, setHasVisitedMap] = useState<boolean>(false);

    // Restore saved tab and route preferences from localStorage on mount
    useEffect(() => {
        try {
            const savedTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
            if (savedTab === "map" || savedTab === "schedule") {
                setActiveTab(savedTab as NavTab);
                if (savedTab === "map") {
                    setHasVisitedMap(true);
                    setIsSplashVisible(true);
                }
            } else if (savedTab === "yonsei") {
                setActiveTab("schedule");
            }

            const savedSubTab = localStorage.getItem(STORAGE_KEYS.TIMETABLE_SUBTAB) as TimetableSubTab | null;
            if (savedSubTab === "yonsei" || savedSubTab === "all") {
                setTimetableSubTab(savedSubTab);
            }

            const savedRoute = localStorage.getItem(STORAGE_KEYS.ROUTE_ID);
            if (savedRoute) {
                setSelectedRoute(savedRoute);
            }
        } catch (e) {
            if (APP_CONFIG.IS_DEV) {
                console.warn("[HomePage] Failed to load preferences from localStorage", e);
            }
        }
    }, []);

    const handleScheduleSubTabChange = useCallback((subTab: TimetableSubTab) => {
        setTimetableSubTab(subTab);
        if (typeof window !== "undefined") {
            try {
                localStorage.setItem(STORAGE_KEYS.TIMETABLE_SUBTAB, subTab);
            } catch (e) {
                if (APP_CONFIG.IS_DEV) {
                    console.warn("[handleScheduleSubTabChange] Failed to save subtab preference", e);
                }
            }
        }
    }, []);

    const isMapActive = activeTab === "map";

    // Only fetch route map & telemetry when real-time map is active or visited
    const routeMap = useBusRouteMap(hasVisitedMap && isMapActive);
    const allRoutes = useMemo(() => (routeMap ? Object.keys(routeMap) : []), [routeMap]);
    const activeRoute = useMemo(() => {
        if (!routeMap) return selectedRoute;
        if (routeMap[selectedRoute]) return selectedRoute;

        return routeMap[MAP_SETTINGS.DEFAULT_ROUTE] ? MAP_SETTINGS.DEFAULT_ROUTE : Object.keys(routeMap)[0] ?? selectedRoute;
    }, [routeMap, selectedRoute]);

    // Live telemetry for active map route (Suspended automatically when activeTab !== "map" or map not visited)
    const liveBusData = useBusSortedList(activeRoute, hasVisitedMap && isMapActive);

    // Handle tab change and persist to localStorage
    const handleTabChange = useCallback((tab: NavTab) => {
        setActiveTab(tab);
        if (tab === "map") {
            setHasVisitedMap(true);
        }
        if (typeof window !== "undefined") {
            try {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);
            } catch (e) {
                if (APP_CONFIG.IS_DEV) {
                    console.warn("[handleTabChange] Failed to save tab preference to localStorage", e);
                }
            }
        }
    }, []);

    // Persist route selection to localStorage
    const handleRouteChange = useCallback((route: string) => {
        setSelectedRoute(route);
        if (typeof window !== "undefined") {
            try {
                localStorage.setItem(STORAGE_KEYS.ROUTE_ID, route);
            } catch (e) {
                if (APP_CONFIG.IS_DEV) {
                    console.warn("[handleRouteChange] Failed to save route preference to localStorage", e);
                }
            }
        }
    }, []);

    useEffect(() => {
        if (!routeMap) return;
        if (!activeRoute || activeRoute === selectedRoute) return;
        if (typeof window === "undefined") return;
        try {
            localStorage.setItem(STORAGE_KEYS.ROUTE_ID, activeRoute);
        } catch (e) {
            if (APP_CONFIG.IS_DEV) {
                console.warn("[handleRouteChange] Failed to save route preference to localStorage", e);
            }
        }
    }, [routeMap, activeRoute, selectedRoute]);

    const handleMapReady = useCallback(() => {
        setIsSplashVisible(false);
    }, []);

    const handleSelectMapRoute = useCallback((routeName: string) => {
        handleRouteChange(routeName);
        setHasVisitedMap(true);
        handleTabChange("map");
    }, [handleRouteChange, handleTabChange]);

    return (
        <>
            <Splash isVisible={isSplashVisible}/>

            <div
                className="fixed inset-0 flex flex-col w-full h-[100dvh] overflow-hidden bg-slate-50 dark:bg-[#0b0f19]">
                {/* Real-time Map View Container (Lazy mounted ONLY when map is activated by user) */}
                {hasVisitedMap && (
                    <div className={`relative flex-1 overflow-hidden ${activeTab === "map" ? "block" : "hidden"}`}>
                        <MapWrapper onReady={handleMapReady}>
                            <RouteLayer
                                routeName={activeRoute}
                                onRouteChange={handleRouteChange}
                            />
                        </MapWrapper>
                    </div>
                )}

                {/* Bus Timetable Dashboard View Container */}
                <div className={`flex-1 overflow-y-auto ${activeTab === "schedule" ? "block" : "hidden"}`}>
                    <TimetableWidget
                        subTab={timetableSubTab}
                        onSubTabChange={handleScheduleSubTabChange}
                        onSelectMapRoute={handleSelectMapRoute}
                    />
                </div>

                {/* Unified Bottom Floating Navigation Bar (Logo + Tabs + Dynamic Timetable SubTab Pills + Theme Toggle) */}
                <BottomNav
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                    scheduleSubTab={timetableSubTab}
                    onScheduleSubTabChange={handleScheduleSubTabChange}
                    allRoutes={allRoutes}
                    selectedRoute={activeRoute}
                    onSelectRoute={handleRouteChange}
                    runningBuses={liveBusData.sortedList}
                    getDirection={liveBusData.getDirection}
                />
            </div>
        </>
    );
}
