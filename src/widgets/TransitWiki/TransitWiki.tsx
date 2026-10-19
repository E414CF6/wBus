"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    BookOpen,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    GraduationCap,
    Home,
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
import type {DayMode, TimetableSubTab} from "@shared/types/navigation";

import {
    getWikiBreadcrumbs,
    resolveWikiDoc,
    searchWikiDocs,
} from "./model/wikiRouter";
import {WikiCategoryBox, WikiParentBanner} from "./ui/WikiPrimitives";
import {WikiNavTemplate} from "./ui/WikiNavTemplate";
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

    // Live clock
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

    // Wiki Document History Stack
    const resolvedInitial = useMemo(
        () => resolveWikiDoc(initialDocId, currentCity.code).docId,
        [initialDocId, currentCity.code]
    );
    const [history, setHistory] = useState<string[]>([resolvedInitial]);
    const [historyIdx, setHistoryIdx] = useState<number>(0);

    const [prevInitialDocId, setPrevInitialDocId] = useState(resolvedInitial);
    if (resolvedInitial !== prevInitialDocId) {
        setPrevInitialDocId(resolvedInitial);
        const currentActive = history[historyIdx] || resolvedInitial;
        if (resolvedInitial !== currentActive) {
            const nextHistory = history.slice(0, historyIdx + 1);
            nextHistory.push(resolvedInitial);
            setHistory(nextHistory);
            setHistoryIdx(nextHistory.length - 1);
        }
    }

    const activeDocId = history[historyIdx] || resolvedInitial;
    const docDescriptor = useMemo(
        () => resolveWikiDoc(activeDocId, currentCity.code),
        [activeDocId, currentCity.code]
    );
    const breadcrumbs = useMemo(
        () => getWikiBreadcrumbs(activeDocId, currentCity.code),
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
            if (nextDoc.docId === activeDocId) {
                scrollToTop();
                return;
            }
            const nextHistory = history.slice(0, historyIdx + 1);
            nextHistory.push(nextDoc.docId);
            setHistory(nextHistory);
            setHistoryIdx(nextHistory.length - 1);
            scrollToTop();

            const mappedSubTab: TimetableSubTab =
                nextDoc.type === "yonsei" || nextDoc.type === "yonsei-shuttle"
                    ? "yonsei"
                    : "all";
            onDocChange?.(nextDoc.docId, mappedSubTab);
        },
        [activeDocId, currentCity.code, history, historyIdx, onDocChange, scrollToTop]
    );

    const handleGoBack = useCallback(() => {
        if (historyIdx <= 0) return;
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        scrollToTop();
        const prevDoc = resolveWikiDoc(history[nextIdx], currentCity.code);
        onDocChange?.(
            prevDoc.docId,
            prevDoc.type === "yonsei" || prevDoc.type === "yonsei-shuttle"
                ? "yonsei"
                : "all"
        );
    }, [history, historyIdx, currentCity.code, onDocChange, scrollToTop]);

    const handleGoForward = useCallback(() => {
        if (historyIdx >= history.length - 1) return;
        const nextIdx = historyIdx + 1;
        setHistoryIdx(nextIdx);
        scrollToTop();
        const fwdDoc = resolveWikiDoc(history[nextIdx], currentCity.code);
        onDocChange?.(
            fwdDoc.docId,
            fwdDoc.type === "yonsei" || fwdDoc.type === "yonsei-shuttle"
                ? "yonsei"
                : "all"
        );
    }, [history, historyIdx, currentCity.code, onDocChange, scrollToTop]);

    // Global Wiki Search Autocomplete
    const [wikiSearch, setWikiSearch] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    const searchResults = useMemo(() => {
        if (!wikiSearch.trim() && !isSearchFocused) return [];
        return searchWikiDocs(wikiSearch, routes, allRouteNames, currentCity.code);
    }, [wikiSearch, isSearchFocused, routes, allRouteNames, currentCity.code]);

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

    return (
        <div
            className="fixed inset-0 z-60 flex flex-col justify-end sm:justify-center items-center bg-black/55 backdrop-blur-md transition-opacity duration-300 animate-fadeIn"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                className="relative w-full sm:max-w-5xl h-[92dvh] sm:h-[88dvh] bg-[#f8f9fa] dark:bg-[#0e1118] rounded-t-[28px] sm:rounded-[24px] shadow-2xl border border-slate-300 dark:border-slate-800 flex flex-col overflow-hidden animate-slideUp"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. Sticky Wiki Reader Top Bar */}
                <header className="flex flex-col gap-2.5 px-3.5 sm:px-6 py-3 border-b border-slate-300 dark:border-slate-800 bg-white dark:bg-[#131722] shrink-0 z-30">
                    {/* Top Row: History Controls, Breadcrumb, Search, Map Close */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                            {/* Back / Forward / Home */}
                            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#191e2b] p-0.5 shrink-0">
                                <button
                                    type="button"
                                    disabled={historyIdx <= 0}
                                    onClick={handleGoBack}
                                    title="이전 문서"
                                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    disabled={historyIdx >= history.length - 1}
                                    onClick={handleGoForward}
                                    title="다음 문서"
                                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleNavigate(`city:${currentCity.code}`)
                                    }
                                    title="지역 대문 문서로 이동"
                                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 cursor-pointer"
                                >
                                    <Home className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Breadcrumbs */}
                            <nav
                                aria-label="위키 문서 경로"
                                className="flex items-center gap-1 text-xs font-bold overflow-x-auto custom-scrollbar-hidden min-w-0"
                            >
                                <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 ml-1" />
                                {breadcrumbs.map((crumb, idx) => {
                                    const isLast = idx === breadcrumbs.length - 1;
                                    return (
                                        <React.Fragment key={`${crumb.docId}-${idx}`}>
                                            {idx > 0 && (
                                                <span className="text-slate-400 select-none">
                                                    /
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleNavigate(crumb.docId)}
                                                className={`whitespace-nowrap truncate cursor-pointer ${
                                                    isLast
                                                        ? "text-slate-900 dark:text-white font-black"
                                                        : "text-blue-600 dark:text-blue-400 hover:underline"
                                                }`}
                                            >
                                                {crumb.label}
                                            </button>
                                        </React.Fragment>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* Right Actions: Return to Map & Close */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-xs transition cursor-pointer active:scale-95"
                            >
                                <MapPin className="w-3.5 h-3.5" />
                                <span className="hidden xs:inline">지도 보기</span>
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                                aria-label="위키 닫기"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Second Row: Quick Hub Document Links + Global Wiki Document Search */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar-hidden shrink-0">
                            <button
                                type="button"
                                onClick={() => handleNavigate(`city:${currentCity.code}`)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-extrabold border transition cursor-pointer whitespace-nowrap ${
                                    docDescriptor.type === "city"
                                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white"
                                        : "bg-slate-100 dark:bg-[#191e2b] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                }`}
                            >
                                <BookOpen className="w-3 h-3" />
                                <span>{currentCity.name.split("/")[0]} 시내버스</span>
                            </button>

                            {isWonju && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => handleNavigate("yonsei")}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-extrabold border transition cursor-pointer whitespace-nowrap ${
                                            docDescriptor.type === "yonsei"
                                                ? "bg-[#003876] text-white border-[#003876]"
                                                : "bg-slate-100 dark:bg-[#191e2b] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                        }`}
                                    >
                                        <GraduationCap className="w-3.5 h-3.5" />
                                        <span>연세대 미래캠퍼스/교통</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleNavigate("yonsei-shuttle")}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-extrabold border transition cursor-pointer whitespace-nowrap ${
                                            docDescriptor.type === "yonsei-shuttle"
                                                ? "bg-teal-600 text-white border-teal-600"
                                                : "bg-slate-100 dark:bg-[#191e2b] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                        }`}
                                    >
                                        <span>연세대/셔틀버스</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleNavigate("notices")}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-extrabold border transition cursor-pointer whitespace-nowrap ${
                                            docDescriptor.type === "notices" ||
                                            docDescriptor.type === "notice-detail"
                                                ? "bg-amber-600 text-white border-amber-600"
                                                : "bg-slate-100 dark:bg-[#191e2b] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                        }`}
                                    >
                                        <Megaphone className="w-3 h-3" />
                                        <span>교통 공지사항</span>
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Wiki Search Box with Instant Dropdown */}
                        <div className="relative w-full sm:w-72">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                value={wikiSearch}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => {
                                    setTimeout(() => setIsSearchFocused(false), 180);
                                }}
                                onChange={(e) => setWikiSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && searchResults.length > 0) {
                                        handleNavigate(searchResults[0].docId);
                                        setWikiSearch("");
                                        setIsSearchFocused(false);
                                    }
                                }}
                                placeholder="위키 문서·노선 빠른 이동 (예: 34, 셔틀)"
                                className="w-full pl-8 pr-7 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#11141c] text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                            />
                            {wikiSearch && (
                                <button
                                    type="button"
                                    onClick={() => setWikiSearch("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}

                            {/* Search Autocomplete Dropdown */}
                            {isSearchFocused && searchResults.length > 0 && (
                                <div className="absolute right-0 left-0 top-full mt-1 max-h-68 overflow-y-auto rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161a26] shadow-xl z-50 divide-y divide-slate-100 dark:divide-slate-800">
                                    {searchResults.map((item) => (
                                        <button
                                            key={item.docId}
                                            type="button"
                                            onMouseDown={() => {
                                                handleNavigate(item.docId);
                                                setWikiSearch("");
                                                setIsSearchFocused(false);
                                            }}
                                            className="w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between gap-2 cursor-pointer"
                                        >
                                            <div className="min-w-0">
                                                <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                                                    {item.title}
                                                </div>
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                                    {item.subtitle}
                                                </div>
                                            </div>
                                            <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[10px] font-bold shrink-0">
                                                {item.badge}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* 2. Scrollable Wiki Document Sheet */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto px-3.5 sm:px-8 py-5 pb-28 sm:pb-16 custom-scrollbar"
                >
                    <article className="max-w-4xl mx-auto bg-white dark:bg-[#12151e] border border-slate-300 dark:border-slate-800 rounded-xl p-4 sm:p-7 shadow-2xs space-y-5">
                        {/* Refresh Toast Notification */}
                        {refreshToast && (
                            <div
                                className={`p-3 rounded-lg border flex items-center justify-between text-xs font-bold ${
                                    refreshToast.type === "success"
                                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-200"
                                        : "bg-blue-50 dark:bg-blue-950/40 border-blue-300 text-blue-800 dark:text-blue-200"
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

                        {/* Category Classification Bar */}
                        <WikiCategoryBox
                            categories={docDescriptor.categories}
                            onNavigate={handleNavigate}
                        />

                        {/* Document Title Header */}
                        <div className="border-b-2 border-slate-800 dark:border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                            <div>
                                <div className="text-[11px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                    {docDescriptor.namespace}
                                </div>
                                <h1 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                                    {docDescriptor.title}
                                </h1>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                                문서 식별자: {docDescriptor.docId}
                            </div>
                        </div>

                        {/* Parent Document Pointer */}
                        <WikiParentBanner
                            parentDocId={docDescriptor.parentDocId}
                            parentTitle={docDescriptor.parentTitle}
                            secondaryParentDocId={docDescriptor.secondaryParentDocId}
                            secondaryParentTitle={docDescriptor.secondaryParentTitle}
                            onNavigate={handleNavigate}
                        />

                        {/* Top Navigation Template (둘러보기 틀) */}
                        <WikiNavTemplate
                            cityCode={currentCity.code}
                            cityName={currentCity.name}
                            activeDocId={docDescriptor.docId}
                            routes={routes}
                            allRouteNames={allRouteNames}
                            bookmarks={bookmarks}
                            onNavigate={handleNavigate}
                        />

                        {/* Dynamic Article Body */}
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
                    </article>

                    <div className="max-w-4xl mx-auto mt-6">
                        <Footer />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TransitWiki;
