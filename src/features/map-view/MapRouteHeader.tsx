"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from "react";
import {AlertTriangle, ChevronDown, GitFork} from "lucide-react";

import {getRouteMeta} from "@entities/route/routeMetadata";
import {useCityContext, useCityFeatures} from "@entities/city";
import {useFavoriteStops} from "@entities/station/hooks";
import type {FavoriteStop} from "@entities/station/types";
import {getNextDeparture, useSchedule} from "@entities/schedule";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {useRecentRoutes, useRouteBookmarks, useRouteVariations} from "@entities/route";
import {MarqueeText} from "@shared/ui/MarqueeText";

import type {BusItem, LiveConnectionStatus} from "@entities/bus/types";
import {VariantDropdown} from "./route-header/VariantDropdown";
import {RouteStatusBadge} from "./route-header/RouteStatusBadge";
import {QuickAccessBar} from "./route-header/QuickAccessBar";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface MapRouteHeaderProps {
    selectedRoute: string;
    onSelectRoute: (route: string) => void;
    runningBuses?: BusItem[];
    allRoutes?: string[];
    connectionStatus?: LiveConnectionStatus;
    hasFetched?: boolean;
    isDegraded?: boolean;
    onReconnect?: () => void;
    selectedVariantId?: string | null;
    onSelectVariant?: (variantId: string | null) => void;
    /** @deprecated Use selectedVariantId / onSelectVariant instead */
    selectedDirection?: "all" | "up" | "down";
    /** @deprecated Use selectedVariantId / onSelectVariant instead */
    onSelectDirection?: (dir: "all" | "up" | "down") => void;
    onOpenScheduleModal?: (docOrSubTab?: string, initialLocation?: "origin" | "dest") => void;
    enabled?: boolean;
}

const emptySubscribe = () => () => {
};

