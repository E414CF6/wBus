"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import Link from "next/link";
import {Bus, ChevronRight, Clock, GraduationCap, MapPin, Navigation, Search, Star, X} from "lucide-react";
import {
    getRouteMeta,
    resolveRouteCategory,
    type RouteCategoryInfo,
    RouteMeta,
    useRecentRoutes,
    useRouteBookmarks,
    YONSEI_ROUTE_SET,
} from "@entities/route";
import {UI_TEXT} from "@shared/config/locale";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {buildPageHref, SPECIAL_PAGE_IDS} from "@shared/config/pages";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {useCityContext, useCityFeatures} from "@entities/city";
import {useCityRoutes} from "@entities/route/hooks";
import {useBusStop, useFavoriteStops} from "@entities/station/hooks";
import type {BusStop} from "@entities/station/types";
import {matchesHangul} from "@shared/utils/hangul";
import {triggerHaptic} from "@shared/utils/haptics";
import {isCoarsePointerDevice, isDesktopViewport, markModalNavigating, markModalReplacing, Modal} from "@shared/ui";

// ----------------------------------------------------------------------
// Types & Constants
// ----------------------------------------------------------------------

interface RouteSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    allRoutes: string[];
    selectedRoute: string;
    onSelectRoute: (routeName: string) => void;
    recentRoutes?: string[];
}

