"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    BookOpen,
    CheckCircle2,
    Clock,
    GraduationCap,
    Info,
    MapPin,
    Megaphone,
    Search,
    X,
} from "lucide-react";
import {useCityContext} from "@entities/city";
import {type BusRoute, useSchedule} from "@entities/schedule";
import type {BusStop} from "@entities/station/types";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {getBookmarkStorageKey, STORAGE_KEYS} from "@shared/config/env";
import {Footer} from "@shared/ui/Footer";
import {useBodyScrollLock} from "@shared/ui/useBodyScrollLock";
import type {DayMode, TimetableSubTab} from "@shared/types/navigation";

import {
    resolveWikiDoc,
    searchWikiDocs,
} from "./model/wikiRouter";
import {CityWikiArticle} from "./ui/articles/CityWikiArticle";
import {YonseiWikiArticle} from "./ui/articles/YonseiWikiArticle";
import {YonseiShuttleWikiArticle} from "./ui/articles/YonseiShuttleWikiArticle";
import {RouteWikiArticle} from "./ui/articles/RouteWikiArticle";
import {NoticeWikiArticle} from "./ui/articles/NoticeWikiArticle";

const DEFAULT_BOOKMARK_ROUTES = ["30", "34", "34-1"];

export interface TransitWikiProps {
    initialDocId?: string;
    onDocChange?: (docId: string, subTabFallback?: TimetableSubTab) => void;
    onClose: () => void;
    onSelectMapRoute?: (routeName: string) => void;
    allRouteNames?: string[];
    dayMode: DayMode;
    onDayModeChange: (mode: DayMode) => void;
    isTodayWeekendOrHoliday: boolean;
}

/**
 * Interactive Bottom Sheet Transit & Timetable Hub.
 * Replaces the awkward pseudo-wiki with a modern, mobile-friendly transit dashboard:
 * - Direct Map visibility in background
 * - Gesture grab handle & backdrop click-to-close
 * - One-click category tabs (Yonsei Campus, Free Shuttle, All City Routes, Official Notices)
 * - Retains rich live timetables, departures spotlight, and map sync
 */