export const MapRouteHeader: React.FC<MapRouteHeaderProps> = ({
                                                                  selectedRoute,
                                                                  onSelectRoute,
                                                                  runningBuses = [],
                                                                  allRoutes = [],
                                                                  connectionStatus = "connected",
                                                                  hasFetched = true,
                                                                  isDegraded = false,
                                                                  onReconnect,
                                                                  selectedVariantId = null,
                                                                  onSelectVariant,
                                                                  onOpenScheduleModal,
                                                                  enabled = true,
                                                              }) => {
    const {currentCity} = useCityContext();
    const {hasDetailedTimetable, hasUniversityShuttle, defaultQuickRoutes} = useCityFeatures();
    const {map} = useAppMapContext();
    const {settings} = useAppSettings();
    const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const [isVariantMenuOpen, setIsVariantMenuOpen] = useState(false);
    const variantMenuRef = useRef<HTMLDivElement>(null);

    const {favoriteStops} = useFavoriteStops(currentCity.code);
    const {bookmarks} = useRouteBookmarks(currentCity.code);
    const {recentRoutes} = useRecentRoutes(currentCity.code);
    const {routes: scheduleRoutes} = useSchedule(hasDetailedTimetable);

    // Fetch variations for current route (e.g. 30 has basic, via-Sangji, etc.)
    const {variations} = useRouteVariations(selectedRoute, enabled && Boolean(selectedRoute), currentCity.code);

    // Close dropdown on outside click
    useEffect(() => {
        if (!isVariantMenuOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (variantMenuRef.current && !variantMenuRef.current.contains(e.target as Node)) {
                setIsVariantMenuOpen(false);
            }
        };
        window.addEventListener("mousedown", handleClickOutside);
        return () => window.removeEventListener("mousedown", handleClickOutside);
    }, [isVariantMenuOpen]);

    // Tick every 30s to keep next departure countdown fresh when 0 buses are running
    const [now, setNow] = useState<Date>(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    // Current route metadata (re-evaluates when dynamic route list loads)
    const meta = useMemo(
        () => getRouteMeta(selectedRoute, currentCity.code),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [selectedRoute, currentCity.code, allRoutes.length]
    );
    const runningCount = runningBuses.length;

    // Running buses count per variation
    const busesPerVariation = useMemo(() => {
        const counts = new Map<string, number>();
        for (const b of runningBuses) {
            if (b.routeid) {
                counts.set(b.routeid, (counts.get(b.routeid) ?? 0) + 1);
            }
        }
        return counts;
    }, [runningBuses]);

    // Effective variations list
    const effectiveVariations = useMemo(() => {
        if (variations && variations.length > 0) {
            return variations;
        }
        return [];
    }, [variations]);

    const hasMultipleVariants = effectiveVariations.length > 1;

    // Currently active variation object (or null for 'all')
    const activeVariant = useMemo(() => {
        if (effectiveVariations.length === 0) return null;
        if (selectedVariantId && selectedVariantId !== "all") {
            const matched = effectiveVariations.find((v) => v.routeId === selectedVariantId);
            if (matched) return matched;
        }
        if (selectedVariantId === "all") return null;
        return effectiveVariations[0];
    }, [effectiveVariations, selectedVariantId]);

    // Current index of variation for indicator (e.g. 1/3)
    const currentVariantIndex = useMemo(() => {
        if (!hasMultipleVariants) return 0;
        if (selectedVariantId === "all") return -1;
        if (!activeVariant) return 0;
        const idx = effectiveVariations.findIndex((v) => v.routeId === activeVariant.routeId);
        return idx >= 0 ? idx : 0;
    }, [hasMultipleVariants, selectedVariantId, activeVariant, effectiveVariations]);

    // Cycle through variants on click
    const handleCycleVariant = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            if (!onSelectVariant || effectiveVariations.length <= 1) return;

            // Cycle order: [v0, v1, ..., 'all']
            const options: (string | null)[] = [
                ...effectiveVariations.map((v) => v.routeId),
                "all",
            ];
            const currentVal = selectedVariantId === "all" ? "all" : (activeVariant?.routeId ?? options[0]);
            const currIdx = options.indexOf(currentVal);
            const nextIdx = (currIdx + 1) % options.length;
            onSelectVariant(options[nextIdx]);
        },
        [onSelectVariant, effectiveVariations, selectedVariantId, activeVariant]
    );

    const handleSelectSpecificVariant = useCallback(
        (vId: string | null) => {
            onSelectVariant?.(vId);
            setIsVariantMenuOpen(false);
        },
        [onSelectVariant]
    );

    // Next scheduled departure when no buses are currently running
    const nextScheduleInfo = useMemo(() => {
        if (!hasDetailedTimetable || scheduleRoutes.length === 0) return null;
        const matched = scheduleRoutes.find((r) => r.routeNo === selectedRoute);
        if (!matched || !matched.timetable || matched.timetable.length === 0) return null;
        const {nextOrigin, nextDest, originWaitMins, destWaitMins} = getNextDeparture(matched.timetable, now);
        if (nextOrigin && originWaitMins !== null) {
            return {
                time: nextOrigin.originDepTime,
                waitMins: originWaitMins,
                label: "기점 출발",
            };
        }
        if (nextDest && destWaitMins !== null) {
            return {
                time: nextDest.destDepTime,
                waitMins: destWaitMins,
                label: "종점 출발",
            };
        }
        return null;
    }, [hasDetailedTimetable, scheduleRoutes, selectedRoute, now]);

    // Derive recent & bookmarked routes for quick switch bar (SSR-safe via useSyncExternalStore)
    const quickRoutes = useMemo<string[]>(() => {
        if (!isClient) {
            return defaultQuickRoutes;
        }

        const set = new Set<string>();

        defaultQuickRoutes.forEach((r) => set.add(r));
        bookmarks.slice(0, 4).forEach((r) => set.add(r));
        recentRoutes.slice(0, 3).forEach((r) => set.add(r));

        if (selectedRoute) {
            set.add(selectedRoute);
        }

        // Filter against existing allRoutes if available
        let list = allRoutes.length > 0 ? Array.from(set).filter((r) => allRoutes.includes(r)) : Array.from(set);
        if (list.length === 0 && allRoutes.length > 0) {
            list = allRoutes.slice(0, 4);
        }
        return list;
    }, [isClient, defaultQuickRoutes, bookmarks, recentRoutes, allRoutes, selectedRoute]);

    const handleJumpToFavoriteStop = useCallback(
        (fav: FavoriteStop) => {
            if (map && fav.gpslong && fav.gpslati) {
                map.flyTo({
                    center: [fav.gpslong, fav.gpslati],
                    zoom: Math.max(map.getZoom(), 16.2),
                    duration: 950,
                });
            }
            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("wbus:focus-stop", {
                        detail: {
                            nodeid: fav.nodeid,
                            nodenm: fav.nodenm,
                            nodeno: fav.nodeno,
                            gpslati: fav.gpslati,
                            gpslong: fav.gpslong,
                        },
                    })
                );
            }
        },
        [map]
    );

    // Active variant bus count
    const activeVariantBusCount = activeVariant ? (busesPerVariation.get(activeVariant.routeId) ?? 0) : runningCount;

    const headerRef = useRef<HTMLElement>(null);

    // Measure actual floating header bottom so mobile top-right MapLibre controls never collide with it
    useEffect(() => {
        if (typeof window === "undefined" || typeof document === "undefined") return;
        const el = headerRef.current;
        if (!el) return;

        const updateHeaderOffset = () => {
            const rect = el.getBoundingClientRect();
            if (rect.height > 0) {
                document.documentElement.style.setProperty(
                    "--wbus-header-bottom",
                    `${Math.ceil(rect.bottom + 8)}px`
                );
            }
        };

        updateHeaderOffset();

        let observer: ResizeObserver | null = null;
        if (typeof ResizeObserver !== "undefined") {
            observer = new ResizeObserver(updateHeaderOffset);
            observer.observe(el);
        }
        window.addEventListener("resize", updateHeaderOffset);

        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", updateHeaderOffset);
            document.documentElement.style.removeProperty("--wbus-header-bottom");
        };
    }, [isDegraded, selectedVariantId, favoriteStops.length]);

    return (
        <>
            <header
                ref={headerRef}
                className={`absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] left-1/2 lg:left-[calc(50%+166px)] xl:left-[calc(50%+186px)] -translate-x-1/2 ${
                    isVariantMenuOpen ? "z-[80]" : "z-50"
                } pointer-events-auto flex flex-col items-center gap-1.5 w-[calc(100vw-1rem)] sm:w-auto sm:max-w-[calc(100vw-9rem)] lg:max-w-[calc(100vw-492px)] xl:max-w-[calc(100vw-532px)] animate-fadeIn select-none`}
            >
                {/* 1. Main Route Overview Glass Card */}
                <div
                    ref={variantMenuRef}
                    className={`relative ${
                        isVariantMenuOpen ? "z-30" : "z-20"
                    } flex w-full min-w-0 items-center gap-1 sm:gap-1.5 p-1.5 pr-2.5 sm:p-2 sm:pr-3 bg-white/92 dark:bg-[#11131a]/92 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.14)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)] rounded-full transition-all duration-300 max-w-full sm:w-auto`}
                >
                    {/* Route Variation Toggle & Focus Switcher */}
                    <div className={`relative flex min-w-0 flex-1 items-center ${isVariantMenuOpen ? "z-50" : ""}`}>
                        <button
                            type="button"
                            suppressHydrationWarning
                            onClick={hasMultipleVariants ? handleCycleVariant : undefined}
                            className={`flex w-full min-w-0 items-center gap-2 px-2 py-1 sm:px-2.5 sm:py-1 rounded-full transition-all duration-200 cursor-pointer overflow-hidden text-left select-none active:scale-95 ${
                                hasMultipleVariants
                                    ? "hover:bg-blue-50/80 dark:hover:bg-blue-950/30"
                                    : "cursor-default"
                            }`}
                            title={
                                hasMultipleVariants
                                    ? `클릭하여 노선 종류(경유지) 전환 (현재: ${selectedVariantId === "all" ? "전체 경로" : (activeVariant?.label ?? `${meta.origin} - ${meta.destination}`)})`
                                    : `${meta.origin} ↔ ${meta.destination}`
                            }
                            aria-label="노선 종류 및 경유지 전환"
                        >
                            <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white ${meta.colorTheme.bg} ${meta.colorTheme.shadow || "shadow-[0_4px_12px_rgba(0,0,0,0.15)]"}`}
                                aria-hidden="true"
                            >
                                <GitFork className="h-4 w-4"/>
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col justify-center">
                                <span
                                    className={`mb-0.5 text-[9px] font-black uppercase tracking-wider ${meta.colorTheme.text}`}>
                                    {selectedRoute}
                                </span>
                                <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                                    {/* Main destination / origin path or variant title (Slowly marquees when overflowing on mobile instead of cutting with ellipsis) */}
                                    <MarqueeText
                                        text={
                                            selectedVariantId === "all"
                                                ? `${meta.origin} ↔ ${meta.destination}`
                                                : (activeVariant?.label ?? `${meta.origin} ↔ ${meta.destination}`)
                                        }
                                        className="text-xs sm:text-sm font-black text-slate-900 dark:text-white"
                                        containerClassName="min-w-0 flex-1"
                                        durationSeconds={14}
                                        fadeEdges
                                    />

                                    {/* Variant Pill Badge */}
                                    {hasMultipleVariants && (
                                        <span
                                            suppressHydrationWarning
                                            className={`px-1.5 py-0.5 rounded-md text-[9px] font-black shrink-0 transition-colors flex items-center gap-0.5 ${
                                                selectedVariantId === "all"
                                                    ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                                    : `${meta.colorTheme.bg} text-white shadow-xs`
                                            }`}
                                        >
                                            <GitFork className="w-2.5 h-2.5 shrink-0"/>
                                            <span>
                                                {selectedVariantId === "all"
                                                    ? "전체"
                                                    : `${currentVariantIndex + 1}/${effectiveVariations.length}`}
                                            </span>
                                            {activeVariantBusCount > 0 && selectedVariantId !== "all" && (
                                                <span
                                                    className="ml-0.5 opacity-90 font-mono">({activeVariantBusCount}대)</span>
                                            )}
                                        </span>
                                    )}

                                    {/* Single variant fallback: route type badge */}
                                    {!hasMultipleVariants && (
                                        <span
                                            suppressHydrationWarning
                                            className={`px-1.5 py-0.5 rounded-md text-[9px] font-black shrink-0 ${meta.colorTheme.badgeBg} ${meta.colorTheme.text}`}
                                        >
                                            {meta.routeType || (meta.genericType === "EXPRESS" ? "급행" : meta.genericType === "BRANCH" ? "지선" : meta.genericType === "VILLAGE" ? "마을" : "간선")}
                                        </span>
                                    )}

                                    {meta.isYonsei && settings.showYonseiFeatures && (
                                        <span
                                            className="hidden xs:inline-flex px-1.5 py-0.2 rounded-full text-[9px] font-black bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 shrink-0">
                                            연세대
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>

                        {/* Dropdown open trigger button for multi-variant routes */}
                        {hasMultipleVariants && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsVariantMenuOpen((prev) => !prev);
                                }}
                                className="p-1 rounded-full text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                                title="전체 경유지/노선 종류 목록 보기"
                                aria-label="노선 종류 목록 열기"
                            >
                                <ChevronDown
                                    className={`w-3.5 h-3.5 transition-transform ${isVariantMenuOpen ? "rotate-180" : ""}`}/>
                            </button>
                        )}

                        {/* Floating Variant Selector Dropdown Popover */}
                        {hasMultipleVariants && isVariantMenuOpen && (
                            <VariantDropdown
                                meta={meta}
                                effectiveVariations={effectiveVariations}
                                selectedVariantId={selectedVariantId}
                                activeVariant={activeVariant}
                                busesPerVariation={busesPerVariation}
                                onSelectVariant={handleSelectSpecificVariant}
                            />
                        )}
                    </div>

                    {/* Detailed Real-Time Status Pill */}
                    <RouteStatusBadge
                        selectedRoute={selectedRoute}
                        hasFetched={hasFetched}
                        connectionStatus={connectionStatus}
                        runningCount={runningCount}
                        isDegraded={isDegraded}
                        nextScheduleInfo={nextScheduleInfo}
                        onOpenScheduleModal={onOpenScheduleModal}
                        onReconnect={onReconnect}
                    />
                </div>

                {/* Degraded External API Status Notice Banner */}
                {isDegraded && (
                    <div
                        className="relative z-0 flex items-center gap-1.5 px-3 py-1 bg-amber-500/95 dark:bg-amber-600/95 text-white rounded-full text-[11px] font-extrabold shadow-sm backdrop-blur-md animate-fadeIn"
                        role="status"
                        aria-live="polite"
                    >
                        <AlertTriangle className="w-3 h-3 shrink-0"/>
                        <span>공공데이터 API 응답 지연 중 · 최근 수신된 위치를 표시합니다</span>
                    </div>
                )}

                {/* 2. Fast Route & Favorite Stop Switcher Bar (Horizontal Swipeable Quick Pills) */}
                <QuickAccessBar
                    quickRoutes={quickRoutes}
                    selectedRoute={selectedRoute}
                    meta={meta}
                    showYonseiFeatures={settings.showYonseiFeatures}
                    hasUniversityShuttle={hasUniversityShuttle}
                    defaultQuickRoutes={defaultQuickRoutes}
                    isClient={isClient}
                    favoriteStops={favoriteStops}
                    onSelectRoute={onSelectRoute}
                    onJumpToFavoriteStop={handleJumpToFavoriteStop}
                />
            </header>
        </>
    );
};
