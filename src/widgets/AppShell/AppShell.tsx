"use client";

import {useBusRouteMap} from "@entities/route/hooks";
import {useBusSortedList} from "@features/live-tracking/useBusSortedList";
import {APP_CONFIG, MAP_SETTINGS, STORAGE_KEYS} from "@shared/config/env";
import BottomNav, {DayMode, NavTab, TimetableSubTab} from "@shared/ui/BottomNav";
import Splash from "@shared/ui/Splash";
import {TimetableWidget} from "@widgets/TimetableWidget";
import {ChatView} from "@widgets/ChatWidget";
import {MapRouteHeader} from "@features/map-view/MapRouteHeader";
import {CommentItem} from "@/types/comment";

import dynamic from "next/dynamic";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import React, {useCallback, useEffect, useMemo, useState} from "react";

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
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();

    // Derive active tab from current URL pathname
    const activeTab: NavTab = useMemo(() => {
        if (pathname.startsWith("/live") || pathname.startsWith("/map")) return "map";
        if (pathname.startsWith("/chat")) return "chat";
        return "schedule";
    }, [pathname]);

    // Scroll to top when changing tabs so map/chat start cleanly
    useEffect(() => {
        if (typeof window !== "undefined") {
            window.scrollTo({top: 0, left: 0, behavior: "instant"});
        }
    }, [activeTab]);

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
    const [isSplashVisible, setIsSplashVisible] = useState<boolean>(() => isMapActive);

    // Chat / Comments State
    const [comments, setComments] = useState<CommentItem[]>([]);
    const [isRefreshingComments, setIsRefreshingComments] = useState<boolean>(false);
    const [chatFilterRoute, setChatFilterRoute] = useState<string>(() => {
        return searchParams.get("filter") || "ALL";
    });

    // Live clock for holiday / weekend detection
    const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 10000);
        return () => clearInterval(timer);
    }, []);

    const isTodayWeekendOrHoliday = useMemo(() => {
        const day = currentTime.getDay();
        return day === 0 || day === 6;
    }, [currentTime]);

    // Synchronize state when URL / searchParams change (e.g. Browser Back/Forward navigation)
    useEffect(() => {
        if (isMapActive) {
            setHasVisitedMap(true);
        }
    }, [isMapActive]);

    useEffect(() => {
        const queryRoute = searchParams.get("route");
        if (queryRoute && queryRoute !== selectedRoute) {
            setSelectedRoute(queryRoute);
        }
    }, [searchParams, selectedRoute]);

    useEffect(() => {
        const querySubTab = searchParams.get("subTab");
        if (querySubTab === "yonsei" || querySubTab === "all") {
            setTimetableSubTab(querySubTab);
        }
    }, [searchParams]);

    useEffect(() => {
        const queryFilter = searchParams.get("filter");
        if (queryFilter) {
            setChatFilterRoute(queryFilter);
        }
    }, [searchParams]);

    // Restore saved preferences on initial client mount if not in URL
    useEffect(() => {
        try {
            const savedSubTab = localStorage.getItem(STORAGE_KEYS.TIMETABLE_SUBTAB) as TimetableSubTab | null;
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
    }, [searchParams]);

    // Load comments from API
    const fetchComments = useCallback(async (force = false) => {
        setIsRefreshingComments(true);
        try {
            const res = await fetch(
                `/api/comments?force=${force ? "true" : "false"}&t=${Date.now()}`,
                {
                    cache: "no-store",
                    headers: {"Cache-Control": "no-cache"},
                }
            );
            const json = await res.json();
            if (json.success && Array.isArray(json.comments)) {
                setComments(json.comments);
            }
        } catch (err) {
            console.warn("[AppShell] Failed to fetch comments:", err);
        } finally {
            setIsRefreshingComments(false);
        }
    }, []);

    useEffect(() => {
        fetchComments(false);
    }, [fetchComments]);

    const handleAddComment = async (data: {
        author?: string;
        content: string;
        routeNo?: string;
        category?: string;
        parentId?: string;
        replyToAuthor?: string;
        authorTag?: string;
        replyToAuthorTag?: string;
    }) => {
        const res = await fetch("/api/comments", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!json.success) {
            throw new Error(json.error || "댓글 등록에 실패했습니다.");
        }
        if (json.comment) {
            setComments((prev) => [json.comment, ...prev]);
            try {
                const saved = localStorage.getItem("wbus_my_comments");
                const list: string[] = saved ? JSON.parse(saved) : [];
                if (!list.includes(json.comment.id)) {
                    list.push(json.comment.id);
                    localStorage.setItem("wbus_my_comments", JSON.stringify(list));
                }
            } catch {
                // Ignore
            }
        }
    };

    const handleLikeComment = async (id: string) => {
        try {
            const res = await fetch("/api/comments", {
                method: "PATCH",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({id, action: "like"}),
            });
            const json = await res.json();
            if (json.success && json.comment) {
                setComments((prev) =>
                    prev.map((c) => (c.id === id ? json.comment : c))
                );
            }
        } catch (err) {
            console.warn("[AppShell] Failed to like comment:", err);
        }
    };

    const handleDeleteComment = async (id: string, authorTag?: string) => {
        try {
            const params = new URLSearchParams({id});
            if (authorTag) params.set("authorTag", authorTag);
            const res = await fetch(`/api/comments?${params.toString()}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (json.success) {
                setComments((prev) =>
                    prev.map((c) => (c.id === id ? (json.comment || {...c, isDeleted: true}) : c))
                );
            } else {
                throw new Error(json.error || "댓글 삭제에 실패했습니다.");
            }
        } catch (err) {
            console.warn("[AppShell] Failed to delete comment:", err);
            throw err;
        }
    };

    const handleScheduleSubTabChange = useCallback((subTab: TimetableSubTab) => {
        setTimetableSubTab(subTab);
        try {
            localStorage.setItem(STORAGE_KEYS.TIMETABLE_SUBTAB, subTab);
        } catch (e) {
            if (APP_CONFIG.IS_DEV) {
                console.warn("[handleScheduleSubTabChange] Failed to save subtab preference", e);
            }
        }
        if (typeof window !== "undefined" && (pathname === "/" || pathname === "/schedule")) {
            const query = subTab === "yonsei" ? "/" : "/?subTab=all";
            window.history.replaceState(null, "", query);
        }
    }, [pathname]);

    // Only fetch route map & telemetry when real-time map is active or visited
    const routeMap = useBusRouteMap(hasVisitedMap && isMapActive);
    const allRoutes = useMemo(() => (routeMap ? Object.keys(routeMap) : ["30", "34", "34-1"]), [routeMap]);
    const activeRoute = useMemo(() => {
        if (!routeMap) return selectedRoute;
        if (routeMap[selectedRoute]) return selectedRoute;

        return routeMap[MAP_SETTINGS.DEFAULT_ROUTE] ? MAP_SETTINGS.DEFAULT_ROUTE : Object.keys(routeMap)[0] ?? selectedRoute;
    }, [routeMap, selectedRoute]);

    // Live telemetry for active map route
    const liveBusData = useBusSortedList(activeRoute, hasVisitedMap && isMapActive);

    // Handle tab change and push to browser history
    const handleTabChange = useCallback((tab: NavTab) => {
        if (tab === "map") {
            setHasVisitedMap(true);
            const routeParam = selectedRoute ? `?route=${encodeURIComponent(selectedRoute)}` : "";
            router.push(`/live${routeParam}`);
        } else if (tab === "chat") {
            const filterParam = chatFilterRoute !== "ALL" ? `?filter=${encodeURIComponent(chatFilterRoute)}` : "";
            router.push(`/chat${filterParam}`);
        } else {
            const subTabParam = timetableSubTab === "all" ? "?subTab=all" : "";
            router.push(`/${subTabParam}`);
        }
        try {
            localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);
        } catch {
            // Ignore
        }
    }, [router, selectedRoute, chatFilterRoute, timetableSubTab]);

    // Persist route selection to state, localStorage & URL
    const handleRouteChange = useCallback((route: string) => {
        setSelectedRoute(route);
        try {
            localStorage.setItem(STORAGE_KEYS.ROUTE_ID, route);
        } catch (e) {
            if (APP_CONFIG.IS_DEV) {
                console.warn("[handleRouteChange] Failed to save route preference to localStorage", e);
            }
        }
        if (typeof window !== "undefined" && (pathname.startsWith("/live") || pathname.startsWith("/map"))) {
            window.history.replaceState(null, "", `/live?route=${encodeURIComponent(route)}`);
        }
    }, [pathname]);

    useEffect(() => {
        if (!routeMap) return;
        if (!activeRoute || activeRoute === selectedRoute) return;
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
        router.push(`/live?route=${encodeURIComponent(routeName)}`);
    }, [handleRouteChange, router]);

    const handleChatFilterRouteChange = useCallback((route: string) => {
        setChatFilterRoute(route);
        if (typeof window !== "undefined" && pathname.startsWith("/chat")) {
            const query = route === "ALL" ? "/chat" : `/chat?filter=${encodeURIComponent(route)}`;
            window.history.replaceState(null, "", query);
        }
    }, [pathname]);

    const isFixedLayout = activeTab !== "schedule";

    return (
        <>
            <Splash isVisible={isSplashVisible}/>

            <div
                className={
                    isFixedLayout
                        ? "fixed inset-0 flex flex-col w-full h-[100dvh] overflow-hidden bg-slate-50 dark:bg-[#0b0f19]"
                        : "relative min-h-[100dvh] w-full flex flex-col bg-slate-50 dark:bg-[#0b0f19]"
                }
            >
                {/* 1. Real-time Map View Container (Lazy mounted ONLY when map is activated by user) */}
                {hasVisitedMap && (
                    <div className={`relative flex-1 overflow-hidden ${activeTab === "map" ? "block" : "hidden"}`}>
                        {/* Map Top Floating Header & Fast Route Switcher */}
                        <MapRouteHeader
                            selectedRoute={activeRoute}
                            onSelectRoute={handleRouteChange}
                            runningBuses={liveBusData.sortedList}
                            allRoutes={allRoutes}
                        />

                        <MapWrapper onReady={handleMapReady}>
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
                        className="w-full min-h-[100dvh] px-3 sm:px-6 lg:px-8 py-6 sm:py-10 pb-32 sm:pb-36 flex flex-col items-center"
                    >
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

                {/* 3. Real-time Chat View */}
                {activeTab === "chat" && (
                    <div
                        className="flex-1 overflow-hidden w-full max-w-6xl mx-auto px-3 sm:px-6 pt-2 sm:pt-4 pb-[calc(env(safe-area-inset-bottom,0)+4.5rem)] sm:pb-[calc(env(safe-area-inset-bottom,0)+5rem)] flex flex-col"
                    >
                        <ChatView
                            comments={comments}
                            onAddComment={handleAddComment}
                            onLikeComment={handleLikeComment}
                            onDeleteComment={handleDeleteComment}
                            onRefresh={fetchComments}
                            isRefreshing={isRefreshingComments}
                            filterRoute={chatFilterRoute}
                            onFilterRouteChange={handleChatFilterRouteChange}
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
                    chatFilterRoute={chatFilterRoute}
                    onChatFilterRouteChange={handleChatFilterRouteChange}
                    commentCount={comments.length}
                />
            </div>
        </>
    );
}