export const TransitWiki: React.FC<TransitWikiProps> = ({
    initialDocId = "yonsei",
    onDocChange,
    onClose,
    onSelectMapRoute,
    allRouteNames = [],
    dayMode,
    onDayModeChange,
    isTodayWeekendOrHoliday,
}) => {
    // Prevent background map from panning or zooming while scrolling the bottom sheet
    useBodyScrollLock(true);

    const {currentCity} = useCityContext();
    const {map} = useAppMapContext();
    const isWonju = currentCity.code === "32020";

    const {
        routes,
        meta,
        isLoading,
        isRefreshing,
        error,
        refresh,
        refreshToast,
        clearRefreshToast,
    } = useSchedule(isWonju);

    // Live clock for next departure spotlight
    const [now, setNow] = useState<Date>(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 15000);
        return () => clearInterval(timer);
    }, []);

    // Bookmarks state
    const bookmarkKey = getBookmarkStorageKey(currentCity.code);
    const [bookmarks, setBookmarks] = useState<string[]>(
        isWonju ? DEFAULT_BOOKMARK_ROUTES : []
    );

    useEffect(() => {
        const frameId = requestAnimationFrame(() => {
            try {
                const saved =
                    localStorage.getItem(bookmarkKey) ||
                    (isWonju ? localStorage.getItem(STORAGE_KEYS.WONJU_BOOKMARKS) : null);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) {
                        setBookmarks(parsed);
                    }
                }
            } catch {
                // Ignore
            }
        });
        return () => cancelAnimationFrame(frameId);
    }, [bookmarkKey, isWonju]);

    const toggleBookmark = useCallback(
        (routeId: string) => {
            setBookmarks((prev) => {
                const next = prev.includes(routeId)
                    ? prev.filter((id) => id !== routeId)
                    : [...prev, routeId];
                try {
                    localStorage.setItem(bookmarkKey, JSON.stringify(next));
                } catch {
                    // Ignore
                }
                return next;
            });
        },
        [bookmarkKey]
    );

    const isRouteBookmarked = useCallback(
        (route: BusRoute) =>
            bookmarks.includes(route.id) || bookmarks.includes(route.routeNo),
        [bookmarks]
    );

    // Document & Tab State
    const resolvedInitial = useMemo(
        () => resolveWikiDoc(initialDocId, currentCity.code).docId,
        [initialDocId, currentCity.code]
    );

    const [activeDocId, setActiveDocId] = useState<string>(resolvedInitial);
    const [prevInitialDocId, setPrevInitialDocId] = useState(resolvedInitial);
    if (resolvedInitial !== prevInitialDocId) {
        setPrevInitialDocId(resolvedInitial);
        setActiveDocId(resolvedInitial);
    }

    const docDescriptor = useMemo(
        () => resolveWikiDoc(activeDocId, currentCity.code),
        [activeDocId, currentCity.code]
    );

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const scrollToTop = useCallback(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({top: 0, behavior: "smooth"});
        }
    }, []);

    const handleNavigate = useCallback(
        (targetRawDocId: string) => {
            const nextDoc = resolveWikiDoc(targetRawDocId, currentCity.code);
            setActiveDocId(nextDoc.docId);
            scrollToTop();

            const mappedSubTab: TimetableSubTab =
                nextDoc.type === "yonsei" || nextDoc.type === "yonsei-shuttle"
                    ? "yonsei"
                    : "all";
            onDocChange?.(nextDoc.docId, mappedSubTab);
        },
        [currentCity.code, onDocChange, scrollToTop]
    );

    // Quick Search within Bottom Sheet
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim() && !isSearchFocused) return [];
        return searchWikiDocs(searchQuery, routes, allRouteNames, currentCity.code);
    }, [searchQuery, isSearchFocused, routes, allRouteNames, currentCity.code]);

    // Map Interaction Handlers
    const handleFocusStopOnMap = useCallback(
        (stop: BusStop, routeName: string) => {
            onSelectMapRoute?.(routeName);
            onClose();
            if (map && stop.gpslong && stop.gpslati) {
                map.flyTo({
                    center: [stop.gpslong, stop.gpslati],
                    zoom: Math.max(map.getZoom(), 16.2),
                    duration: 900,
                });
            }
            if (typeof window !== "undefined") {
                setTimeout(() => {
                    window.dispatchEvent(
                        new CustomEvent("wbus:focus-stop", {detail: stop})
                    );
                }, 150);
            }
        },
        [map, onClose, onSelectMapRoute]
    );

    const handleFlyToLocation = useCallback(
        (lat: number, lng: number) => {
            onClose();
            if (map) {
                map.flyTo({
                    center: [lng, lat],
                    zoom: 16.8,
                    duration: 900,
                });
            }
        },
        [map, onClose]
    );

    // Current primary tab selection
    const activeTabCategory = useMemo(() => {
        if (docDescriptor.type === "yonsei") return "yonsei";
        if (docDescriptor.type === "yonsei-shuttle") return "shuttle";
        if (docDescriptor.type === "notices" || docDescriptor.type === "notice-detail") return "notices";
        if (docDescriptor.type === "route") return "route";
        return "all";
    }, [docDescriptor.type]);

    return (
        <div
            className="fixed inset-0 z-60 flex flex-col justify-end items-center bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
            role="dialog"
            aria-modal="true"
            aria-label="대중교통 시간표 및 안내"
        >
            {/* Interactive Bottom Sheet Glass Container */}
            <div
                className="relative w-full sm:max-w-4xl h-[82dvh] sm:h-[80dvh] max-h-[85dvh] bg-slate-50/98 dark:bg-[#0e1118]/98 backdrop-blur-3xl rounded-t-[32px] sm:rounded-t-[36px] shadow-[0_-16px_50px_rgba(0,0,0,0.35)] border-t border-x border-black/10 dark:border-white/10 flex flex-col overflow-hidden animate-slideUp select-none"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. Pull Grab Handle */}
                <div
                    className="w-full flex justify-center pt-2.5 pb-1 shrink-0 cursor-pointer"
                    onClick={onClose}
                    title="아래로 내려 닫기"
                >
                    <div className="w-11 h-1.2 rounded-full bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 transition-colors" />
                </div>

                {/* 2. Top Header Bar */}
                <header className="px-4 sm:px-6 pt-1 pb-3 border-b border-black/5 dark:border-white/5 bg-white/80 dark:bg-[#131722]/80 backdrop-blur-md shrink-0 space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/25 shrink-0">
                                <Clock className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                                        {isWonju ? "원주 버스 & 셔틀 시간표" : `${currentCity.name} 시내버스 시간표`}
                                    </h2>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                                        {currentCity.name.split("/")[0]}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Top Right Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm shadow-blue-600/25 transition cursor-pointer active:scale-95"
                            >
                                <MapPin className="w-3.5 h-3.5" />
                                <span className="hidden xs:inline">지도 보기</span>
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                                aria-label="시간표 닫기"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Category Navigation Tabs */}
                    <div className="flex items-center justify-between gap-2">
                        <nav
                            aria-label="시간표 분류"
                            className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar-hidden shrink-0 pt-0.5"
                        >
                            {isWonju ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => handleNavigate("yonsei")}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                                            activeTabCategory === "yonsei"
                                                ? "bg-[#003876] text-white shadow-sm shadow-[#003876]/30"
                                                : "bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/5"
                                        }`}
                                    >
                                        <GraduationCap className="w-3.5 h-3.5" />
                                        <span>연세대 (30·34)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleNavigate("yonsei-shuttle")}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                                            activeTabCategory === "shuttle"
                                                ? "bg-teal-600 text-white shadow-sm shadow-teal-600/30"
                                                : "bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/5"
                                        }`}
                                    >
                                        <span>통학 셔틀버스</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleNavigate(`city:${currentCity.code}`)}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                                            activeTabCategory === "all" || activeTabCategory === "route"
                                                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                                                : "bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/5"
                                        }`}
                                    >
                                        <BookOpen className="w-3.5 h-3.5" />
                                        <span>전체 시내버스</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleNavigate("notices")}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                                            activeTabCategory === "notices"
                                                ? "bg-amber-600 text-white shadow-sm shadow-amber-600/30"
                                                : "bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/5"
                                        }`}
                                    >
                                        <Megaphone className="w-3.5 h-3.5" />
                                        <span>운행 공지</span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => handleNavigate(`city:${currentCity.code}`)}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                                            activeTabCategory === "all" || activeTabCategory === "route"
                                                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                                                : "bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/5"
                                        }`}
                                    >
                                        <BookOpen className="w-3.5 h-3.5" />
                                        <span>전체 노선 목록</span>
                                    </button>
                                </>
                            )}
                        </nav>

                        {/* Search Input Box */}
                        <div className="relative w-44 sm:w-60 shrink-0">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => {
                                    setTimeout(() => setIsSearchFocused(false), 200);
                                }}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && searchResults.length > 0) {
                                        handleNavigate(searchResults[0].docId);
                                        setSearchQuery("");
                                        setIsSearchFocused(false);
                                    }
                                }}
                                placeholder="노선 검색 (예: 34, 셔틀)"
                                className="w-full pl-8 pr-7 py-1.5 text-xs font-bold rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}

                            {/* Autocomplete Dropdown */}
                            {isSearchFocused && searchResults.length > 0 && (
                                <div className="absolute right-0 left-0 top-full mt-1.5 max-h-60 overflow-y-auto rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#161a26] shadow-xl z-50 divide-y divide-black/5 dark:divide-white/5 custom-scrollbar">
                                    {searchResults.map((item) => (
                                        <button
                                            key={item.docId}
                                            type="button"
                                            onMouseDown={() => {
                                                handleNavigate(item.docId);
                                                setSearchQuery("");
                                                setIsSearchFocused(false);
                                            }}
                                            className="w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                                        >
                                            <div className="min-w-0">
                                                <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                                                    {item.title}
                                                </div>
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                                    {item.subtitle}
                                                </div>
                                            </div>
                                            <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold shrink-0">
                                                {item.badge}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* 3. Main Scrollable Timetable Dashboard Content */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto px-3.5 sm:px-6 py-4 pb-20 custom-scrollbar"
                >
                    <div className="max-w-4xl mx-auto space-y-4">
                        {/* Refresh Notification Toast */}
                        {refreshToast && (
                            <div
                                className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-bold ${
                                    refreshToast.type === "success"
                                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                                        : "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200"
                                }`}
                            >
                                <span className="flex items-center gap-2">
                                    {refreshToast.type === "success" ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    ) : (
                                        <Info className="w-4 h-4 text-blue-600" />
                                    )}
                                    {refreshToast.message}
                                </span>
                                <button
                                    type="button"
                                    onClick={clearRefreshToast}
                                    className="p-1 cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}

                        {/* Route Detail View Back Button (When viewing specific route detail) */}
                        {docDescriptor.type === "route" && (
                            <div className="flex items-center justify-between pb-1">
                                <button
                                    type="button"
                                    onClick={() => handleNavigate(isWonju ? "yonsei" : `city:${currentCity.code}`)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 transition cursor-pointer"
                                >
                                    <span>← 시간표 목록으로 돌아가기</span>
                                </button>
                                <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                                    {docDescriptor.title}
                                </span>
                            </div>
                        )}

                        {/* Article Dashboard Body */}
                        {docDescriptor.type === "city" && (
                            <CityWikiArticle
                                city={currentCity}
                                routes={routes}
                                allRouteNames={allRouteNames}
                                meta={meta}
                                isLoading={isLoading}
                                isRefreshing={isRefreshing}
                                error={error}
                                onRefresh={refresh}
                                bookmarks={bookmarks}
                                isRouteBookmarked={isRouteBookmarked}
                                onToggleBookmark={toggleBookmark}
                                onNavigate={handleNavigate}
                                onSelectMapRoute={(rNo) => {
                                    onSelectMapRoute?.(rNo);
                                    onClose();
                                }}
                                now={now}
                            />
                        )}

                        {docDescriptor.type === "yonsei" && (
                            <YonseiWikiArticle
                                routes={routes}
                                dayMode={dayMode}
                                onDayModeChange={onDayModeChange}
                                isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                                onNavigate={handleNavigate}
                                onSelectMapRoute={(rNo) => {
                                    onSelectMapRoute?.(rNo);
                                    onClose();
                                }}
                                now={now}
                            />
                        )}

                        {docDescriptor.type === "yonsei-shuttle" && (
                            <YonseiShuttleWikiArticle
                                onNavigate={handleNavigate}
                                onFlyToLocation={handleFlyToLocation}
                                now={now}
                            />
                        )}

                        {docDescriptor.type === "route" && docDescriptor.routeNo && (
                            <RouteWikiArticle
                                routeNo={docDescriptor.routeNo}
                                city={currentCity}
                                routes={routes}
                                isRouteBookmarked={isRouteBookmarked}
                                onToggleBookmark={toggleBookmark}
                                onNavigate={handleNavigate}
                                onSelectMapRoute={(rNo) => {
                                    onSelectMapRoute?.(rNo);
                                    onClose();
                                }}
                                onFocusStopOnMap={handleFocusStopOnMap}
                                now={now}
                            />
                        )}

                        {(docDescriptor.type === "notices" ||
                            docDescriptor.type === "notice-detail") && (
                            <NoticeWikiArticle
                                noticeId={docDescriptor.noticeId}
                                onNavigate={handleNavigate}
                            />
                        )}

                        <div className="pt-6">
                            <Footer />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TransitWiki;
