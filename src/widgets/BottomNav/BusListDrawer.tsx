"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Bus, Loader2} from "lucide-react";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {isDesktopViewport, useIsDesktop} from "@shared/ui/useIsDesktop";
import {useModalHistory} from "@shared/ui";
import {triggerHaptic} from "@shared/utils/haptics";
import {type RouteVariationStop, useRouteVariations} from "@entities/route";
import type {DirectionCode, RouteVariation} from "@entities/route/types";
import {getRouteMeta} from "@entities/route/routeMetadata";
import {useSchedule} from "@entities/schedule/hooks";
import {useCityContext, useCityFeatures} from "@entities/city";
import {findPairedOppositeStop, useBusStop, useFavoriteStops} from "@entities/station";
import type {BusItem} from "@entities/bus/types";
import type {BusStop} from "@entities/station/types";
import {getHaversineDistance} from "@shared/utils/geo";

import {useBusStopMatcher} from "./hooks/useBusStopMatcher";
import {useStopSearchFilter} from "./hooks/useStopSearchFilter";
import {useElapsedTimeAgo} from "./hooks/useElapsedTimeAgo";
import {BusDrawerHeader} from "./ui/BusDrawerHeader";
import {BusDrawerFilterBar} from "./ui/BusDrawerFilterBar";
import {BusDrawerStopItem} from "./ui/BusDrawerStopItem";
import {DesktopSplitStopView} from "./ui/DesktopSplitStopView";

interface BusListDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    selectedRoute: string;
    runningBuses: BusItem[];
    isConnecting: boolean;
    getDirection?: (nodeId: string | null | undefined, nodeOrd: number, routeId?: string | null) => DirectionCode;
    onBusClick: (lat: number, lng: number) => void;
    lastUpdated?: number | null;
    onReconnect?: () => void;
    onRouteChange?: (routeName: string) => void;
    selectedVariantId?: string | null;
    onSelectVariant?: (variantId: string | null) => void;
}

