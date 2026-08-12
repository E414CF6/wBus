"use client";

import React, {useCallback, useEffect, useMemo, useState} from "react";
import {BusCacheData, BusRoute, CacheMetadata} from "@shared/types/bus";
import {UI_TEXT} from "@shared/config/locale";
import {STORAGE_KEYS} from "@shared/config/env";
import {NoticeBanner, NoticeModal} from "@widgets/NoticeWidget";
import {YonseiTimetableWidget} from "@widgets/YonseiTimetableWidget";
import {CacheInfoBanner} from "./CacheInfoBanner";
import {BookmarkedDeparturesBanner} from "./BookmarkedDeparturesBanner";
import {RouteFilter} from "./RouteFilter";
import {RouteCard} from "./RouteCard";
import {RouteDetailModal} from "./RouteDetailModal";
import {AlertTriangle, Bus, Calendar, CheckCircle2, Info, Star, X} from "lucide-react";

export type TimetableSubTab = "yonsei" | "all";

interface TimetableWidgetProps {
    subTab?: TimetableSubTab;
    onSubTabChange?: (subTab: TimetableSubTab) => void;
    initialRoute?: string;
    onSelectMapRoute?: (routeName: string) => void;
}

const DEFAULT_BOOKMARK_ROUTES = ["30", "34", "34-1"];

