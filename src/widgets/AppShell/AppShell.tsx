"use client";

import dynamic from "next/dynamic";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {usePathname, useSearchParams} from "next/navigation";

import {APP_CONFIG, MAP_SETTINGS, STORAGE_KEYS} from "@shared/config/env";

import {useSquareComments} from "@entities/comment";
import {useBusRouteMap} from "@entities/route/hooks";

import {useBusSortedList} from "@features/live-tracking/useBusSortedList";
import {MapRouteHeader} from "@features/map-view/MapRouteHeader";

import {isWeekend} from "@shared/lib/timeUtils";
import BottomNav, {type DayMode, type NavTab, type TimetableSubTab} from "@shared/ui/BottomNav";

import {ChatView} from "@widgets/ChatWidget";
import {TimetableWidget} from "@widgets/TimetableWidget";

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

function resolveTabFromPathname(path: string): NavTab {
    if (path.startsWith("/live") || path.startsWith("/map")) return "map";
    if (path.startsWith("/chat") || path.startsWith("/square")) return "chat";
    return "schedule";
}

export function AppShell() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Derive active tab with client-side state preservation across tab switches (avoids destroying map & SSE)
    const [activeTab, setActiveTab] = useState<NavTab>(() => resolveTabFromPathname(pathname));
    const [prevPathname, setPrevPathname] = useState(pathname);
    if (pathname !== prevPathname) {
        setPrevPathname(pathname);
        setActiveTab(resolveTabFromPathname(pathname));
    }

    // Timetable Sub-tab & Day Mode
    const [timetableSubTab, setTimetableSubTab] = useState<TimetableSubTab>(() => {
        const querySubTab = searchParams.get("subTab");
        if (querySubTab === "yonsei" || querySubTab === "all") return querySubTab;
        return "yonsei";
    });
    const [dayMode, setDayMode] = useState<DayMode>("AUTO");

    // Route & Map Activation State
    const [selectedRoute, setSelectedRoute] = useState<string>(() => {
        const queryRoute = searchParams.get("route");
        if (queryRoute) return queryRoute;
        return MAP_SETTINGS.DEFAULT_ROUTE;
    });

    const isMapActive = activeTab === "map";
    const [hasVisitedMap, setHasVisitedMap] = useState<boolean>(() => isMapActive);
    if (isMapActive && !hasVisitedMap) {
        setHasVisitedMap(true);
    }

    // Synchronize route & timetable subtab when searchParams change
    const [prevSearchParams, setPrevSearchParams] = useState(searchParams);
    if (searchParams !== prevSearchParams) {
        setPrevSearchParams(searchParams);
        const queryRoute = searchParams.get("route");
        if (queryRoute && queryRoute !== selectedRoute) {
            setSelectedRoute(queryRoute);
        }
        const querySubTab = searchParams.get("subTab");
        if (querySubTab === "yonsei" || querySubTab === "all") {
            setTimetableSubTab(querySubTab);
        }
    }

    // Handle browser Back/Forward (popstate) navigation cleanly
    useEffect(() => {
        const handlePopState = () => {
            if (typeof window === "undefined") return;
            const nextTab = resolveTabFromPathname(window.location.pathname);
            setActiveTab(nextTab);
            const search = new URLSearchParams(window.location.search);
            const queryRoute = search.get("route");
            if (queryRoute) setSelectedRoute(queryRoute);
            const querySubTab = search.get("subTab");
            if (querySubTab === "yonsei" || querySubTab === "all") {
                setTimetableSubTab(querySubTab);
            }
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    // Scroll to top when changing tabs so map/chat start cleanly
    useEffect(() => {
        if (typeof window !== "undefined") {
            window.scrollTo({top: 0, left: 0, behavior: "instant"});
        }
    }, [activeTab]);

    // Square / Comments State & Realtime live sync (encapsulated)
    const {
        comments,
        isRefreshing: isRefreshingComments,
        refreshComments,
        addComment: handleAddComment,
        likeComment: handleLikeComment,
        deleteComment: handleDeleteComment,
    } = useSquareComments();

    // Live weekend check for timetable badge (updates on minute change, re-renders only at midnight transition)
    const [isTodayWeekendOrHoliday, setIsTodayWeekendOrHoliday] = useState<boolean>(() => isWeekend());
    useEffect(() => {
        const timer = setInterval(() => {
            const current = isWeekend();
            setIsTodayWeekendOrHoliday((prev) => (prev !== current ? current : prev));
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    // Restore saved preferences on initial client mount if not in URL
    useEffect(() => {
        requestAnimationFrame(() => {
            try {
                const savedSubTab = localStorage.getItem(
                    STORAGE_KEYS.TIMETABLE_SUBTAB
                ) as TimetableSubTab | null;
                if (savedSubTab && !searchParams.get("subTab")) {
                    if (savedSubTab === "yonsei" || savedSubTab === "all") {
                        setTimetableSubTab(savedSubTab);
                    }
                }

                const savedRoute = localStorage.getItem(STORAGE_KEYS.ROUTE_ID);
                if (savedRoute && !searchParams.get("route")) {
                    setSelectedRoute(savedRoute);
                }
            } catch (e) {
                if (APP_CONFIG.IS_DEV) {
                    console.warn("[AppShell] Failed to load preferences from localStorage", e);
                }
            }
        });
    }, [searchParams]);

    const handleScheduleSubTabChange = useCallback(
        (subTab: TimetableSubTab) => {
            setTimetableSubTab(subTab);
            try {
                localStorage.setItem(STORAGE_KEYS.TIMETABLE_SUBTAB, subTab);
            } catch (e) {
                if (APP_CONFIG.IS_DEV) {
                    console.warn(
                        "[handleScheduleSubTabChange] Failed to save subtab preference",
                        e
                    );
                }
            }
            if (
                typeof window !== "undefined" &&
                activeTab === "schedule"
            ) {
                const query = subTab === "yonsei" ? "/" : "/?subTab=all";
                window.history.replaceState(null, "", query);
            }
        },
        [activeTab]
    );

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

    // Handle tab change and push to browser history without unmounting AppShell
    const handleTabChange = useCallback(
        (tab: NavTab) => {
            setActiveTab(tab);
            let targetUrl: string;
            if (tab === "map") {
                setHasVisitedMap(true);
                const routeParam = selectedRoute
                    ? `?route=${encodeURIComponent(selectedRoute)}`
                    : "";
                targetUrl = `/live${routeParam}`;
            } else if (tab === "chat") {
                targetUrl = "/square";
            } else {
                const subTabParam = timetableSubTab === "all" ? "?subTab=all" : "";
                targetUrl = `/${subTabParam}`;
            }

            if (typeof window !== "undefined") {
                window.history.pushState(null, "", targetUrl);
            }

            try {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);
            } catch {
                // Ignore
            }
        },
        [selectedRoute, timetableSubTab]
    );

    // Persist route selection to state, localStorage & URL
    const handleRouteChange = useCallback(
        (route: string) => {
            setSelectedRoute(route);
            try {
                // Save to local storage for quick access
                const savedRecent = localStorage.getItem("wbus_recent_map_routes");
                const recents: string[] = savedRecent ? JSON.parse(savedRecent) : [];
                const filtered = recents.filter((r) => r !== route);
                filtered.unshift(route);
                localStorage.setItem(
                    "wbus_recent_map_routes",
                    JSON.stringify(filtered.slice(0, 10))
                );
            } catch {
                // Ignore
            }
            if (
                typeof window !== "undefined" &&
                activeTab === "map"
            ) {
                window.history.replaceState(
                    null,
                    "",
                    `/live?route=${encodeURIComponent(route)}`
                );
            }
        },
        [activeTab]
    );

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

    const handleSelectMapRoute = useCallback(
        (routeName: string) => {
            handleRouteChange(routeName);
            setHasVisitedMap(true);
            setActiveTab("map");
            if (typeof window !== "undefined") {
                window.history.pushState(
                    null,
                    "",
                    `/live?route=${encodeURIComponent(routeName)}`
                );
            }
        },
        [handleRouteChange]
    );

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
                        />
                    </MapWrapper>
                </div>
            )}

            {/* 2. Schedule Timetable View (Yonsei 30,34,34-1 & All Wonju routes) */}
            {activeTab === "schedule" && (
                <main
                    className="w-full min-h-dvh px-3 sm:px-6 lg:px-8 py-6 sm:py-10 pb-32 sm:pb-36 flex flex-col items-center">
                    <div className="w-full max-w-6xl flex-1 flex flex-col">
                        <TimetableWidget
                            subTab={timetableSubTab}
                            onSubTabChange={handleScheduleSubTabChange}
                            onSelectMapRoute={handleSelectMapRoute}
                            dayMode={dayMode}
                            onDayModeChange={setDayMode}
                        />
                    </div>
                </main>
            )}

            {/* 3. Real-time Square View */}
            {activeTab === "chat" && (
                <div
                    className="flex-1 overflow-hidden w-full max-w-6xl mx-auto px-3 sm:px-6 pt-2 sm:pt-4 pb-[calc(env(safe-area-inset-bottom,0)+4.5rem)] sm:pb-[calc(env(safe-area-inset-bottom,0)+5rem)] flex flex-col">
                    <ChatView
                        comments={comments}
                        onAddComment={handleAddComment}
                        onLikeComment={handleLikeComment}
                        onDeleteComment={handleDeleteComment}
                        onRefresh={refreshComments}
                        isRefreshing={isRefreshingComments}
                    />
                </div>
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
                commentCount={comments.length}
            />
        </div>
    );
}

export default AppShell;
