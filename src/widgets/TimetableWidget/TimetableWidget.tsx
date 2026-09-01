"use client";

import React, {useCallback, useEffect, useMemo, useState} from "react";
import {BusRoute} from "@shared/types/bus";
import {UI_TEXT} from "@shared/config/locale";
import {STORAGE_KEYS} from "@shared/config/env";
import {NoticeBanner, NoticeModal} from "@widgets/NoticeWidget";
import {Footer} from "@shared/ui/Footer";
import {YonseiTimetableWidget} from "@widgets/YonseiTimetableWidget";
import {CacheInfoBanner} from "./CacheInfoBanner";
import {BookmarkedDeparturesBanner} from "./BookmarkedDeparturesBanner";
import {RouteFilter} from "./RouteFilter";
import {RouteCard} from "./RouteCard";
import {RouteDetailModal} from "./RouteDetailModal";
import {useSchedule} from "@entities/schedule/hooks";
import {AlertTriangle, Bus, CheckCircle2, Info, X} from "lucide-react";

export type TimetableSubTab = "yonsei" | "all";
export type DayMode = "AUTO" | "WEEKDAY" | "VACATION";

interface TimetableWidgetProps {
    subTab?: TimetableSubTab;
    onSubTabChange?: (subTab: TimetableSubTab) => void;
    initialRoute?: string;
    onSelectMapRoute?: (routeName: string) => void;
    dayMode?: DayMode;
    onDayModeChange?: (mode: DayMode) => void;
}

const DEFAULT_BOOKMARK_ROUTES = ["30", "34", "34-1"];