export default function TimetableWidget({
                                            subTab: externalSubTab,
                                            onSubTabChange: externalOnSubTabChange,
                                            initialRoute,
                                            onSelectMapRoute,
                                        }: TimetableWidgetProps) {
    const [internalSubTab, setInternalSubTab] = useState<TimetableSubTab>("yonsei");
    const subTab = externalSubTab ?? internalSubTab;
    const [data, setData] = useState<BusCacheData | null>(null);
    const [meta, setMeta] = useState<CacheMetadata | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
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

    const handleSubTabChange = (newSubTab: TimetableSubTab) => {
        if (externalOnSubTabChange) {
            externalOnSubTabChange(newSubTab);
        } else {
            setInternalSubTab(newSubTab);
        }
        try {
            localStorage.setItem(STORAGE_KEYS.TIMETABLE_SUBTAB, newSubTab);
        } catch (e) {
            console.error("Failed to save timetable subtab to localStorage:", e);
        }
    };

    const handleOpenNotice = (noticeId?: string) => {
        setSelectedNoticeId(noticeId || null);
        setIsNoticeOpen(true);
    };

    // Refresh notice toast/banner state
    const [refreshNotice, setRefreshNotice] = useState<{
        type: "success" | "info";
        message: string;
    } | null>(null);

    // Filters state
    const [searchQuery, setSearchQuery] = useState<string>(initialRoute || "");
    const [selectedDayType, setSelectedDayType] = useState<string>("ALL");
    const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
    const [showOnlyBookmarks, setShowOnlyBookmarks] = useState<boolean>(false);

    // Live clock ticker state (updates every 10 seconds for real-time minute recalculation)
    const [now, setNow] = useState<Date>(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 10000);
        return () => clearInterval(timer);
    }, []);

    // Update searchQuery if initialRoute prop changes
    useEffect(() => {
        if (initialRoute) {
            setSearchQuery(initialRoute);
        }
    }, [initialRoute]);

    // Bookmarks in localStorage
    const [bookmarks, setBookmarks] = useState<string[]>([]);

    // Selected route for modal
    const [selectedRoute, setSelectedRoute] = useState<BusRoute | null>(null);

    // Load bookmarks on mount (default to 30, 34, 34-1 if not set)
    useEffect(() => {
        try {
            const saved = localStorage.getItem("wonju_bus_bookmarks");
            if (saved) {
                setBookmarks(JSON.parse(saved));
            } else {
                setBookmarks(DEFAULT_BOOKMARK_ROUTES);
                localStorage.setItem("wonju_bus_bookmarks", JSON.stringify(DEFAULT_BOOKMARK_ROUTES));
            }
        } catch (e) {
            console.error("Failed to load bookmarks from localStorage:", e);
        }
    }, []);

    // Save bookmarks when changed
    const toggleBookmark = (routeId: string) => {
        setBookmarks((prev) => {
            const baseRouteNo = routeId.split("(")[0];
            const isCurrentlyBookmarked = prev.includes(routeId) || prev.includes(baseRouteNo);

            const next = isCurrentlyBookmarked
                ? prev.filter((id) => id !== routeId && id !== baseRouteNo)
                : [...prev, routeId];
            try {
                localStorage.setItem("wonju_bus_bookmarks", JSON.stringify(next));
            } catch (e) {
                console.error("Failed to save bookmarks:", e);
            }
            return next;
        });
    };

    const bookmarkSet = useMemo(() => new Set(bookmarks), [bookmarks]);

    // Helper to check bookmark status (O(1) set lookup, stable reference)
    const isRouteBookmarked = useCallback((route: BusRoute) => {
        return bookmarkSet.has(route.id) || bookmarkSet.has(route.routeNo);
    }, [bookmarkSet]);

    // Fetch data from API (/api/bus)
    const fetchBusData = async (refresh = false) => {
        if (refresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            const endpoint = refresh ? "/api/bus/refresh?force=true" : "/api/bus";
            const method = refresh ? "POST" : "GET";

            const res = await fetch(endpoint, {method});
            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error || UI_TEXT.ERROR.FETCH_FAILED(UI_TEXT.DATA_LABELS.SCHEDULE_DATA, res.status));
            }

            setData(json.data);
            setMeta(json.meta);

            if (refresh) {
                if (json.refreshed) {
                    setRefreshNotice({
                        type: "success",
                        message: json.message || "시간표 데이터가 원주시 ITS에서 새로 수집되어 갱신되었습니다.",
                    });
                } else {
                    setRefreshNotice({
                        type: "info",
                        message: json.message || "최소 갱신 시간이 지나지 않아 시간표를 갱신하지 않고 기존 저장소 JSON 데이터를 사용합니다.",
                    });
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : UI_TEXT.ERROR.UNKNOWN("Fetch Error"));
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchBusData(false);
    }, []);

    // Filter and sort routes (Bookmarked routes placed at the top)
    const filteredRoutes = useMemo(() => {
        if (!data || !data.routes) return [];

        const filtered = data.routes.filter((route) => {
            // 1. Search Query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchesNo = route.routeNo.toLowerCase() === q || route.routeNo.toLowerCase().includes(q) || route.rawNo.toLowerCase().includes(q);
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
                return bBookmarked - aBookmarked; // 1 (bookmarked) comes before 0
            }

            return a.routeNo.localeCompare(b.routeNo, undefined, {numeric: true});
        });
    }, [data, searchQuery, selectedDayType, selectedCategory, showOnlyBookmarks, isRouteBookmarked]);

    const totalRoutesCount = data?.routes ? data.routes.length : 0;
    const activeBookmarkCount = useMemo(() => {
        if (!data || !data.routes) return bookmarks.length;
        return data.routes.filter(isRouteBookmarked).length;
    }, [data, bookmarks.length, isRouteBookmarked]);

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-28 min-h-dvh overflow-y-auto">
            {subTab === "yonsei" ? (
                <YonseiTimetableWidget onSelectMapRoute={onSelectMapRoute} isEmbedded={true}
                                       initialRouteNo={initialRoute}/>
            ) : (
                <>
                    {/* Sleek Hero Header Card */}
                    <div
                        className="mb-6 backdrop-blur-2xl bg-white/70 dark:bg-[#121212]/70 rounded-3xl p-6 border border-black/5 dark:border-white/10 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div
                                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mb-2">
                                    <Calendar className="w-3.5 h-3.5"/>
                                    <span>{UI_TEXT.TIMETABLE.HERO_BADGE}</span>
                                </div>
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                    {UI_TEXT.TIMETABLE.HERO_TITLE}
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">
                                    {UI_TEXT.TIMETABLE.HERO_SUBTITLE}
                                </p>
                            </div>

                            {/* Quick Stats Grid */}
                            <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0">
                                <div
                                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/5">
                                    <div
                                        className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                        <Bus className="w-4 h-4"/>
                                    </div>
                                    <div>
                                        <div
                                            className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{UI_TEXT.TIMETABLE.STATS_TOTAL_ROUTES}</div>
                                        <div
                                            className="text-sm font-black text-slate-900 dark:text-white font-mono">{totalRoutesCount > 0 ? `${totalRoutesCount}개` : "-"}</div>
                                    </div>
                                </div>

                                <div
                                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/5">
                                    <div
                                        className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                        <Star className="w-4 h-4 fill-amber-400/30"/>
                                    </div>
                                    <div>
                                        <div
                                            className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{UI_TEXT.TIMETABLE.STATS_BOOKMARKS}</div>
                                        <div
                                            className="text-sm font-black text-slate-900 dark:text-white font-mono">{activeBookmarkCount}개
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Refresh Notice Banner */}
                    {refreshNotice && (
                        <div
                            className={`p-4 mb-6 rounded-2xl border flex items-center justify-between transition-all animate-fadeIn shadow-lg ${
                                refreshNotice.type === "success"
                                    ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
                                    : "bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-200"
                            }`}
                        >
                            <div className="flex items-center space-x-3">
                                {refreshNotice.type === "success" ? (
                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"/>
                                ) : (
                                    <Info className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"/>
                                )}
                                <span className="text-sm font-medium leading-relaxed">{refreshNotice.message}</span>
                            </div>
                            <button
                                onClick={() => setRefreshNotice(null)}
                                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors shrink-0 ml-3 cursor-pointer"
                                title={UI_TEXT.COMMON.CANCEL}
                            >
                                <X className="h-4 w-4"/>
                            </button>
                        </div>
                    )}

                    {/* Dedicated ITS Notice Center Banner */}
                    <NoticeBanner onClick={(id) => handleOpenNotice(id)}/>

                    {/* Cache Information Banner */}
                    <CacheInfoBanner
                        meta={meta}
                        onRefresh={() => fetchBusData(true)}
                        isRefreshing={isRefreshing}
                    />

                    {/* Dedicated Bookmarked Routes Next Departures Banner */}
                    {data && data.routes && (
                        <BookmarkedDeparturesBanner
                            routes={data.routes}
                            bookmarks={bookmarks}
                            onSelectRoute={(r) => setSelectedRoute(r)}
                            currentTime={now}
                        />
                    )}

                    {/* Error Banner */}
                    {error && (
                        <div
                            className="p-4 mb-6 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400"/>
                                <span className="text-sm font-medium">{error}</span>
                            </div>
                            <button
                                onClick={() => fetchBusData(false)}
                                className="px-3 py-1 rounded-xl bg-rose-200 dark:bg-rose-500/20 hover:bg-rose-300 dark:hover:bg-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
                            >
                                {UI_TEXT.COMMON.RETRY}
                            </button>
                        </div>
                    )}

                    {/* Loading Skeleton */}
                    {isLoading ? (
                        <div className="space-y-6">
                            <div
                                className="h-32 backdrop-blur-xl bg-white/40 dark:bg-[#121212]/40 rounded-2xl animate-pulse border border-black/5 dark:border-white/5"/>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i}
                                         className="h-48 backdrop-blur-xl bg-white/40 dark:bg-[#121212]/40 rounded-2xl animate-pulse border border-black/5 dark:border-white/5"/>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Filter Component */}
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
                                totalFilteredCount={filteredRoutes.length}
                            />

                            {/* Empty State */}
                            {filteredRoutes.length === 0 ? (
                                <div
                                    className="backdrop-blur-xl bg-white/80 dark:bg-[#121212]/80 rounded-3xl p-12 text-center my-12 border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div
                                        className="h-16 w-16 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4 border border-slate-200 dark:border-slate-800">
                                        <Bus className="h-8 w-8 text-slate-400 dark:text-slate-600"/>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                        {UI_TEXT.TIMETABLE.NO_ROUTES_FOUND}
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                                        {UI_TEXT.TIMETABLE.NO_ROUTES_DESC}
                                    </p>
                                    <button
                                        onClick={() => {
                                            setSearchQuery("");
                                            setSelectedDayType("ALL");
                                            setSelectedCategory("ALL");
                                            setShowOnlyBookmarks(false);
                                        }}
                                        className="mt-6 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                                    >
                                        {UI_TEXT.TIMETABLE.ALL_ROUTES_BTN}
                                    </button>
                                </div>
                            ) : (
                                /* Route Cards Grid */
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                        </>
                    )}

                    {/* Route Detail Timetable Modal */}
                    {selectedRoute && (
                        <RouteDetailModal
                            route={selectedRoute}
                            onClose={() => setSelectedRoute(null)}
                            isBookmarked={isRouteBookmarked(selectedRoute)}
                            onToggleBookmark={(id) => toggleBookmark(id)}
                            onSelectMapRoute={onSelectMapRoute}
                            currentTime={now}
                        />
                    )}

                    {/* Wonju ITS Notice Center Modal */}
                    <NoticeModal
                        isOpen={isNoticeOpen}
                        onClose={() => {
                            setIsNoticeOpen(false);
                            setSelectedNoticeId(null);
                        }}
                        initialNoticeId={selectedNoticeId}
                    />
                </>
            )}
        </div>
    );
}
