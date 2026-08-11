"use client";

import {useBusRouteMap} from "@entities/route/hooks";
import {useBusSortedList} from "@features/live-tracking/useBusSortedList";

import {APP_CONFIG, MAP_SETTINGS, STORAGE_KEYS} from "@shared/config/env";

import BottomNav, {NavTab} from "@shared/ui/BottomNav";
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
    const [isSplashVisible, setIsSplashVisible] = useState(false);
    const [selectedRoute, setSelectedRoute] = useState<string>(MAP_SETTINGS.DEFAULT_ROUTE);
    const [selectedScheduleRoute] = useState<string | undefined>(undefined);

    // Restore saved tab and route preferences from localStorage on mount
    useEffect(() => {
        try {
            const savedTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) as NavTab | null;
            if (savedTab === "map" || savedTab === "schedule") {
                setActiveTab(savedTab);
                if (savedTab === "map") {
                    setIsSplashVisible(true);
                }
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

    const routeMap = useBusRouteMap();
    const allRoutes = useMemo(() => (routeMap ? Object.keys(routeMap) : []), [routeMap]);
    const activeRoute = useMemo(() => {
        if (!routeMap) return selectedRoute;
        if (routeMap[selectedRoute]) return selectedRoute;

        return routeMap[MAP_SETTINGS.DEFAULT_ROUTE] ? MAP_SETTINGS.DEFAULT_ROUTE : Object.keys(routeMap)[0] ?? selectedRoute;
    }, [routeMap, selectedRoute]);

    // Live telemetry for active map route (Suspended automatically when activeTab !== "map")
    const liveBusData = useBusSortedList(activeRoute, activeTab === "map");

    // Handle tab change and persist to localStorage
    const handleTabChange = useCallback((tab: NavTab) => {
        setActiveTab(tab);
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
        handleTabChange("map");
    }, [handleRouteChange, handleTabChange]);

    return (
        <>
            <Splash isVisible={isSplashVisible}/>

            <div
                className="fixed inset-0 flex flex-col w-full h-[100dvh] overflow-hidden bg-slate-50 dark:bg-[#0b0f19]">
                {/* Real-time Map View Container */}
                <div className={`relative flex-1 overflow-hidden ${activeTab === "map" ? "block" : "hidden"}`}>
                    <MapWrapper onReady={handleMapReady}>
                        <RouteLayer
                            routeName={activeRoute}
                            onRouteChange={handleRouteChange}
                        />
                    </MapWrapper>
                </div>

                {/* Bus Timetable Dashboard View Container */}
                <div className={`flex-1 overflow-y-auto ${activeTab === "schedule" ? "block" : "hidden"}`}>
                    <TimetableWidget
                        initialRoute={selectedScheduleRoute}
                        onSelectMapRoute={handleSelectMapRoute}
                    />
                </div>

                {/* Unified Bottom Floating Navigation Bar (Logo + Tabs + Map Controls + Theme Toggle) */}
                <BottomNav
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
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
