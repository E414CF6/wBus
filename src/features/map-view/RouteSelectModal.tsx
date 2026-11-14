"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import Link from "next/link";
import {Bus, ChevronRight, Clock, GraduationCap, MapPin, Search, X} from "lucide-react";
import {getRouteMeta, useRecentRoutes, useRouteBookmarks} from "@entities/route";
import {UI_TEXT} from "@shared/config/locale";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {buildPageHref, SPECIAL_PAGE_IDS} from "@shared/config/pages";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {useCityContext, useCityFeatures} from "@entities/city";
import {useCityRoutes} from "@entities/route/hooks";
import {useBusStop, useFavoriteStops} from "@entities/station/hooks";
import type {BusStop} from "@entities/station/types";
import {triggerHaptic} from "@shared/utils/haptics";
import {isCoarsePointerDevice, isDesktopViewport, markModalNavigating, markModalReplacing, Modal} from "@shared/ui";
import {MatchedStopsSection} from "./route-select/MatchedStopsSection";
import {RouteGridCard} from "./route-select/RouteGridCard";
import {useRouteSelectFilter} from "./route-select/useRouteSelectFilter";

interface RouteSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    allRoutes: string[];
    selectedRoute: string;
    onSelectRoute: (routeName: string) => void;
    recentRoutes?: string[];
}

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

    const {routes: cityRoutes = []} = useCityRoutes(currentCity.code);
    const {favoriteStops, isFavoriteStop, toggleFavoriteStop} = useFavoriteStops(currentCity.code);
    const currentRouteStops = useBusStop(isOpen ? selectedRoute : "", currentCity.code);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

    const {bookmarks, toggleBookmark: toggleRouteBookmark} = useRouteBookmarks(currentCity.code);
    const {recentRoutes, addRecentRoute} = useRecentRoutes(currentCity.code);

    const searchInputRef = useRef<HTMLInputElement>(null);

    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (isOpen) {
            setSearchQuery("");
            setSelectedCategory("ALL");
        }
    }

    const toggleBookmark = useCallback(
        (e: React.MouseEvent, route: string) => {
            e.stopPropagation();
            toggleRouteBookmark(route);
        },
        [toggleRouteBookmark]
    );

    const handleSelect = useCallback(
        (route: string) => {
            triggerHaptic("selection");
            onSelectRoute(route);
            addRecentRoute(route);
            onClose();
        },
        [onSelectRoute, addRecentRoute, onClose]
    );

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

    useEffect(() => {
        if (isOpen && !isCoarsePointerDevice()) {
            const timer = setTimeout(() => {
                searchInputRef.current?.focus();
            }, 60);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const {
        sortedAllRoutes,
        routeMetaMap,
        routeCategoryMap,
        categories,
        effectiveCategory,
        matchedStops,
        filteredRoutes,
    } = useRouteSelectFilter({
        allRoutes,
        cityRoutes,
        cityCode: currentCity.code,
        bookmarks,
        favoriteStops,
        currentRouteStops,
        hasUniversityShuttle,
        showYonseiFeatures: settings.showYonseiFeatures,
        searchQuery,
        selectedCategory,
    });

    const validRecentRoutes = recentRoutes.filter((r) => sortedAllRoutes.includes(r));

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

    const visibleRoutes = useMemo(() => filteredRoutes.slice(0, visibleCount), [filteredRoutes, visibleCount]);

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

            <div
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 sm:p-6 pt-2 sm:pt-3 custom-scrollbar space-y-4"
            >
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

                {matchedStops.length > 0 && (
                    <MatchedStopsSection
                        matchedStops={matchedStops}
                        isFavStopsCategoryOnly={effectiveCategory === "FAV_STOPS" && !searchQuery.trim()}
                        isFavoriteStop={isFavoriteStop}
                        onSelectStop={handleSelectStop}
                        onToggleFavoriteStop={toggleFavoriteStop}
                    />
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
                            return (
                                <RouteGridCard
                                    key={route}
                                    route={route}
                                    meta={meta}
                                    categoryLabel={routeCategoryMap.get(route)?.label}
                                    isSelected={route === selectedRoute}
                                    isYonsei={Boolean(settings.showYonseiFeatures && meta.isYonsei)}
                                    isBookmarked={bookmarks.includes(route)}
                                    onSelect={handleSelect}
                                    onToggleBookmark={toggleBookmark}
                                />
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