export const BusListDrawer: React.FC<BusListDrawerProps> = ({
                                                                isOpen,
                                                                onClose,
                                                                selectedRoute,
                                                                runningBuses,
                                                                isConnecting,
                                                                getDirection,
                                                                onBusClick,
                                                                lastUpdated,
                                                                onReconnect,
                                                                onRouteChange,
                                                                selectedVariantId: controlledVariantId,
                                                                onSelectVariant,
                                                            }) => {
    const {map} = useAppMapContext();
    const {currentCity} = useCityContext();
    const {hasDetailedTimetable, hasRouteVariations} = useCityFeatures();

    const {variations} = useRouteVariations(selectedRoute, isOpen, currentCity.code);
    const nationwideStops = useBusStop(isOpen && !hasRouteVariations ? selectedRoute : "", currentCity.code);
    const {routes: scheduleRoutes} = useSchedule(isOpen && hasDetailedTimetable);
    const {isFavoriteStop, toggleFavoriteStop} = useFavoriteStops(currentCity.code);

    const isDesktop = useIsDesktop();

    useModalHistory({
        isOpen: isOpen && !isDesktop,
        onClose,
        modalId: "bus-list",
        enableHistory: !isDesktop,
    });

    const [internalVariantId, setInternalVariantId] = useState<string | null>(null);
    const selectedVariantId = controlledVariantId !== undefined ? controlledVariantId : internalVariantId;
    const setSelectedVariantId = onSelectVariant ?? setInternalVariantId;
    const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
    const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
    const [isSplitCollapsed, setIsSplitCollapsed] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [dragOffsetY, setDragOffsetY] = useState(0);
    const [isDraggingSheet, setIsDraggingSheet] = useState(false);
    const dragStartRef = useRef<{ y: number; time: number } | null>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const hasAutoScrolledRef = useRef<string | null>(null);
    const suppressNextMapSyncRef = useRef(false);

    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (isOpen) {
            setDragOffsetY(0);
            setIsDraggingSheet(false);
        }
    }

    // Listen to external focus stop event (from map marker click or search)
    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleFocusStop = (e: Event) => {
            const detail = (e as CustomEvent<BusStop>).detail;
            if (detail && detail.nodeid) {
                setSelectedStop(detail);
                setSelectedStopId(detail.nodeid);
            }
        };
        window.addEventListener("wbus:focus-stop", handleFocusStop);
        return () => window.removeEventListener("wbus:focus-stop", handleFocusStop);
    }, []);

    // Deselect stop or close split on desktop when empty map area is clicked
    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleDeselectStop = () => {
            if (isDesktopViewport()) {
                setSelectedStop(null);
                setSelectedStopId(null);
            }
        };
        window.addEventListener("wbus:close-popups", handleDeselectStop);
        window.addEventListener("wbus:deselect-stop", handleDeselectStop);
        return () => {
            window.removeEventListener("wbus:close-popups", handleDeselectStop);
            window.removeEventListener("wbus:deselect-stop", handleDeselectStop);
        };
    }, []);

    // Reset stop selection on route change
    const [prevRoute, setPrevRoute] = useState(selectedRoute);
    if (selectedRoute !== prevRoute) {
        setPrevRoute(selectedRoute);
        setSelectedStop(null);
        setSelectedStopId(null);
        setIsSplitCollapsed(false);
    }

    // Route Metadata
    const meta = useMemo(() => getRouteMeta(selectedRoute, currentCity.code), [selectedRoute, currentCity.code]);

    // Construct synthetic single variation for nationwide cities when variations are not yet resolved
    const nationwideVariations = useMemo<RouteVariation[]>(() => {
        if (hasRouteVariations || !nationwideStops || nationwideStops.length === 0) return [];
        return [
            {
                routeId: selectedRoute,
                label: `${selectedRoute}`,
                stops: nationwideStops as RouteVariationStop[],
                stopCount: nationwideStops.length,
                turningStop: null,
            },
        ];
    }, [hasRouteVariations, nationwideStops, selectedRoute]);

    const effectiveVariations = variations.length > 0 ? variations : nationwideVariations;

    // Active variant object
    const currentVariant = useMemo(() => {
        if (!effectiveVariations || effectiveVariations.length === 0) return null;
        if (selectedVariantId) {
            const matched = effectiveVariations.find((v) => v.routeId === selectedVariantId);
            if (matched) return matched;
        }
        const variantWithBuses = runningBuses.find(
            (b) => b.routeid && effectiveVariations.some((v) => v.routeId === b.routeid)
        )?.routeid;
        if (variantWithBuses) {
            const matched = effectiveVariations.find((v) => v.routeId === variantWithBuses);
            if (matched) return matched;
        }
        return effectiveVariations[0];
    }, [effectiveVariations, selectedVariantId, runningBuses]);

    const currentStops = useMemo(() => currentVariant?.stops ?? [], [currentVariant]);
    const turningStop = useMemo(() => currentVariant?.turningStop ?? null, [currentVariant]);

    // Count running buses per variation
    const busesPerVariation = useMemo(() => {
        const mapCounts = new Map<string, number>();
        for (const bus of runningBuses) {
            if (bus.routeid) {
                mapCounts.set(bus.routeid, (mapCounts.get(bus.routeid) ?? 0) + 1);
            }
        }
        return mapCounts;
    }, [runningBuses]);

    // ESC key close listener
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (isDesktop) {
                    setSelectedStop(null);
                    setSelectedStopId(null);
                    return;
                }
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose, isDesktop]);

    // Live elapsed time hook
    const timeAgo = useElapsedTimeAgo(lastUpdated, isOpen);

    // Route Sub info
    const matchedSchedule = useMemo(() => {
        return scheduleRoutes.find((r) => r.routeNo === selectedRoute);
    }, [scheduleRoutes, selectedRoute]);

    const routeInterval = matchedSchedule?.interval;
    const routeSubInfo = useMemo(() => {
        const routePath = `${meta.origin} → ${meta.destination}`;
        return routeInterval ? `${routePath} · ${routeInterval}` : routePath;
    }, [meta.origin, meta.destination, routeInterval]);

    // Stop Search & Filter Hook
    const {
        directionFilter,
        setDirectionFilter,
        stopSearchQuery,
        setStopSearchQuery,
        hasDirections,
        favoriteStopsCountInRoute,
        filteredStops,
    } = useStopSearchFilter({currentStops, isFavoriteStop});

    // Bus Stop Matcher Hook
    const {busesByStopKey} = useBusStopMatcher({
        runningBuses,
        currentStops,
        effectiveVariations,
        currentVariant,
        getDirection,
    });

    // Keep the route timeline aligned & scrolled to the stop nearest to the current map center
    const syncNearestStopToMapCenter = useCallback(() => {
        if (!map || !isOpen || stopSearchQuery.trim().length > 0) return;
        if (suppressNextMapSyncRef.current) {
            suppressNextMapSyncRef.current = false;
            return;
        }

        const stopsPool = filteredStops.length > 0 ? filteredStops : currentStops;
        if (stopsPool.length === 0) return;

        const center = map.getCenter();
        let nearestStop: RouteVariationStop | null = null;
        let nearestDistance = Infinity;

        for (const stop of stopsPool) {
            if (!stop.gpslati || !stop.gpslong) continue;
            const distance = getHaversineDistance(center.lat, center.lng, stop.gpslati, stop.gpslong);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestStop = stop;
            }
        }

        if (!nearestStop) return;

        setSelectedStopId(nearestStop.nodeid);
        const stopKey = `${nearestStop.nodeid}-${nearestStop.nodeord ?? ""}`;
        requestAnimationFrame(() => {
            if (!listRef.current) return;
            const targetEl = listRef.current.querySelector(
                `[data-stop-key="${CSS.escape(stopKey)}"]`
            );
            if (targetEl) {
                targetEl.scrollIntoView({behavior: "smooth", block: "center"});
            }
        });
    }, [map, isOpen, stopSearchQuery, filteredStops, currentStops]);

    useEffect(() => {
        if (!isOpen || !map) return;

        map.on("moveend", syncNearestStopToMapCenter);
        return () => {
            map.off("moveend", syncNearestStopToMapCenter);
        };
    }, [isOpen, map, syncNearestStopToMapCenter]);

    // Auto-scroll on initial load to first running bus
    useEffect(() => {
        if (!isOpen) {
            hasAutoScrolledRef.current = null;
            return;
        }

        if (hasAutoScrolledRef.current === selectedRoute) return;
        if (!listRef.current || currentStops.length === 0) return;

        const timer = setTimeout(() => {
            if (!listRef.current) return;
            const targetEl =
                listRef.current.querySelector('[data-has-bus="true"]') ||
                listRef.current.querySelector('[data-selected-stop="true"]');

            if (targetEl) {
                targetEl.scrollIntoView({behavior: "smooth", block: "center"});
                hasAutoScrolledRef.current = selectedRoute;
            }
        }, 150);

        return () => clearTimeout(timer);
    }, [isOpen, selectedRoute, currentStops.length, busesByStopKey.size]);

    // Interaction handlers
    const handleStopClick = useCallback(
        (stop: RouteVariationStop) => {
            setSelectedStopId(stop.nodeid);
            setSelectedStop(stop);

            if (map && stop.gpslong && stop.gpslati) {
                suppressNextMapSyncRef.current = true;
                map.flyTo({
                    center: [stop.gpslong, stop.gpslati],
                    zoom: Math.max(map.getZoom(), 16),
                    duration: 500,
                });
            }

            if (!isDesktop) {
                onClose();
            }
            window.dispatchEvent(new CustomEvent("wbus:focus-stop", {detail: stop}));
        },
        [isDesktop, map, onClose]
    );

    const handleBusBadgeClick = useCallback(
        (e: React.MouseEvent, lat: number, lng: number) => {
            e.stopPropagation();
            suppressNextMapSyncRef.current = true;
            onBusClick(lat, lng);
            if (!isDesktop) {
                onClose();
            }
        },
        [isDesktop, onBusClick, onClose]
    );

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        if (onReconnect) onReconnect();
        setTimeout(() => setIsRefreshing(false), 800);
    }, [onReconnect]);

    // Running buses quick-jump list derived from currently visible stops
    const matchedBusesForJump = useMemo(() => {
        const items: { stopKey: string; stop: RouteVariationStop; plateDigits: string; bus: BusItem }[] = [];
        for (const stop of filteredStops) {
            const stopKey = `${stop.nodeid}-${stop.nodeord ?? ""}`;
            const busesHere = busesByStopKey.get(stopKey);
            if (!busesHere || busesHere.length === 0) continue;
            for (const bus of busesHere) {
                const plateDigits =
                    bus.vehicleno.replace(/[^0-9]/g, "").slice(-4) || bus.vehicleno.slice(-4);
                items.push({stopKey, stop, plateDigits, bus});
            }
        }
        return items;
    }, [filteredStops, busesByStopKey]);

    const handleJumpToBusStop = useCallback((stopKey: string, stop: RouteVariationStop) => {
        triggerHaptic("selection");
        setSelectedStopId(stop.nodeid);
        requestAnimationFrame(() => {
            if (!listRef.current) return;
            const targetEl = listRef.current.querySelector(
                `[data-stop-key="${CSS.escape(stopKey)}"]`
            );
            if (targetEl) {
                targetEl.scrollIntoView({behavior: "smooth", block: "center"});
            }
        });
    }, []);

    // Mobile swipe-down-to-dismiss handlers on grab handle & header
    const handleSheetTouchStart = useCallback(
        (e: React.TouchEvent) => {
            if (isDesktop || e.touches.length !== 1) return;
            dragStartRef.current = {
                y: e.touches[0].clientY,
                time: Date.now(),
            };
            setIsDraggingSheet(true);
        },
        [isDesktop]
    );

    const handleSheetTouchMove = useCallback(
        (e: React.TouchEvent) => {
            if (isDesktop || !dragStartRef.current || e.touches.length !== 1) return;
            const deltaY = e.touches[0].clientY - dragStartRef.current.y;
            if (deltaY > 0) {
                setDragOffsetY(deltaY);
            } else {
                setDragOffsetY(0);
            }
        },
        [isDesktop]
    );

    const handleSheetTouchEnd = useCallback(() => {
        if (isDesktop || !dragStartRef.current) return;
        const elapsed = Math.max(1, Date.now() - dragStartRef.current.time);
        const velocity = dragOffsetY / elapsed;
        dragStartRef.current = null;
        setIsDraggingSheet(false);

        if (dragOffsetY > 95 || (velocity > 0.45 && dragOffsetY > 32)) {
            triggerHaptic("light");
            setDragOffsetY(0);
            onClose();
        } else {
            setDragOffsetY(0);
        }
    }, [isDesktop, dragOffsetY, onClose]);

    // Paired opposite stop derivation
    const pairedOppositeStop = useMemo(() => {
        if (!selectedStop || currentStops.length === 0) return null;
        return findPairedOppositeStop(selectedStop, currentStops);
    }, [selectedStop, currentStops]);

    const isSelectedStopRouteStop = useMemo(() => {
        if (!selectedStop || currentStops.length === 0) return false;
        return currentStops.some((s) => s.nodeid === selectedStop.nodeid);
    }, [selectedStop, currentStops]);

    if (!isOpen && !isDesktop) return null;

    const hasBottomSplit = isDesktop && Boolean(selectedStop);

    return (
        <aside
            aria-label="실시간 버스 노선 및 정류장 목록"
            style={
                !isDesktop && dragOffsetY > 0
                    ? {transform: `translateY(${dragOffsetY}px)`, animation: "none"}
                    : undefined
            }
            className={`${
                isDraggingSheet ? "transition-none" : "transition-all duration-300 ease-out"
            } ${
                isDesktop
                    ? "hidden lg:flex z-40 fixed top-[72px] bottom-6 left-4 w-[380px] lg:w-[420px] max-h-[calc(100vh-96px)] bg-white/95 dark:bg-[#11131a]/95 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex-col"
                    : "fixed inset-x-0 bottom-0 z-[60] max-h-[82dvh] h-[82dvh] bg-white dark:bg-[#11131a] rounded-t-[24px] shadow-[0_-12px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_-12px_40px_rgba(0,0,0,0.7)] flex flex-col border-t border-slate-200/70 dark:border-white/10 animate-slideUp"
            }`}
        >
            {/* Mobile Bottom Sheet Grab Handle + Swipeable Header Area */}
            <div
                onTouchStart={handleSheetTouchStart}
                onTouchMove={handleSheetTouchMove}
                onTouchEnd={handleSheetTouchEnd}
                className="touch-none lg:touch-auto shrink-0"
            >
                <div className="flex lg:hidden justify-center pt-2 pb-0.5">
                    <div className="w-9 h-1 bg-slate-300/90 dark:bg-white/20 rounded-full"/>
                </div>

                {/* 1. Header */}
                <BusDrawerHeader
                    selectedRoute={selectedRoute}
                    routeSubInfo={routeSubInfo}
                    runningBusCount={runningBuses.length}
                    isConnecting={isConnecting}
                    timeAgo={timeAgo}
                    isRefreshing={isRefreshing}
                    hasBottomSplit={hasBottomSplit}
                    metaThemeMainColor={meta?.colorTheme?.main}
                    metaThemeBg={meta?.colorTheme?.bg}
                    metaThemeText={meta?.colorTheme?.text}
                    metaThemeShadow={meta?.colorTheme?.shadow}
                    onRefresh={handleRefresh}
                    onClose={onClose}
                />
            </div>

            {/* Upper Section: Route Overview & Stops Timeline */}
            <div
                className={`w-full flex flex-col overflow-hidden transition-all duration-300 ${
                    hasBottomSplit
                        ? isSplitCollapsed
                            ? "flex-1 h-[calc(100%-56px)]"
                            : "flex-[52] h-[52%]"
                        : "flex-1 min-h-0"
                }`}
            >
                {/* 1.5 Variation Tabs & 2. Direction Filter / Search */}
                <BusDrawerFilterBar
                    effectiveVariations={effectiveVariations}
                    currentVariant={currentVariant}
                    busesPerVariation={busesPerVariation}
                    onSelectVariant={setSelectedVariantId}
                    hasDirections={hasDirections}
                    directionFilter={directionFilter}
                    onDirectionFilterChange={setDirectionFilter}
                    favoriteStopsCountInRoute={favoriteStopsCountInRoute}
                    stopCount={currentStops.length}
                    stopSearchQuery={stopSearchQuery}
                    onSearchQueryChange={setStopSearchQuery}
                    turningStop={turningStop}
                    metaThemeMainColor={meta?.colorTheme?.main}
                    metaThemeBadgeBg={meta?.colorTheme?.badgeBg}
                    metaThemeBg={meta?.colorTheme?.bg}
                    metaThemeText={meta?.colorTheme?.text}
                    metaThemeBorder={meta?.colorTheme?.border}
                />

                {/* 2.5 Live Running Buses Quick-Jump Strip */}
                {matchedBusesForJump.length > 0 && (
                    <div
                        className="flex items-center gap-1.5 px-4 pb-2.5 overflow-x-auto custom-scrollbar-hidden shrink-0">
                        <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0 mr-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"/>
                            운행중
                        </span>
                        {matchedBusesForJump.map(({stopKey, stop, plateDigits, bus}) => (
                            <button
                                key={`${bus.vehicleno}-${stopKey}`}
                                type="button"
                                onClick={() => handleJumpToBusStop(stopKey, stop)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer whitespace-nowrap active:scale-95 shrink-0 ${
                                    meta?.colorTheme?.badgeBg || "bg-blue-500/10 dark:bg-blue-500/20"
                                } ${
                                    meta?.colorTheme?.text || "text-blue-700 dark:text-blue-300"
                                } ${
                                    meta?.colorTheme?.border || "border-blue-500/25"
                                }`}
                                title={`${bus.vehicleno} (${stop.nodenm}) 위치로 스크롤`}
                            >
                                <Bus className="w-3 h-3 shrink-0"/>
                                <span className="font-mono font-black">{plateDigits}</span>
                                <span className="opacity-75 max-w-[90px] truncate">· {stop.nodenm}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* 3. Bus Stop Timeline List Body */}
                <div
                    ref={listRef}
                    className="flex-1 overflow-y-auto custom-scrollbar relative min-h-0 border-t border-slate-100 dark:border-white/[0.07] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] lg:pb-3"
                >
                    {currentStops.length === 0 ? (
                        <div
                            className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500 gap-3">
                            <Loader2
                                className={`w-6 h-6 animate-spin ${meta?.colorTheme?.text || "text-blue-600 dark:text-blue-400"}`}
                            />
                            <span className="text-xs font-semibold">정류장 목록을 불러오고 있습니다...</span>
                        </div>
                    ) : filteredStops.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs">
                            {stopSearchQuery
                                ? `"${stopSearchQuery}" 검색 결과가 없습니다.`
                                : "해당 방향의 정류장 정보가 없습니다."}
                        </div>
                    ) : (
                        filteredStops.map((stop, index) => {
                            const stopKey = `${stop.nodeid}-${stop.nodeord ?? ""}`;
                            const busesHere = busesByStopKey.get(stopKey) || [];
                            const isFirst = index === 0;
                            const isLast = index === filteredStops.length - 1;
                            const isSelected = selectedStopId === stop.nodeid;
                            const isTurning = Boolean(
                                turningStop &&
                                turningStop.nodeid === stop.nodeid &&
                                turningStop.nodeord === stop.nodeord
                            );
                            const isFav = isFavoriteStop(stop.nodeid);

                            return (
                                <BusDrawerStopItem
                                    key={stopKey}
                                    stop={stop}
                                    isFirst={isFirst}
                                    isLast={isLast}
                                    isSelected={isSelected}
                                    isTurningStop={isTurning}
                                    isFavStop={isFav}
                                    busesHere={busesHere}
                                    metaThemeMainColor={meta?.colorTheme?.main}
                                    metaThemeBadgeBg={meta?.colorTheme?.badgeBg}
                                    metaThemeBg={meta?.colorTheme?.bg}
                                    metaThemeText={meta?.colorTheme?.text}
                                    metaThemeShadow={meta?.colorTheme?.shadow}
                                    onStopClick={handleStopClick}
                                    onBusBadgeClick={handleBusBadgeClick}
                                    onToggleFavorite={toggleFavoriteStop}
                                />
                            );
                        })
                    )}
                </div>
            </div>

            {/* Lower Section: Context-Aware Split View (Selected Stop Details on Desktop) */}
            {hasBottomSplit && selectedStop && (
                <DesktopSplitStopView
                    selectedStop={selectedStop}
                    isSelectedStopRouteStop={isSelectedStopRouteStop}
                    pairedOppositeStop={pairedOppositeStop}
                    isFavoriteStop={isFavoriteStop}
                    toggleFavoriteStop={toggleFavoriteStop}
                    isCollapsed={isSplitCollapsed}
                    onToggleCollapse={() => setIsSplitCollapsed((prev) => !prev)}
                    onClose={() => {
                        setSelectedStop(null);
                        setSelectedStopId(null);
                    }}
                    onSelectStop={(oppStop) => {
                        setSelectedStop(oppStop);
                        setSelectedStopId(oppStop.nodeid);
                        window.dispatchEvent(new CustomEvent("wbus:focus-stop", {detail: oppStop}));
                    }}
                    metaThemeMainColor={meta?.colorTheme?.main}
                    metaThemeTextColor={meta?.colorTheme?.text}
                    cityName={currentCity.name.split("/")[0]}
                    selectedRoute={selectedRoute}
                    currentCityCode={currentCity.code}
                    onRouteChange={onRouteChange}
                    map={map}
                />
            )}
        </aside>
    );
};