export default function TimetableWidget({
                                            subTab: externalSubTab,
                                            onSubTabChange: _onSubTabChange,
                                            initialRoute: _initialRoute,
                                            onSelectMapRoute,
                                            dayMode,
                                            onDayModeChange,
                                        }: TimetableWidgetProps) {
    const [internalSubTab, setInternalSubTab] = useState<TimetableSubTab>("yonsei");
    const subTab = externalSubTab ?? internalSubTab;

    // Single source of truth: useSchedule hook (SWR managed, zero infinite loop)
    const {
        data,
        routes,
        meta,
        isLoading,
        isRefreshing,
        error,
        refresh,
        refreshToast,
        clearRefreshToast
    } = useSchedule();

    const [isNoticeOpen, setIsNoticeOpen] = useState<boolean>(false);
    const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);

    // Restore saved timetable subtab preference from localStorage if uncontrolled
    useEffect(() => {
        if (!externalSubTab) {
            try {
                const savedSubTab = localStorage.getItem(STORAGE_KEYS.TIMETABLE_SUBTAB) as TimetableSubTab | null;
                if (savedSubTab === "yonsei" || savedSubTab === "all") {
                    setInternalSubTab(savedSubTab);
                }
            } catch (e) {
                console.error("Failed to load timetable subtab from localStorage:", e);
            }
        }
    }, [externalSubTab]);

    const handleOpenNotice = (noticeId?: string) => {
        setSelectedNoticeId(noticeId || null);
        setIsNoticeOpen(true);
    };

    // Filter states for All Routes
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [selectedDayType, setSelectedDayType] = useState<string>("ALL");
    const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
    const [showOnlyBookmarks, setShowOnlyBookmarks] = useState<boolean>(false);

    // Modal & Bookmark States
    const [selectedRoute, setSelectedRoute] = useState<BusRoute | null>(null);
    const [bookmarks, setBookmarks] = useState<string[]>([]);
    const [now, setNow] = useState<Date>(() => new Date());

    // Update live clock every 10 seconds
    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 10000);
        return () => clearInterval(timer);
    }, []);

    // Load bookmarks from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem("wonju_bus_bookmarks");
            if (saved) {
                setBookmarks(JSON.parse(saved));
            } else {
                setBookmarks(DEFAULT_BOOKMARK_ROUTES);
            }
        } catch {
            setBookmarks(DEFAULT_BOOKMARK_ROUTES);
        }
    }, []);

    const toggleBookmark = (routeId: string) => {
        setBookmarks((prev) => {
            const isBookmarked = prev.includes(routeId);
            const next = isBookmarked ? prev.filter((id) => id !== routeId) : [...prev, routeId];
            try {
                localStorage.setItem("wonju_bus_bookmarks", JSON.stringify(next));
            } catch (e) {
                console.error("Failed to save bookmarks:", e);
            }
            return next;
        });
    };

    const isRouteBookmarked = useCallback(
        (route: BusRoute) => bookmarks.includes(route.id) || bookmarks.includes(route.routeNo),
        [bookmarks]
    );

    // Filtered Routes for All Routes Tab
    const filteredRoutes = useMemo(() => {
        if (!routes || routes.length === 0) return [];

        const filtered = routes.filter((route) => {
            // 1. Search Query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchesNo =
                    route.routeNo.toLowerCase() === q ||
                    route.routeNo.toLowerCase().includes(q) ||
                    route.rawNo.toLowerCase().includes(q);
                const matchesOrigin = route.origin.toLowerCase().includes(q);
                const matchesDest = route.destination.toLowerCase().includes(q);
                if (!matchesNo && !matchesOrigin && !matchesDest) return false;
            }

            // 2. Day Type Filter
            if (selectedDayType !== "ALL") {
                if (route.dayType !== selectedDayType) return false;
            }

            // 3. Quick Category Filter
            if (selectedCategory !== "ALL") {
                if (selectedCategory === "2" && !route.routeNo.startsWith("2")) return false;
                if (selectedCategory === "3" && !route.routeNo.startsWith("3") && !route.routeNo.startsWith("4")) return false;
                if (selectedCategory === "6" && !["6", "7", "8"].some((c) => route.routeNo.startsWith(c))) return false;
                if (selectedCategory === "16" && !route.routeNo.startsWith("16")) return false;
                if (selectedCategory === "30" && !["30", "31", "32", "34"].some((c) => route.routeNo.startsWith(c))) return false;
                if (selectedCategory === "41" && !route.routeNo.startsWith("41")) return false;
                if (selectedCategory === "50" && !["50", "51"].some((c) => route.routeNo.startsWith(c))) return false;
            }

            // 4. Bookmark Filter
            if (showOnlyBookmarks) {
                if (!isRouteBookmarked(route)) return false;
            }

            return true;
        });

        // Sort: Bookmarked routes placed at the very TOP
        return [...filtered].sort((a, b) => {
            const aBookmarked = isRouteBookmarked(a) ? 1 : 0;
            const bBookmarked = isRouteBookmarked(b) ? 1 : 0;

            if (aBookmarked !== bBookmarked) {
                return bBookmarked - aBookmarked;
            }

            return a.routeNo.localeCompare(b.routeNo, undefined, {numeric: true});
        });
    }, [routes, searchQuery, selectedDayType, selectedCategory, showOnlyBookmarks, isRouteBookmarked]);

    const totalFilteredCount = filteredRoutes.length;
    const activeBookmarkCount = useMemo(() => {
        if (!routes || routes.length === 0) return bookmarks.length;
        return routes.filter(isRouteBookmarked).length;
    }, [routes, bookmarks.length, isRouteBookmarked]);

    return (
        <div className="w-full flex-1 flex flex-col">
            {subTab === "yonsei" ? (
                <YonseiTimetableWidget
                    onSelectMapRoute={onSelectMapRoute}
                    isEmbedded={true}
                    dayMode={dayMode}
                    onDayModeChange={onDayModeChange}
                />
            ) : (
                <div className="w-full flex flex-col gap-4 sm:gap-6 animate-fadeIn">
                    {/* Refresh Toast Banner */}
                    {refreshToast && (
                        <div
                            className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between transition-all animate-fadeIn shadow-sm ${
                                refreshToast.type === "success"
                                    ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
                                    : refreshToast.type === "error"
                                        ? "bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-200"
                                        : "bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-500/40 text-blue-800 dark:text-blue-200"
                            }`}
                        >
                            <div className="flex items-center space-x-2.5">
                                {refreshToast.type === "success" ? (
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"/>
                                ) : (
                                    <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"/>
                                )}
                                <span className="text-xs sm:text-sm font-semibold">{refreshToast.message}</span>
                            </div>
                            <button
                                onClick={clearRefreshToast}
                                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors shrink-0 ml-2 cursor-pointer"
                                title="닫기"
                            >
                                <X className="h-4 w-4"/>
                            </button>
                        </div>
                    )}

                    {/* ITS Live Notice Banner */}
                    <NoticeBanner onClick={handleOpenNotice}/>

                    {/* Bookmarked Live Departures Banner */}
                    {routes && routes.length > 0 && (
                        <BookmarkedDeparturesBanner
                            routes={routes}
                            bookmarks={bookmarks}
                            currentTime={now}
                            onSelectRoute={(route) => setSelectedRoute(route)}
                        />
                    )}

                    {/* Search & Category Filter Bar */}
                    <RouteFilter
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        selectedDayType={selectedDayType}
                        setSelectedDayType={setSelectedDayType}
                        selectedCategory={selectedCategory}
                        setSelectedCategory={setSelectedCategory}
                        showOnlyBookmarks={showOnlyBookmarks}
                        setShowOnlyBookmarks={setShowOnlyBookmarks}
                        bookmarkCount={activeBookmarkCount}
                        totalFilteredCount={totalFilteredCount}
                    />

                    {/* Error Banner */}
                    {error && (
                        <div
                            className="p-3.5 sm:p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <AlertTriangle
                                    className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-rose-600 dark:text-rose-400"/>
                                <span className="text-xs sm:text-sm font-medium">{error}</span>
                            </div>
                            <button
                                onClick={() => refresh(false)}
                                className="px-2.5 sm:px-3 py-1 rounded-xl bg-rose-200 dark:bg-rose-500/20 hover:bg-rose-300 dark:hover:bg-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
                            >
                                {UI_TEXT.COMMON.RETRY}
                            </button>
                        </div>
                    )}

                    {/* Route Cards Grid */}
                    {isLoading && (!data || routes.length === 0) ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div
                                    key={i}
                                    className="h-48 sm:h-52 backdrop-blur-xl bg-white/40 dark:bg-[#121212]/40 rounded-3xl animate-pulse border border-black/5 dark:border-white/5"
                                />
                            ))}
                        </div>
                    ) : filteredRoutes.length === 0 ? (
                        <div
                            className="backdrop-blur-xl bg-white/80 dark:bg-[#121212]/80 rounded-3xl p-8 sm:p-12 text-center my-6 border border-slate-200 dark:border-slate-800">
                            <Bus className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-slate-400 mb-2 sm:mb-3"/>
                            <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200">
                                {UI_TEXT.TIMETABLE.NO_ROUTES_FOUND}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                                {UI_TEXT.TIMETABLE.NO_ROUTES_DESC}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
                            {filteredRoutes.map((route) => (
                                <RouteCard
                                    key={route.id}
                                    route={route}
                                    isBookmarked={isRouteBookmarked(route)}
                                    onToggleBookmark={(id) => toggleBookmark(id)}
                                    onSelectRoute={(r) => setSelectedRoute(r)}
                                    onSelectMapRoute={onSelectMapRoute}
                                    currentTime={now}
                                />
                            ))}
                        </div>
                    )}

                    {/* Cache Information Banner & Manual Refresh */}
                    <CacheInfoBanner
                        meta={meta}
                        onRefresh={() => refresh(true)}
                        isRefreshing={isRefreshing}
                    />

                    {/* Footer Links */}
                    <Footer/>

                    {/* Detail Modal */}
                    {selectedRoute && (
                        <RouteDetailModal
                            route={selectedRoute}
                            isBookmarked={isRouteBookmarked(selectedRoute)}
                            onToggleBookmark={(id) => toggleBookmark(id)}
                            onSelectMapRoute={onSelectMapRoute}
                            onClose={() => setSelectedRoute(null)}
                            currentTime={now}
                        />
                    )}

                    {/* Notice Detail Modal */}
                    <NoticeModal
                        isOpen={isNoticeOpen}
                        onClose={() => {
                            setIsNoticeOpen(false);
                            setSelectedNoticeId(null);
                        }}
                        initialNoticeId={selectedNoticeId}
                    />
                </div>
            )}
        </div>
    );
}

export {TimetableWidget};
