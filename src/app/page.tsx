"use client";

import {useBusRouteMap} from "@entities/route/hooks";
import {useBusSortedList} from "@features/live-tracking/useBusSortedList";
import {APP_CONFIG, MAP_SETTINGS, STORAGE_KEYS} from "@shared/config/env";
import BottomNav, {DayMode, NavTab, TimetableSubTab} from "@shared/ui/BottomNav";
import Splash from "@shared/ui/Splash";
import {TimetableWidget} from "@widgets/TimetableWidget";
import {ChatView} from "@components/ChatView";
import {MapRouteHeader} from "@features/map-view/MapRouteHeader";
import {CommentItem} from "@/types/comment";

import dynamic from "next/dynamic";
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

/**
 * Unified wBus Application Page.
 * Integrates:
 * 1. Bus Timetables ('시간표' - Yonsei 30,34,34-1 & All Wonju routes)
 * 2. Real-time Bus Map ('실시간 지도' - MapLibre live bus GPS tracking & routes)
 * 3. Real-time Chat ('실시간톡' - Live comments, tips, delay reports, and Q&A)
 */
export default function HomePage() {
    const [activeTab, setActiveTab] = useState<NavTab>("schedule");
    const [timetableSubTab, setTimetableSubTab] = useState<TimetableSubTab>("yonsei");
    const [dayMode, setDayMode] = useState<DayMode>("AUTO");
    const [isSplashVisible, setIsSplashVisible] = useState(false);
    const [selectedRoute, setSelectedRoute] = useState<string>(MAP_SETTINGS.DEFAULT_ROUTE);

    // Track whether user has activated the real-time map view
    const [hasVisitedMap, setHasVisitedMap] = useState<boolean>(false);

    // Chat / Comments State
    const [comments, setComments] = useState<CommentItem[]>([]);
    const [isRefreshingComments, setIsRefreshingComments] = useState<boolean>(false);
    const [chatFilterRoute, setChatFilterRoute] = useState<string>("ALL");

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

    // Restore saved tab and preferences from localStorage / URL on mount
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const urlTab = params.get("tab") as NavTab | null;
            if (urlTab === "map" || urlTab === "schedule" || urlTab === "chat") {
                setActiveTab(urlTab);
                if (urlTab === "map") {
                    setHasVisitedMap(true);
                    setIsSplashVisible(true);
                }
                return;
            }

            const savedTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
            if (savedTab === "map" || savedTab === "schedule" || savedTab === "chat") {
                setActiveTab(savedTab as NavTab);
                if (savedTab === "map") {
                    setHasVisitedMap(true);
                    setIsSplashVisible(true);
                }
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
            console.warn("[HomePage] Failed to fetch comments:", err);
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
            console.warn("[HomePage] Failed to like comment:", err);
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
            console.warn("[HomePage] Failed to delete comment:", err);
            throw err;
        }
    };

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
    const allRoutes = useMemo(() => (routeMap ? Object.keys(routeMap) : ["30", "34", "34-1"]), [routeMap]);
    const activeRoute = useMemo(() => {
        if (!routeMap) return selectedRoute;
        if (routeMap[selectedRoute]) return selectedRoute;

        return routeMap[MAP_SETTINGS.DEFAULT_ROUTE] ? MAP_SETTINGS.DEFAULT_ROUTE : Object.keys(routeMap)[0] ?? selectedRoute;
    }, [routeMap, selectedRoute]);

    // Live telemetry for active map route
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
                const url = new URL(window.location.href);
                if (tab === "chat") {
                    url.searchParams.set("tab", "chat");
                } else if (tab === "map") {
                    url.searchParams.set("tab", "map");
                } else {
                    url.searchParams.delete("tab");
                }
                window.history.replaceState({}, "", url.toString());
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
                    <div
                        className="flex-1 overflow-y-auto w-full px-3 sm:px-6 lg:px-8 py-6 sm:py-10 pb-28 sm:pb-32 flex flex-col items-center">
                        <div className="w-full max-w-6xl flex-1 flex flex-col justify-center">
                            <TimetableWidget
                                subTab={timetableSubTab}
                                onSubTabChange={handleScheduleSubTabChange}
                                onSelectMapRoute={handleSelectMapRoute}
                                dayMode={dayMode}
                                onDayModeChange={setDayMode}
                            />
                        </div>
                    </div>
                )}

                {/* 3. Real-time Chat View */}
                {activeTab === "chat" && (
                    <div
                        className="flex-1 overflow-hidden w-full max-w-6xl mx-auto px-3 sm:px-6 pt-2 sm:pt-4 pb-[calc(env(safe-area-inset-bottom,0)+4.5rem)] sm:pb-[calc(env(safe-area-inset-bottom,0)+5rem)] flex flex-col">
                        <ChatView
                            comments={comments}
                            onAddComment={handleAddComment}
                            onLikeComment={handleLikeComment}
                            onDeleteComment={handleDeleteComment}
                            onRefresh={fetchComments}
                            isRefreshing={isRefreshingComments}
                            filterRoute={chatFilterRoute}
                            onFilterRouteChange={setChatFilterRoute}
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
                    onChatFilterRouteChange={setChatFilterRoute}
                    commentCount={comments.length}
                />
            </div>
        </>
    );
}
