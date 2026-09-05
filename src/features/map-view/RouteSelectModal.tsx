"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from "react";
import {createPortal} from "react-dom";
import {Bus, Check, Clock, GraduationCap, MapPin, Search, Star, X} from "lucide-react";
import {getRouteMeta, RouteCategory, RouteMeta, YONSEI_ROUTE_SET} from "@entities/route/routeMetadata";
import {UI_TEXT} from "@shared/config/locale";

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

const RECENT_ROUTES_STORAGE_KEY = "wbus_recent_map_routes";
const BOOKMARKS_STORAGE_KEY = "wonju_bus_bookmarks";
const DEFAULT_BOOKMARK_ROUTES = ["30", "34", "34-1"];

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

export const RouteSelectModal: React.FC<RouteSelectModalProps> = ({
                                                                      isOpen,
                                                                      onClose,
                                                                      allRoutes,
                                                                      selectedRoute,
                                                                      onSelectRoute,
                                                                  }) => {
    const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<RouteCategory>("ALL");
    const [bookmarks, setBookmarks] = useState<string[]>(() => {
        if (typeof window === "undefined") return DEFAULT_BOOKMARK_ROUTES;
        try {
            const saved = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
            if (saved) return JSON.parse(saved);
        } catch {
        }
        return DEFAULT_BOOKMARK_ROUTES;
    });
    const [recentRoutes, setRecentRoutes] = useState<string[]>(() => {
        if (typeof window === "undefined") return [];
        try {
            const saved = localStorage.getItem(RECENT_ROUTES_STORAGE_KEY);
            if (saved) return JSON.parse(saved);
        } catch {
        }
        return [];
    });
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

    if (!isOpen || !isClient) return null;

    const bookmarkedList = sortedAllRoutes.filter((r) => bookmarks.includes(r));
    const validRecentRoutes = recentRoutes.filter((r) => allRoutes.includes(r));

    const categories: { id: RouteCategory; label: string; icon?: React.ComponentType<{ className?: string }> }[] = [
        {id: "ALL", label: UI_TEXT.ROUTE_SELECT.CATEGORY_ALL(sortedAllRoutes.length)},
        {id: "BOOKMARKS", label: UI_TEXT.ROUTE_SELECT.CATEGORY_BOOKMARKS(bookmarkedList.length), icon: Star},
        {id: "YONSEI", label: UI_TEXT.ROUTE_SELECT.CATEGORY_YONSEI, icon: GraduationCap},
        {id: "1_19", label: UI_TEXT.ROUTE_SELECT.CAT_1_19},
        {id: "20_49", label: UI_TEXT.ROUTE_SELECT.CAT_20_49},
        {id: "50_99", label: UI_TEXT.ROUTE_SELECT.CAT_50_99},
        {id: "100_PLUS", label: UI_TEXT.ROUTE_SELECT.CAT_100_PLUS},
        {id: "PUBLIC", label: UI_TEXT.ROUTE_SELECT.CATEGORY_PUBLIC},
    ];

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3.5 sm:p-4">
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
                                <span
                                    className="px-2 py-0.5 rounded-full text-[11px] font-black bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                    {UI_TEXT.ROUTE_SELECT.CURRENT_ROUTE_PREFIX(selectedRoute)}
                                </span>
                            </div>
                            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                                {UI_TEXT.ROUTE_SELECT.TOTAL_ROUTES_COUNT(sortedAllRoutes.length)}
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
                                <span>{UI_TEXT.ROUTE_SELECT.CAMPUS_ROUTES_LABEL}</span>
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
                                            <span className="font-extrabold">{UI_TEXT.COMMON.ROUTE_LABEL(r)}</span>
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

                {/* Route List Display Section (Card Format Only) */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-2 sm:pt-3 custom-scrollbar">
                    {filteredRoutes.length === 0 ? (
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
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                            {filteredRoutes.map((route) => {
                                const meta = routeMetaMap.get(route) || getRouteMeta(route);
                                const isSelected = route === selectedRoute;
                                const isYonsei = meta.isYonsei;
                                const isBookmarked = bookmarks.includes(route);

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
                                                <span>{UI_TEXT.COMMON.ROUTE_LABEL(route)}</span>
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
                                                            {UI_TEXT.ROUTE_SELECT.YONSEI_BADGE}
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
                    )}
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
