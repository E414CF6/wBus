"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {Bus, Check, Clock, GraduationCap, Grid, LayoutList, MapPin, Search, Star, X,} from "lucide-react";
import {getRouteColor} from "@entities/route/routeColor";
import {getRouteMeta, RouteCategory, RouteMeta, YONSEI_ROUTE_SET,} from "@entities/route/routeMetadata";

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

type ViewMode = "cards" | "grid";

const RECENT_ROUTES_STORAGE_KEY = "wbus_recent_map_routes";
const BOOKMARKS_STORAGE_KEY = "wonju_bus_bookmarks";
const VIEW_MODE_STORAGE_KEY = "wbus_route_modal_view_mode";
const DEFAULT_BOOKMARK_ROUTES = ["30", "34", "34-1"];

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
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<RouteCategory>("ALL");
    const [viewMode, setViewMode] = useState<ViewMode>("cards");
    const [bookmarks, setBookmarks] = useState<string[]>(DEFAULT_BOOKMARK_ROUTES);
    const [recentRoutes, setRecentRoutes] = useState<string[]>([]);
    const [mounted, setMounted] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Initial mount & preferences load
    useEffect(() => {
        setMounted(true);
        try {
            const savedBookmarks = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
            if (savedBookmarks) {
                setBookmarks(JSON.parse(savedBookmarks));
            }
            const savedRecent = localStorage.getItem(RECENT_ROUTES_STORAGE_KEY);
            if (savedRecent) {
                setRecentRoutes(JSON.parse(savedRecent));
            }
            const savedViewMode = localStorage.getItem(VIEW_MODE_STORAGE_KEY) as ViewMode | null;
            if (savedViewMode === "cards" || savedViewMode === "grid") {
                setViewMode(savedViewMode);
            }
        } catch {
            // Ignore localStorage parse errors
        }
    }, []);

    // Toggle bookmark helper
    const toggleBookmark = useCallback((e: React.MouseEvent, route: string) => {
        e.stopPropagation();
        setBookmarks((prev) => {
            const exists = prev.includes(route);
            const next = exists ? prev.filter((r) => r !== route) : [...prev, route];
            try {
                localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next));
            } catch {
                // Ignore
            }
            return next;
        });
    }, []);

    // Select route & update recent routes history
    const handleSelect = useCallback(
        (route: string) => {
            onSelectRoute(route);
            setRecentRoutes((prev) => {
                const filtered = prev.filter((r) => r !== route);
                const next = [route, ...filtered].slice(0, 6);
                try {
                    localStorage.setItem(RECENT_ROUTES_STORAGE_KEY, JSON.stringify(next));
                } catch {
                    // Ignore
                }
                return next;
            });
            onClose();
        },
        [onSelectRoute, onClose]
    );

    // Handle view mode change & persist
    const handleViewModeChange = useCallback((mode: ViewMode) => {
        setViewMode(mode);
        try {
            localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
        } catch {
            // Ignore
        }
    }, []);

    // Reset state & auto-focus on open
    useEffect(() => {
        if (isOpen) {
            setSearchQuery("");
            setSelectedCategory("ALL");
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 60);
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

    // Sorted base list of all routes
    const sortedAllRoutes = useMemo(() => sortRoutes(allRoutes.filter(Boolean)), [allRoutes]);

    // Precomputed metadata mapping
    const routeMetaMap = useMemo(() => {
        const map = new Map<string, RouteMeta>();
        for (const route of sortedAllRoutes) {
            map.set(route, getRouteMeta(route));
        }
        return map;
    }, [sortedAllRoutes]);

    // Filter routes based on Category and Search Query
    const filteredRoutes = useMemo(() => {
        let list = sortedAllRoutes;

        // Apply Category
        if (selectedCategory === "BOOKMARKS") {
            list = list.filter((r) => bookmarks.includes(r));
        } else if (selectedCategory === "YONSEI") {
            list = list.filter((r) => YONSEI_ROUTE_SET.has(r));
        } else if (selectedCategory === "PUBLIC") {
            list = list.filter((r) => {
                const meta = routeMetaMap.get(r);
                return meta?.category === "PUBLIC" || r.startsWith("공영") || r.includes("순환") || r.includes("조조");
            });
        } else if (selectedCategory === "1_19") {
            list = list.filter((r) => {
                const num = parseInt(r, 10);
                return !isNaN(num) && num >= 1 && num < 20 && !r.startsWith("공영");
            });
        } else if (selectedCategory === "20_49") {
            list = list.filter((r) => {
                const num = parseInt(r, 10);
                return !isNaN(num) && num >= 20 && num < 50 && !r.startsWith("공영");
            });
        } else if (selectedCategory === "50_99") {
            list = list.filter((r) => {
                const num = parseInt(r, 10);
                return !isNaN(num) && num >= 50 && num < 100 && !r.startsWith("공영");
            });
        } else if (selectedCategory === "100_PLUS") {
            list = list.filter((r) => {
                const num = parseInt(r, 10);
                return !isNaN(num) && num >= 100 && !r.startsWith("공영");
            });
        }

        // Apply Search Query (Matches routeNo, origin, destination, description)
        const q = searchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter((r) => {
                const meta = routeMetaMap.get(r);
                const matchNo = r.toLowerCase().includes(q);
                const matchOrigin = meta?.origin.toLowerCase().includes(q);
                const matchDest = meta?.destination.toLowerCase().includes(q);
                const matchDesc = meta?.description?.toLowerCase().includes(q);
                return matchNo || matchOrigin || matchDest || matchDesc;
            });
        }

        return list;
    }, [sortedAllRoutes, selectedCategory, searchQuery, bookmarks, routeMetaMap]);

    if (!isOpen || !mounted) return null;

    const bookmarkedList = sortedAllRoutes.filter((r) => bookmarks.includes(r));
    const validRecentRoutes = recentRoutes.filter((r) => allRoutes.includes(r));

    const categories: { id: RouteCategory; label: string; icon?: React.ComponentType<{ className?: string }> }[] = [
        {id: "ALL", label: `전체 (${sortedAllRoutes.length})`},
        {id: "BOOKMARKS", label: `즐겨찾기 (${bookmarkedList.length})`, icon: Star},
        {id: "YONSEI", label: "연세대 (30·34·34-1)", icon: GraduationCap},
        {id: "1_19", label: "1~19번"},
        {id: "20_49", label: "20~49번"},
        {id: "50_99", label: "50~99번"},
        {id: "100_PLUS", label: "100번대+"},
        {id: "PUBLIC", label: "공영·순환"},
    ];

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop Blur Overlay */}
            <div
                className="fixed inset-0 bg-black/65 backdrop-blur-md transition-opacity duration-300 animate-fadeIn"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Main Modal Dialog Container */}
            <div
                className="relative w-full max-w-2xl bg-white/95 dark:bg-[#12131a]/95 backdrop-blur-3xl border border-black/10 dark:border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.35)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.85)] rounded-t-[32px] sm:rounded-[32px] overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[82vh] z-10 transition-all duration-300 transform animate-slideUp sm:animate-scaleUp"
                role="dialog"
                aria-modal="true"
                aria-label="실시간 노선 선택기"
            >
                {/* Mobile Drag Indicator Pill */}
                <div className="sm:hidden flex justify-center pt-2.5 pb-1">
                    <div className="w-10 h-1 rounded-full bg-black/20 dark:bg-white/20"/>
                </div>

                {/* Header Bar */}
                <div
                    className="flex items-center justify-between px-4 sm:px-6 pt-3 pb-3 border-b border-black/5 dark:border-white/5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/25">
                            <Bus className="w-5 h-5"/>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                    노선 선택
                                </h2>
                                <span
                                    className="px-2 py-0.5 rounded-full text-[11px] font-black bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                    현재: {selectedRoute}번
                                </span>
                            </div>
                            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                                원주시 실시간 버스 {sortedAllRoutes.length}개 노선
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {/* View Mode Toggle Button */}
                        <div
                            className="flex items-center p-0.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/5 dark:border-white/10">
                            <button
                                type="button"
                                onClick={() => handleViewModeChange("cards")}
                                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    viewMode === "cards"
                                        ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs"
                                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                }`}
                                title="상세 카드 보기"
                                aria-label="상세 카드 보기"
                            >
                                <LayoutList className="w-4 h-4"/>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleViewModeChange("grid")}
                                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    viewMode === "grid"
                                        ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs"
                                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                }`}
                                title="컴팩트 그리드 보기"
                                aria-label="컴팩트 그리드 보기"
                            >
                                <Grid className="w-4 h-4"/>
                            </button>
                        </div>

                        {/* Close Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                            aria-label="닫기"
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
                            placeholder="노선 번호 또는 행선지 검색 (예: 30, 연세대, 횡성, 문막...)"
                            className="w-full pl-10 pr-10 py-2.5 sm:py-3 bg-black/[0.03] dark:bg-white/[0.05] border border-black/8 dark:border-white/10 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                                aria-label="검색어 지우기"
                            >
                                <X className="w-4 h-4"/>
                            </button>
                        )}
                    </div>
                </div>

                {/* Quick Access Section: Recent Routes & Yonsei Specials (Only when no search query) */}
                {!searchQuery && selectedCategory === "ALL" && (
                    <div
                        className="px-4 sm:px-6 py-1.5 flex flex-col gap-2 shrink-0 border-b border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.015]">
                        {/* Yonsei University Quick Banner */}
                        <div
                            className="flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar-hidden py-0.5">
                            <div
                                className="flex items-center gap-1 text-[11px] font-black text-blue-700 dark:text-blue-400 whitespace-nowrap shrink-0">
                                <GraduationCap className="w-3.5 h-3.5"/>
                                <span>연세대 캠퍼스 노선</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {["30", "34", "34-1"].map((r) => {
                                    const isCurrent = r === selectedRoute;
                                    return (
                                        <button
                                            key={r}
                                            type="button"
                                            onClick={() => handleSelect(r)}
                                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black transition-all cursor-pointer active:scale-95 ${
                                                isCurrent
                                                    ? "bg-[#003876] text-white shadow-sm ring-1 ring-[#003876]"
                                                    : "bg-[#003876]/10 dark:bg-[#003876]/30 text-[#003876] dark:text-blue-300 hover:bg-[#003876]/20 border border-[#003876]/20"
                                            }`}
                                        >
                                            <span className="font-extrabold">{r}번</span>
                                            {isCurrent && <Check className="w-3 h-3 stroke-[3]"/>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Recent Routes Chips (if available) */}
                        {validRecentRoutes.length > 0 && (
                            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar-hidden py-0.5">
                                <div
                                    className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                                    <Clock className="w-3 h-3"/>
                                    <span>최근 조회:</span>
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
                                                {r}번
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
                                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                                        isActive
                                            ? cat.id === "YONSEI"
                                                ? "bg-[#003876] text-white shadow-md shadow-[#003876]/30 scale-[1.02]"
                                                : cat.id === "BOOKMARKS"
                                                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/30 scale-[1.02]"
                                                    : "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md shadow-black/10 dark:shadow-white/10 scale-[1.02]"
                                            : "bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/5"
                                    }`}
                                >
                                    {Icon && <Icon
                                        className={`w-3 h-3 ${cat.id === "BOOKMARKS" && isActive ? "fill-white" : ""}`}/>}
                                    <span>{cat.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Route List Display Section (Cards Mode vs Grid Mode) */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-2 sm:pt-3 custom-scrollbar">
                    {filteredRoutes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 text-center text-slate-400">
                            <Bus className="w-10 h-10 mb-2.5 stroke-[1.4] opacity-40"/>
                            <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                                일치하는 노선이 없습니다
                            </p>
                            <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">
                                {selectedCategory === "BOOKMARKS"
                                    ? "즐겨찾기한 노선이 없습니다. 별표(★)를 눌러 노선을 등록해보세요."
                                    : "노선 번호나 행선지를 다시 확인해 주세요."}
                            </p>
                            {selectedCategory !== "ALL" && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedCategory("ALL");
                                        setSearchQuery("");
                                    }}
                                    className="mt-4 px-3.5 py-1.5 rounded-full bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                                >
                                    전체 노선 보기
                                </button>
                            )}
                        </div>
                    ) : viewMode === "cards" ? (
                        /* Detail Cards Mode */
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                            {filteredRoutes.map((route) => {
                                const meta = routeMetaMap.get(route) || getRouteMeta(route);
                                const isSelected = route === selectedRoute;
                                const isYonsei = meta.isYonsei;
                                const isBookmarked = bookmarks.includes(route);
                                const colorConfig = getRouteColor(route);

                                return (
                                    <div
                                        key={route}
                                        onClick={() => handleSelect(route)}
                                        className={`group relative flex items-start justify-between p-3.5 sm:p-4 rounded-2xl transition-all duration-200 cursor-pointer select-none active:scale-[0.98] border ${
                                            isSelected
                                                ? isYonsei
                                                    ? "bg-blue-50/90 dark:bg-[#003876]/25 border-[#003876]/60 dark:border-blue-400/50 shadow-md shadow-blue-500/10 ring-2 ring-[#003876]/40 dark:ring-blue-400/40"
                                                    : "bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 dark:border-blue-400 shadow-md shadow-blue-500/15 ring-2 ring-blue-500/30"
                                                : isYonsei
                                                    ? "bg-blue-500/[0.04] dark:bg-blue-400/[0.04] hover:bg-blue-500/[0.08] dark:hover:bg-blue-400/[0.08] border-blue-500/25 dark:border-blue-400/20 hover:border-blue-500/40"
                                                    : "bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15"
                                        }`}
                                    >
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            {/* Route Number Badge */}
                                            <div
                                                className={`flex items-center justify-center min-w-[50px] sm:min-w-[56px] px-2.5 py-1.5 rounded-xl font-black text-sm sm:text-base tracking-tight shrink-0 shadow-xs ${
                                                    isSelected
                                                        ? isYonsei
                                                            ? "bg-[#003876] text-white"
                                                            : "bg-blue-600 text-white"
                                                        : isYonsei
                                                            ? "bg-[#003876] text-white"
                                                            : "bg-slate-900 dark:bg-slate-800 text-white"
                                                }`}
                                            >
                                                <span>{route}번</span>
                                            </div>

                                            {/* Route Info / Origins & Dest */}
                                            <div className="flex flex-col min-w-0 flex-1 pr-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span
                                                        className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                                        {meta.origin} ↔ {meta.destination}
                                                    </span>
                                                    {isYonsei && (
                                                        <span
                                                            className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                                                            연세대
                                                        </span>
                                                    )}
                                                </div>
                                                {meta.description && (
                                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                        {meta.description}
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
                                                title={isBookmarked ? "즐겨찾기 해제" : "즐겨찾기 등록"}
                                                aria-label={isBookmarked ? "즐겨찾기 해제" : "즐겨찾기 등록"}
                                            >
                                                <Star
                                                    className={`w-4 h-4 ${isBookmarked ? "fill-amber-500" : ""}`}
                                                />
                                            </button>

                                            {isSelected && (
                                                <div
                                                    className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white shadow-xs">
                                                    <Check className="w-3.5 h-3.5 stroke-[3]"/>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* Compact Grid Mode */
                        <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                            {filteredRoutes.map((route) => {
                                const meta = routeMetaMap.get(route) || getRouteMeta(route);
                                const isSelected = route === selectedRoute;
                                const isYonsei = meta.isYonsei;
                                const isBookmarked = bookmarks.includes(route);

                                return (
                                    <button
                                        key={route}
                                        type="button"
                                        onClick={() => handleSelect(route)}
                                        className={`relative flex flex-col items-center justify-center py-3 px-1.5 rounded-2xl font-black transition-all duration-200 cursor-pointer select-none active:scale-95 group ${
                                            isSelected
                                                ? isYonsei
                                                    ? "bg-[#003876] text-white shadow-lg shadow-[#003876]/35 ring-2 ring-[#003876] scale-[1.03]"
                                                    : "bg-blue-600 text-white shadow-lg shadow-blue-600/35 ring-2 ring-blue-600 scale-[1.03]"
                                                : isYonsei
                                                    ? "bg-blue-500/10 dark:bg-blue-500/15 hover:bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-500/30"
                                                    : "bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.09] text-slate-800 dark:text-slate-100 border border-black/5 dark:border-white/5"
                                        }`}
                                    >
                                        {/* Yonsei Route Special Tag */}
                                        {isYonsei && (
                                            <span
                                                className={`absolute -top-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                    isSelected
                                                        ? "bg-amber-400 text-slate-900 shadow-xs"
                                                        : "bg-[#003876] text-white"
                                                }`}
                                            >
                                                연세대
                                            </span>
                                        )}

                                        {/* Bookmarked Star Indicator */}
                                        {isBookmarked && !isYonsei && (
                                            <div className="absolute top-1.5 left-1.5">
                                                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400"/>
                                            </div>
                                        )}

                                        {/* Selected Checkmark Indicator */}
                                        {isSelected && (
                                            <div className="absolute top-1.5 right-1.5">
                                                <Check className="w-3 h-3 stroke-[3]"/>
                                            </div>
                                        )}

                                        <span className="text-sm sm:text-base tracking-tight">{route}</span>
                                        <span
                                            className={`text-[10px] font-semibold mt-0.5 ${
                                                isSelected
                                                    ? "text-white/80"
                                                    : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                                            }`}
                                        >
                                            번
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Bar */}
                <div
                    className="px-4 sm:px-6 py-3 border-t border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"/>
                        <span>
                            현재 노선:{" "}
                            <strong className="text-slate-900 dark:text-white font-extrabold">
                                {selectedRoute}번
                            </strong>
                            {" "}({routeMetaMap.get(selectedRoute)?.origin} ↔ {routeMetaMap.get(selectedRoute)?.destination})
                        </span>
                    </div>
                    <span className="font-semibold">{filteredRoutes.length}개 표시 중</span>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
