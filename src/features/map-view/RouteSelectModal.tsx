"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from "react";
import {createPortal} from "react-dom";
import {Bus, Clock, GraduationCap, MapPin, Navigation, Search, Star, X} from "lucide-react";
import {getRouteMeta, RouteMeta, YONSEI_ROUTE_SET} from "@entities/route/routeMetadata";
import {getBookmarkStorageKey, getRecentRoutesStorageKey} from "@shared/config/env";
import {UI_TEXT} from "@shared/config/locale";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useCityContext} from "@entities/city";
import {useCityRoutes} from "@entities/route/hooks";
import {useBusStop, useFavoriteStops} from "@entities/station/hooks";
import type {BusStop} from "@entities/station/types";

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

const emptySubscribe = () => () => {
};

function sortRoutes(routes: string[]): string[] {
    return [...routes].sort((a, b) =>
        a.localeCompare(b, undefined, {numeric: true, sensitivity: "base"})
    );
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

const WONJU_DEFAULT_BOOKMARKS = ["30", "34", "34-1"];
const EMPTY_DEFAULT_BOOKMARKS: string[] = [];

export const RouteSelectModal: React.FC<RouteSelectModalProps> = ({
                                                                      isOpen,
                                                                      onClose,
                                                                      allRoutes,
                                                                      selectedRoute,
                                                                      onSelectRoute,
                                                                  }) => {
    const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const {currentCity} = useCityContext();
    const {map} = useAppMapContext();
    const isWonju = currentCity.code === "32020";

    // Direct nationwide route list fetch for current city
    const {routes: cityRoutes = []} = useCityRoutes(currentCity.code);
    const {favoriteStops, isFavoriteStop, toggleFavoriteStop} = useFavoriteStops(currentCity.code);
    const currentRouteStops = useBusStop(isOpen ? selectedRoute : "", currentCity.code);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

    // City-scoped bookmarks & recent history keys
    const bookmarkKey = getBookmarkStorageKey(currentCity.code);
    const recentKey = getRecentRoutesStorageKey(currentCity.code);
    const defaultBookmarks = isWonju ? WONJU_DEFAULT_BOOKMARKS : EMPTY_DEFAULT_BOOKMARKS;

    const [bookmarks, setBookmarks] = useState<string[]>(defaultBookmarks);
    const [recentRoutes, setRecentRoutes] = useState<string[]>([]);

    // Re-sync bookmarks and recents when currentCity changes or modal opens
    useEffect(() => {
        const frameId = requestAnimationFrame(() => {
            try {
                const savedBookmarks = localStorage.getItem(bookmarkKey);
                const nextBookmarks: string[] = savedBookmarks ? JSON.parse(savedBookmarks) : defaultBookmarks;
                setBookmarks((prev) => (JSON.stringify(prev) === JSON.stringify(nextBookmarks) ? prev : nextBookmarks));

                const savedRecent = localStorage.getItem(recentKey);
                const nextRecent: string[] = savedRecent ? JSON.parse(savedRecent) : [];
                setRecentRoutes((prev) => (JSON.stringify(prev) === JSON.stringify(nextRecent) ? prev : nextRecent));
            } catch {
                setBookmarks(defaultBookmarks);
                setRecentRoutes([]);
            }
        });
        return () => cancelAnimationFrame(frameId);
    }, [bookmarkKey, recentKey, defaultBookmarks, isOpen]);

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
        setBookmarks((prev) => {
            const exists = prev.includes(route);
            const next = exists ? prev.filter((r) => r !== route) : [...prev, route];
            try {
                localStorage.setItem(bookmarkKey, JSON.stringify(next));
            } catch {
                // Ignore
            }
            return next;
        });
    }, [bookmarkKey]);

    // Select route & update recent routes history
    const handleSelect = useCallback(
        (route: string) => {
            onSelectRoute(route);
            setRecentRoutes((prev) => {
                const filtered = prev.filter((r) => r !== route);
                const next = [route, ...filtered].slice(0, 6);
                try {
                    localStorage.setItem(recentKey, JSON.stringify(next));
                } catch {
                    // Ignore
                }
                return next;
            });
            onClose();
        },
        [onSelectRoute, onClose, recentKey]
    );

    // Select a stop (fly to stop & open live arrival popup)
    const handleSelectStop = useCallback(
        (stop: BusStop) => {
            if (map && stop.gpslong && stop.gpslati) {
                map.flyTo({
                    center: [stop.gpslong, stop.gpslati],
                    zoom: Math.max(map.getZoom(), 16.2),
                    duration: 950,
                });
            }
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("wbus:focus-stop", {detail: stop}));
            }
            onClose();
        },
        [map, onClose]
    );

    // Auto-focus on open
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                searchInputRef.current?.focus();
            }, 60);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Handle ESC key to close
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

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

    const categories = useMemo(() => {
        const bookmarkedCount = sortedAllRoutes.filter((r) => bookmarks.includes(r)).length;
        const expressCount = sortedAllRoutes.filter((r) => routeMetaMap.get(r)?.genericType === "EXPRESS").length;
        const mainCount = sortedAllRoutes.filter((r) => routeMetaMap.get(r)?.genericType === "MAIN").length;
        const branchCount = sortedAllRoutes.filter((r) => routeMetaMap.get(r)?.genericType === "BRANCH").length;

        const list: {
            id: string;
            label: string;
            icon?: React.ComponentType<{ className?: string }>;
            dotClass?: string;
        }[] = [
            {id: "ALL", label: UI_TEXT.ROUTE_SELECT.CATEGORY_ALL(sortedAllRoutes.length)},
            {id: "BOOKMARKS", label: UI_TEXT.ROUTE_SELECT.CATEGORY_BOOKMARKS(bookmarkedCount), icon: Star},
        ];

        if (favoriteStops.length > 0) {
            list.push({
                id: "FAV_STOPS",
                label: `정류장 즐겨찾기 (${favoriteStops.length})`,
                icon: MapPin,
            });
        }

        if (isWonju) {
            list.push({id: "YONSEI", label: UI_TEXT.ROUTE_SELECT.CATEGORY_YONSEI, icon: GraduationCap});
        }

        if (expressCount > 0) {
            list.push({id: "EXPRESS", label: `급행 (${expressCount})`, dotClass: "bg-red-500"});
        }
        if (mainCount > 0) {
            list.push({id: "MAIN", label: `간선 (${mainCount})`, dotClass: "bg-blue-500"});
        }
        if (branchCount > 0) {
            list.push({id: "BRANCH", label: `지선 (${branchCount})`, dotClass: "bg-emerald-500"});
        }

        return list;
    }, [isWonju, sortedAllRoutes, bookmarks, favoriteStops.length, routeMetaMap]);

    // Filter stops based on Search Query or FAV_STOPS Category
    const matchedStops = useMemo<BusStop[]>(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q && selectedCategory !== "FAV_STOPS") return [];

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

        if (selectedCategory !== "FAV_STOPS") {
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
                    s.nodenm.toLowerCase().includes(q) ||
                    String(s.nodeno ?? "").toLowerCase().includes(q)
            )
            .slice(0, 12);
    }, [searchQuery, selectedCategory, favoriteStops, currentRouteStops]);

    // Filter routes based on Category and Search Query
    const filteredRoutes = useMemo(() => {
        if (selectedCategory === "FAV_STOPS" && !searchQuery.trim()) {
            return [];
        }

        let list = sortedAllRoutes;

        // Apply Category
        if (selectedCategory === "BOOKMARKS") {
            list = list.filter((r) => bookmarks.includes(r));
        } else if (selectedCategory === "YONSEI") {
            list = list.filter((r) => YONSEI_ROUTE_SET.has(r));
        } else if (selectedCategory === "EXPRESS") {
            list = list.filter((r) => routeMetaMap.get(r)?.genericType === "EXPRESS");
        } else if (selectedCategory === "MAIN") {
            list = list.filter((r) => routeMetaMap.get(r)?.genericType === "MAIN");
        } else if (selectedCategory === "BRANCH") {
            list = list.filter((r) => routeMetaMap.get(r)?.genericType === "BRANCH");
        }

        // Apply Search Query (Matches routeNo, origin, destination, description, routeType)
        const q = searchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter((r) => {
                const meta = routeMetaMap.get(r);
                const matchNo = r.toLowerCase().includes(q);
                const matchOrigin = meta?.origin.toLowerCase().includes(q);
                const matchDest = meta?.destination.toLowerCase().includes(q);
                const matchDesc = meta?.description?.toLowerCase().includes(q);
                const matchType = meta?.routeType?.toLowerCase().includes(q);
                return matchNo || matchOrigin || matchDest || matchDesc || matchType;
            });
        }

        return list;
    }, [sortedAllRoutes, selectedCategory, searchQuery, bookmarks, routeMetaMap]);

    if (!isOpen || !isClient) return null;

    const validRecentRoutes = recentRoutes.filter((r) => sortedAllRoutes.includes(r));

    const modalContent = (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-3.5 sm:p-4">
            {/* Backdrop Blur Overlay */}
            <div
                className="fixed inset-0 bg-black/65 backdrop-blur-md transition-opacity duration-300 animate-fadeIn"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Main Modal Dialog Container (Fixed height & Margins on all viewports) */}
            <div
                className="relative w-full max-w-2xl h-[78dvh] sm:h-[82dvh] max-h-[78dvh] sm:max-h-[82dvh] bg-white/95 dark:bg-[#12131a]/95 backdrop-blur-3xl border border-black/10 dark:border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.35)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.85)] rounded-[28px] sm:rounded-[32px] overflow-hidden flex flex-col z-10 transition-all duration-300 transform animate-scaleUp"
                role="dialog"
                aria-modal="true"
                aria-label={UI_TEXT.ROUTE_SELECT.MODAL_ARIA}
            >
                {/* Header Bar */}
                <div
                    className="flex items-center justify-between px-4 sm:px-6 pt-3.5 pb-3 border-b border-black/5 dark:border-white/5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/25">
                            <Bus className="w-5 h-5"/>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                    {UI_TEXT.ROUTE_SELECT.MODAL_TITLE}
                                </h2>
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
                            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                                {UI_TEXT.ROUTE_SELECT.TOTAL_ROUTES_COUNT(sortedAllRoutes.length, currentCity.name)}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {/* Close Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                            aria-label={UI_TEXT.COMMON.CLOSE}
                        >
                            <X className="w-5 h-5"/>
                        </button>
                    </div>
                </div>

                {/* Search Bar Input */}
                <div className="px-4 sm:px-6 pt-3 pb-2 shrink-0">
                    <div className="relative flex items-center">
                        <Search className="w-4.5 h-4.5 absolute left-3.5 text-slate-400 pointer-events-none"/>
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={UI_TEXT.ROUTE_SELECT.SEARCH_PLACEHOLDER}
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
                {!searchQuery && (
                    <div
                        className="px-4 sm:px-6 py-1.5 flex flex-col gap-2 shrink-0 border-b border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.015]">
                        {/* Recent Routes Chips (if available) */}
                        {validRecentRoutes.length > 0 && (
                            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar-hidden py-0.5">
                                <div
                                    className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                                    <Clock className="w-3.5 h-3.5"/>
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
                                                className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer active:scale-95 ${
                                                    isCurrent
                                                        ? "bg-blue-600 text-white shadow-xs"
                                                        : "bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-300 border border-black/5 dark:border-white/5"
                                                }`}
                                            >
                                                {UI_TEXT.COMMON.ROUTE_LABEL(r)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Category Filter Chips Bar */}
                {!searchQuery && (
                    <div
                        className="px-4 sm:px-6 py-2.5 flex items-center gap-1.5 overflow-x-auto custom-scrollbar-hidden shrink-0 border-b border-black/5 dark:border-white/5">
                        {categories.map((cat) => {
                            const Icon = cat.icon;
                            const isActive = selectedCategory === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                                        isActive
                                            ? cat.id === "EXPRESS"
                                                ? "bg-red-600 text-white shadow-md shadow-red-500/30 scale-[1.02]"
                                                : cat.id === "MAIN"
                                                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-[1.02]"
                                                    : cat.id === "BRANCH"
                                                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30 scale-[1.02]"
                                                        : cat.id === "YONSEI"
                                                            ? "bg-[#003876] text-white shadow-md shadow-[#003876]/30 scale-[1.02]"
                                                            : cat.id === "BOOKMARKS" || cat.id === "FAV_STOPS"
                                                                ? "bg-amber-500 text-white shadow-md shadow-amber-500/30 scale-[1.02]"
                                                                : "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md shadow-black/10 dark:shadow-white/10 scale-[1.02]"
                                            : "bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/5"
                                    }`}
                                >
                                    {Icon && <Icon
                                        className={`w-3.5 h-3.5 ${cat.id === "BOOKMARKS" && isActive ? "fill-white" : ""}`}/>}
                                    {!isActive && cat.dotClass && <span className={`w-2 h-2 rounded-full ${cat.dotClass}`} />}
                                    <span>{cat.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Route & Stop List Display Section */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-2 sm:pt-3 custom-scrollbar space-y-4">
                    {/* Matched Stops Section (Shown when searching or in FAV_STOPS category) */}
                    {matchedStops.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2 px-1">
                                <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-amber-500"/>
                                    <span>
                                        {selectedCategory === "FAV_STOPS" && !searchQuery.trim()
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
                                                <div className="w-9 h-9 rounded-xl bg-amber-500/15 dark:bg-amber-500/25 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
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
                                {selectedCategory === "BOOKMARKS"
                                    ? UI_TEXT.ROUTE_SELECT.NO_BOOKMARKS_DESC
                                    : UI_TEXT.ROUTE_SELECT.NO_RESULTS_DESC}
                            </p>
                            {selectedCategory !== "ALL" && (
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                            {filteredRoutes.map((route) => {
                                const meta = routeMetaMap.get(route) || getRouteMeta(route, currentCity.code);
                                const isSelected = route === selectedRoute;
                                const isYonsei = meta.isYonsei;
                                const isBookmarked = bookmarks.includes(route);

                                return (
                                    <div
                                        key={route}
                                        onClick={() => handleSelect(route)}
                                        className={`group relative flex items-start justify-between p-3.5 sm:p-4 rounded-2xl transition-all duration-200 cursor-pointer select-none active:scale-[0.98] border ${
                                            isSelected
                                                ? `bg-slate-50/90 dark:bg-white/[0.06] ${meta.colorTheme.border} shadow-md ring-2 ${meta.colorTheme.ring || "ring-blue-500/30"}`
                                                : "bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15"
                                        }`}
                                    >
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            {/* Route Number Badge */}
                                            <div
                                                className={`flex items-center justify-center min-w-[50px] sm:min-w-[56px] px-2.5 py-1.5 rounded-xl font-black text-sm sm:text-base tracking-tight shrink-0 shadow-xs ${meta.colorTheme.bg} text-white`}
                                            >
                                                <span>{UI_TEXT.COMMON.ROUTE_LABEL(route)}</span>
                                            </div>

                                            {/* Route Info / Origins & Dest */}
                                            <div className="flex flex-col min-w-0 flex-1 pr-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span
                                                        className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                                        {meta.origin} ↔ {meta.destination}
                                                    </span>
                                                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${meta.colorTheme.badgeBg} ${meta.colorTheme.text}`}>
                                                        {meta.routeType || (meta.genericType === "EXPRESS" ? "급행" : meta.genericType === "BRANCH" ? "지선" : "간선")}
                                                    </span>
                                                    {isYonsei && (
                                                        <span
                                                            className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                                                            {UI_TEXT.ROUTE_SELECT.YONSEI_BADGE}
                                                        </span>
                                                    )}
                                                </div>
                                                {meta.description && (
                                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                        {meta.description}
                                                    </p>
                                                )}
                                                {(meta.firstTime || meta.lastTime) && (
                                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                                                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                                        <span>첫차 {meta.firstTime || "--:--"} · 막차 {meta.lastTime || "--:--"}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right Controls: Bookmark & Selection Check */}
                                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
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
                        </div>
                    ) : null}
                </div>

                {/* Footer Bar */}
                <div
                    className="px-4 sm:px-6 py-3 border-t border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"/>
                        <span>
                            {UI_TEXT.ROUTE_SELECT.CURRENT_ROUTE_LABEL}{" "}
                            <strong className="text-slate-900 dark:text-white font-extrabold">
                                {UI_TEXT.COMMON.ROUTE_LABEL(selectedRoute)}
                            </strong>
                            {" "}({routeMetaMap.get(selectedRoute)?.origin} ↔ {routeMetaMap.get(selectedRoute)?.destination})
                        </span>
                    </div>
                    <span className="font-semibold">{UI_TEXT.ROUTE_SELECT.DISPLAYED_COUNT(filteredRoutes.length)}</span>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