function sortRoutes(routes: string[]): string[] {
    return [...routes].sort((a, b) =>
        a.localeCompare(b, undefined, {numeric: true, sensitivity: "base"})
    );
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

export const RouteSelectModal: React.FC<RouteSelectModalProps> = ({
                                                                      isOpen,
                                                                      onClose,
                                                                      allRoutes,
                                                                      selectedRoute,
                                                                      onSelectRoute,
                                                                  }) => {
    const {currentCity} = useCityContext();
    const {hasUniversityShuttle} = useCityFeatures();
    const {map} = useAppMapContext();
    const {settings} = useAppSettings();

    // Direct nationwide route list fetch for current city
    const {routes: cityRoutes = []} = useCityRoutes(currentCity.code);
    const {favoriteStops, isFavoriteStop, toggleFavoriteStop} = useFavoriteStops(currentCity.code);
    const currentRouteStops = useBusStop(isOpen ? selectedRoute : "", currentCity.code);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

    // City-scoped bookmarks & recent history
    const {bookmarks, toggleBookmark: toggleRouteBookmark} = useRouteBookmarks(currentCity.code);
    const {recentRoutes, addRecentRoute} = useRecentRoutes(currentCity.code);

    const searchInputRef = useRef<HTMLInputElement>(null);

    // Reset search when modal is opened
    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (isOpen) {
            setSearchQuery("");
            setSelectedCategory("ALL");
        }
    }

    // Toggle bookmark helper
    const toggleBookmark = useCallback((e: React.MouseEvent, route: string) => {
        e.stopPropagation();
        toggleRouteBookmark(route);
    }, [toggleRouteBookmark]);

    // Select route & update recent routes history
    const handleSelect = useCallback(
        (route: string) => {
            triggerHaptic("selection");
            onSelectRoute(route);
            addRecentRoute(route);
            onClose();
        },
        [onSelectRoute, addRecentRoute, onClose]
    );

    // Select a stop (fly to stop & open live arrival popup)
    const handleSelectStop = useCallback(
        (stop: BusStop) => {
            triggerHaptic("selection");
            if (map && stop.gpslong && stop.gpslati) {
                map.flyTo({
                    center: [stop.gpslong, stop.gpslati],
                    zoom: Math.max(map.getZoom(), 16.2),
                    duration: 950,
                });
            }
            if (!isDesktopViewport()) {
                markModalReplacing("route");
            }
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("wbus:focus-stop", {detail: stop}));
            }
            onClose();
        },
        [map, onClose]
    );

    // Auto-focus on open (skip on touch-only devices to avoid unsolicited virtual keyboard popup)
    useEffect(() => {
        if (isOpen && !isCoarsePointerDevice()) {
            const timer = setTimeout(() => {
                searchInputRef.current?.focus();
            }, 60);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Compute effective route list for the modal
    const effectiveAllRoutes = useMemo(() => {
        if (cityRoutes && cityRoutes.length > 0) {
            return Array.from(new Set(cityRoutes.map((r) => String(r.routeno))));
        }
        return allRoutes.filter(Boolean);
    }, [cityRoutes, allRoutes]);

    // Sorted base list of all routes
    const sortedAllRoutes = useMemo(() => sortRoutes(effectiveAllRoutes), [effectiveAllRoutes]);

    // Precomputed metadata mapping
    const routeMetaMap = useMemo(() => {
        const map = new Map<string, RouteMeta>();
        for (const route of sortedAllRoutes) {
            map.set(route, getRouteMeta(route, currentCity.code));
        }
        return map;
    }, [sortedAllRoutes, currentCity.code]);

    // Direct raw routetp mapping from city routes
    const rawTypeMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const r of cityRoutes) {
            const no = String(r.routeno);
            if (r.routetp && !map.has(no)) {
                map.set(no, r.routetp);
            }
        }
        return map;
    }, [cityRoutes]);

    // Automatic classification map per route
    const routeCategoryMap = useMemo(() => {
        const map = new Map<string, RouteCategoryInfo>();
        for (const route of sortedAllRoutes) {
            const rawType = rawTypeMap.get(route) || routeMetaMap.get(route)?.routeType;
            map.set(route, resolveRouteCategory(rawType));
        }
        return map;
    }, [sortedAllRoutes, rawTypeMap, routeMetaMap]);

    // Automatically discovered categories based on actual routes in current city
    const dynamicCategories = useMemo(() => {
        const counts = new Map<string, { info: RouteCategoryInfo; count: number }>();
        for (const r of sortedAllRoutes) {
            const cat = routeCategoryMap.get(r);
            if (!cat) continue;
            const existing = counts.get(cat.id);
            if (existing) {
                existing.count += 1;
            } else {
                counts.set(cat.id, {info: cat, count: 1});
            }
        }

        return Array.from(counts.values())
            .sort((a, b) => a.info.order - b.info.order)
            .map(({info, count}) => ({
                id: info.id,
                label: `${info.label} (${count})`,
                dotClass: info.dotClass,
                activeClass: info.activeClass,
            }));
    }, [sortedAllRoutes, routeCategoryMap]);

    const categories = useMemo(() => {
        const bookmarkedCount = sortedAllRoutes.filter((r) => bookmarks.includes(r)).length;

        const list: {
            id: string;
            label: string;
            icon?: React.ComponentType<{ className?: string }>;
            dotClass?: string;
            activeClass?: string;
        }[] = [
            {
                id: "ALL",
                label: UI_TEXT.ROUTE_SELECT.CATEGORY_ALL(sortedAllRoutes.length),
                activeClass: "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md shadow-black/10 dark:shadow-white/10 scale-[1.02]",
            },
            {
                id: "BOOKMARKS",
                label: UI_TEXT.ROUTE_SELECT.CATEGORY_BOOKMARKS(bookmarkedCount),
                icon: Star,
                activeClass: "bg-amber-500 text-white shadow-md shadow-amber-500/30 scale-[1.02]",
            },
        ];

        if (favoriteStops.length > 0) {
            list.push({
                id: "FAV_STOPS",
                label: `정류장 즐겨찾기 (${favoriteStops.length})`,
                icon: MapPin,
                activeClass: "bg-amber-500 text-white shadow-md shadow-amber-500/30 scale-[1.02]",
            });
        }

        if (hasUniversityShuttle && settings.showYonseiFeatures) {
            list.push({
                id: "YONSEI",
                label: UI_TEXT.ROUTE_SELECT.CATEGORY_YONSEI,
                icon: GraduationCap,
                activeClass: "bg-[#003876] text-white shadow-md shadow-[#003876]/30 scale-[1.02]",
            });
        }

        // Add automatically discovered route type groups (e.g. 공항, 좌석, 일반, 순환, 간선, 지선, 마을...)
        for (const cat of dynamicCategories) {
            list.push(cat);
        }

        return list;
    }, [hasUniversityShuttle, settings.showYonseiFeatures, sortedAllRoutes, bookmarks, favoriteStops.length, dynamicCategories]);

    // Fallback selected category to ALL if current category does not exist in active categories
    const effectiveCategory = useMemo(() => {
        if (selectedCategory !== "ALL" && !categories.some((c) => c.id === selectedCategory)) {
            return "ALL";
        }
        return selectedCategory;
    }, [categories, selectedCategory]);

    // Filter stops based on Search Query or FAV_STOPS Category (supports Korean Choseong)
    const matchedStops = useMemo<BusStop[]>(() => {
        const q = searchQuery.trim();
        if (!q && effectiveCategory !== "FAV_STOPS") return [];

        const deduped = new Map<string, BusStop>();
        for (const fav of favoriteStops) {
            deduped.set(fav.nodeid, {
                nodeid: fav.nodeid,
                nodenm: fav.nodenm,
                nodeno: fav.nodeno,
                gpslati: fav.gpslati,
                gpslong: fav.gpslong,
            });
        }

        if (effectiveCategory !== "FAV_STOPS") {
            for (const s of currentRouteStops) {
                if (!deduped.has(s.nodeid)) {
                    deduped.set(s.nodeid, s);
                }
            }
        }

        const allCandidateStops = Array.from(deduped.values());
        if (!q) return allCandidateStops;

        return allCandidateStops
            .filter(
                (s) =>
                    matchesHangul(s.nodenm, q) ||
                    String(s.nodeno ?? "").toLowerCase().includes(q.toLowerCase())
            )
            .slice(0, 12);
    }, [searchQuery, effectiveCategory, favoriteStops, currentRouteStops]);

    // Filter routes based on Category and Search Query (supports Korean Choseong)
    const filteredRoutes = useMemo(() => {
        if (effectiveCategory === "FAV_STOPS" && !searchQuery.trim()) {
            return [];
        }

        let list = sortedAllRoutes;

        // Apply Category
        if (effectiveCategory === "BOOKMARKS") {
            list = list.filter((r) => bookmarks.includes(r));
        } else if (effectiveCategory === "YONSEI") {
            list = list.filter((r) => YONSEI_ROUTE_SET.has(r));
        } else if (effectiveCategory !== "ALL" && effectiveCategory !== "FAV_STOPS") {
            list = list.filter((r) => routeCategoryMap.get(r)?.id === effectiveCategory);
        }

        // Apply Search Query (Matches routeNo, origin, destination, description, routeType, category label)
        const q = searchQuery.trim();
        if (q) {
            list = list.filter((r) => {
                const meta = routeMetaMap.get(r);
                const category = routeCategoryMap.get(r);
                const matchNo = matchesHangul(r, q);
                const matchOrigin = meta ? matchesHangul(meta.origin, q) : false;
                const matchDest = meta ? matchesHangul(meta.destination, q) : false;
                const matchDesc = meta?.description ? matchesHangul(meta.description, q) : false;
                const matchType = meta?.routeType ? matchesHangul(meta.routeType, q) : false;
                const matchCategory = category ? matchesHangul(category.label, q) : false;
                return matchNo || matchOrigin || matchDest || matchDesc || matchType || matchCategory;
            });
        }

        return list;
    }, [sortedAllRoutes, effectiveCategory, searchQuery, bookmarks, routeCategoryMap, routeMetaMap]);

    const validRecentRoutes = recentRoutes.filter((r) => sortedAllRoutes.includes(r));

    // Visible-windowing incremental rendering state for large route lists (reset during render on filter changes)
    const [prevFilter, setPrevFilter] = useState({searchQuery, effectiveCategory});
    const [visibleCount, setVisibleCount] = useState(36);

    if (prevFilter.searchQuery !== searchQuery || prevFilter.effectiveCategory !== effectiveCategory) {
        setPrevFilter({searchQuery, effectiveCategory});
        setVisibleCount(36);
    }

    const handleScroll = useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 360) {
                setVisibleCount((prev) =>
                    prev < filteredRoutes.length ? Math.min(prev + 36, filteredRoutes.length) : prev
                );
            }
        },
        [filteredRoutes.length]
    );

    const visibleRoutes = useMemo(() => {
        return filteredRoutes.slice(0, visibleCount);
    }, [filteredRoutes, visibleCount]);

    const modalIcon = (
        <div
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/25 shrink-0">
            <Bus className="w-5 h-5"/>
        </div>
    );

    const headerBadge = (
        <div className="flex items-center gap-1.5 flex-wrap">
            <div
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 select-none"
                title={`현재 지도 뷰포인트: ${currentCity.name}`}
            >
                <MapPin className="w-3 h-3"/>
                <span>{currentCity.name}</span>
            </div>
            <span
                className="px-2 py-0.5 rounded-full text-[11px] font-black bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {UI_TEXT.ROUTE_SELECT.CURRENT_ROUTE_PREFIX(selectedRoute)}
            </span>
        </div>
    );

    const modalFooter = (
        <>
            <div className="flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0"/>
                <span className="truncate">
                    {UI_TEXT.ROUTE_SELECT.CURRENT_ROUTE_LABEL}{" "}
                    <strong className="text-slate-900 dark:text-white font-extrabold">
                        {UI_TEXT.COMMON.ROUTE_LABEL(selectedRoute)}
                    </strong>
                    {" "}({routeMetaMap.get(selectedRoute)?.origin} ↔ {routeMetaMap.get(selectedRoute)?.destination})
                </span>
            </div>
            <span
                className="font-semibold shrink-0">{UI_TEXT.ROUTE_SELECT.DISPLAYED_COUNT(filteredRoutes.length)}</span>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={UI_TEXT.ROUTE_SELECT.MODAL_TITLE}
            subtitle={UI_TEXT.ROUTE_SELECT.TOTAL_ROUTES_COUNT(sortedAllRoutes.length, currentCity.name)}
            icon={modalIcon}
            headerBadge={headerBadge}
            footer={modalFooter}
            maxWidth="2xl"
            height="default"
            modalId="route"
            ariaLabel={UI_TEXT.ROUTE_SELECT.MODAL_ARIA}
        >
            {/* Search Bar Input */}
            <div className="px-4 sm:px-6 pt-3 pb-2 shrink-0">
                <div className="relative flex items-center">
                    <Search className="w-4.5 h-4.5 absolute left-3.5 text-slate-400 pointer-events-none"/>
                    <input
                        ref={searchInputRef}
                        id="route-search-input"
                        name="route-search"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={UI_TEXT.ROUTE_SELECT.SEARCH_PLACEHOLDER}
                        aria-label={UI_TEXT.ROUTE_SELECT.SEARCH_PLACEHOLDER}
                        className="w-full pl-10 pr-10 py-2.5 sm:py-3 bg-black/[0.03] dark:bg-white/[0.05] border border-black/8 dark:border-white/10 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                            aria-label={UI_TEXT.ROUTE_SELECT.CLEAR_SEARCH_ARIA}
                        >
                            <X className="w-4 h-4"/>
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Access Section */}
            {!searchQuery && validRecentRoutes.length > 0 && (
                <div
                    className="px-4 sm:px-6 py-2 flex items-center gap-2 overflow-x-auto custom-scrollbar-hidden shrink-0 border-b border-black/5 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.02]">
                    <div
                        className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                        <Clock className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400"/>
                        <span>{UI_TEXT.ROUTE_SELECT.RECENT_SEARCH_LABEL}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        {validRecentRoutes.map((r) => {
                            const isCurrent = r === selectedRoute;
                            return (
                                <button
                                    key={`recent-${r}`}
                                    type="button"
                                    onClick={() => handleSelect(r)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer active:scale-95 ${
                                        isCurrent
                                            ? "bg-blue-600 text-white shadow-xs"
                                            : "bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 border border-black/5 dark:border-white/10 shadow-2xs"
                                    }`}
                                >
                                    {UI_TEXT.COMMON.ROUTE_LABEL(r)}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Category Filter Chips Bar */}
            {!searchQuery && (
                <div
                    className="px-4 sm:px-6 py-2.5 flex items-center gap-1.5 overflow-x-auto custom-scrollbar-hidden shrink-0 border-b border-black/5 dark:border-white/5">
                    {categories.map((cat) => {
                        const Icon = cat.icon;
                        const isActive = effectiveCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                                    isActive
                                        ? cat.activeClass || "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md shadow-black/10 dark:shadow-white/10 scale-[1.02]"
                                        : "bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/5"
                                }`}
                            >
                                {Icon && <Icon
                                    className={`w-3.5 h-3.5 ${cat.id === "BOOKMARKS" && isActive ? "fill-white" : ""}`}/>}
                                {!isActive && cat.dotClass &&
                                    <span className={`w-2 h-2 rounded-full ${cat.dotClass}`}/>}
                                <span>{cat.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Route & Stop List Display Section */}
            <div
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 sm:p-6 pt-2 sm:pt-3 custom-scrollbar space-y-4"
            >
                {/* Yonsei Mirae Campus Dedicated Hub Banner (Wonju Only) */}
                {hasUniversityShuttle && settings.showYonseiFeatures && !searchQuery && (
                    <Link
                        href={buildPageHref(SPECIAL_PAGE_IDS.YONSEI_MIRAE)}
                        onClick={() => {
                            markModalNavigating();
                            onClose();
                        }}
                        className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-[#003876] to-blue-800 text-white shadow-sm hover:shadow-md transition-all active:scale-[0.99] group"
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/15 shrink-0">
                                <GraduationCap className="w-5 h-5"/>
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-black tracking-tight truncate">
                                    연세대학교 미래캠퍼스 전용 페이지
                                </p>
                                <p className="text-[11px] font-semibold text-sky-100/90 truncate">
                                    무료 셔틀버스 · 30/34/34-1번 등·하교 통합 허브 바로가기
                                </p>
                            </div>
                        </div>
                        <ChevronRight
                            className="w-4 h-4 shrink-0 text-white/80 group-hover:translate-x-0.5 transition-transform"/>
                    </Link>
                )}
                {/* Matched Stops Section (Shown when searching or in FAV_STOPS category) */}
                {matchedStops.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-2 px-1">
                            <span
                                className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-amber-500"/>
                                <span>
                                    {effectiveCategory === "FAV_STOPS" && !searchQuery.trim()
                                        ? `즐겨찾는 정류장 (${matchedStops.length})`
                                        : `정류장 검색 결과 (${matchedStops.length})`}
                                </span>
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400">
                                선택 시 해당 정류장 도착정보 팝업 열림
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {matchedStops.map((stop) => {
                                const isFav = isFavoriteStop(stop.nodeid);
                                return (
                                    <div
                                        key={`modal-stop-${stop.nodeid}`}
                                        onClick={() => handleSelectStop(stop)}
                                        className="group flex items-center justify-between p-3 rounded-2xl bg-amber-500/[0.04] hover:bg-amber-500/[0.1] dark:bg-amber-400/[0.05] dark:hover:bg-amber-400/[0.12] border border-amber-500/20 transition-all cursor-pointer select-none active:scale-[0.98]"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <div
                                                className="w-9 h-9 rounded-xl bg-amber-500/15 dark:bg-amber-500/25 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
                                                <Navigation className="w-4 h-4"/>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                                                    {stop.nodenm}
                                                </p>
                                                <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                                                    {stop.nodeno ? `정류장 번호 ${stop.nodeno}` : "실시간 도착정보 보기"}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFavoriteStop(stop);
                                            }}
                                            className={`p-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                                                isFav
                                                    ? "text-amber-500 hover:text-amber-600"
                                                    : "text-slate-300 dark:text-slate-600 hover:text-amber-500"
                                            }`}
                                            title={isFav ? "정류장 즐겨찾기 해제" : "정류장 즐겨찾기 추가"}
                                        >
                                            <Star className={`w-4 h-4 ${isFav ? "fill-amber-500" : ""}`}/>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {filteredRoutes.length === 0 && matchedStops.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center text-slate-400">
                        <Bus className="w-10 h-10 mb-2.5 stroke-[1.4] opacity-40"/>
                        <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                            {UI_TEXT.ROUTE_SELECT.NO_RESULTS_TITLE}
                        </p>
                        <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">
                            {effectiveCategory === "BOOKMARKS"
                                ? UI_TEXT.ROUTE_SELECT.NO_BOOKMARKS_DESC
                                : UI_TEXT.ROUTE_SELECT.NO_RESULTS_DESC}
                        </p>
                        {effectiveCategory !== "ALL" && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedCategory("ALL");
                                    setSearchQuery("");
                                }}
                                className="mt-4 px-3.5 py-1.5 rounded-full bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                            >
                                {UI_TEXT.ROUTE_SELECT.VIEW_ALL_ROUTES_BTN}
                            </button>
                        )}
                    </div>
                ) : filteredRoutes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                        {visibleRoutes.map((route) => {
                            const meta = routeMetaMap.get(route) || getRouteMeta(route, currentCity.code);
                            const isSelected = route === selectedRoute;
                            const isYonsei = settings.showYonseiFeatures && meta.isYonsei;
                            const isBookmarked = bookmarks.includes(route);

                            return (
                                <div
                                    key={route}
                                    className={`cv-auto-route group relative flex items-start justify-between rounded-2xl transition-all duration-200 select-none border ${
                                        isSelected
                                            ? `bg-slate-50/90 dark:bg-white/[0.06] ${meta.colorTheme.border} shadow-md ring-2 ${meta.colorTheme.ring || "ring-blue-500/30"}`
                                            : "bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15"
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleSelect(route)}
                                        className="flex items-start gap-3 min-w-0 flex-1 p-3.5 sm:p-4 pr-1 text-left cursor-pointer active:scale-[0.98] rounded-l-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    >
                                        {/* Route Number Badge */}
                                        <div
                                            className={`flex items-center justify-center min-w-[50px] sm:min-w-[56px] px-2.5 py-1.5 rounded-xl font-black text-sm sm:text-base tracking-tight shrink-0 shadow-xs ${meta.colorTheme.bg} text-white`}
                                        >
                                            <span>{UI_TEXT.COMMON.ROUTE_LABEL(route)}</span>
                                        </div>

                                        {/* Route Info / Origins & Dest */}
                                        <div className="flex flex-col min-w-0 flex-1 pr-1">
                                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                <span
                                                    className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${meta.colorTheme.badgeBg} ${meta.colorTheme.text}`}>
                                                    {meta.routeType || routeCategoryMap.get(route)?.label || (meta.genericType === "EXPRESS" ? "급행" : meta.genericType === "BRANCH" ? "지선" : meta.genericType === "VILLAGE" ? "마을" : "간선")}
                                                </span>
                                                {isYonsei && (
                                                    <span
                                                        className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                                                        {UI_TEXT.ROUTE_SELECT.YONSEI_BADGE}
                                                    </span>
                                                )}
                                            </div>
                                            <div
                                                className="font-extrabold text-xs sm:text-[13px] text-slate-900 dark:text-white leading-snug break-keep line-clamp-2"
                                                title={`${meta.origin} ↔ ${meta.destination}`}
                                            >
                                                {meta.origin} <span
                                                className="text-slate-400 font-normal">↔</span> {meta.destination}
                                            </div>
                                            {meta.description && (
                                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-1">
                                                    {meta.description}
                                                </p>
                                            )}
                                            {(meta.firstTime || meta.lastTime) && (
                                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                                                    <Clock className="w-3 h-3 text-slate-400 shrink-0"/>
                                                    <span>첫차 {meta.firstTime || "--:--"} · 막차 {meta.lastTime || "--:--"}</span>
                                                </p>
                                            )}
                                        </div>
                                    </button>

                                    {/* Right Controls: Bookmark */}
                                    <div
                                        className="flex items-center gap-1.5 shrink-0 pt-3.5 sm:pt-4 pr-3.5 sm:pr-4 pl-1">
                                        <button
                                            type="button"
                                            onClick={(e) => toggleBookmark(e, route)}
                                            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                                                isBookmarked
                                                    ? "text-amber-500 hover:text-amber-600"
                                                    : "text-slate-300 dark:text-slate-600 hover:text-amber-500 dark:hover:text-amber-400"
                                            }`}
                                            title={isBookmarked ? UI_TEXT.ROUTE_SELECT.BOOKMARK_REMOVE_TITLE : UI_TEXT.ROUTE_SELECT.BOOKMARK_ADD_TITLE}
                                            aria-label={isBookmarked ? UI_TEXT.ROUTE_SELECT.BOOKMARK_REMOVE_TITLE : UI_TEXT.ROUTE_SELECT.BOOKMARK_ADD_TITLE}
                                        >
                                            <Star className={`w-4 h-4 ${isBookmarked ? "fill-amber-500" : ""}`}/>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {visibleRoutes.length < filteredRoutes.length && (
                            <div
                                className="col-span-full py-2.5 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
                                스크롤하여 더 많은 노선 불러오기 ({visibleRoutes.length} / {filteredRoutes.length})
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </Modal>
    );
};
