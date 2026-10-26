"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Bus, Loader2, LocateFixed, MapPin, MapPinned, RefreshCw, RotateCw, Search, Star, X} from "lucide-react";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {type RouteVariationStop, useRouteVariations} from "@entities/route";
import type {DirectionCode, RouteVariation} from "@entities/route/types";
import {getRouteMeta} from "@entities/route/routeMetadata";
import {useSchedule} from "@entities/schedule/hooks";
import {useCityContext} from "@entities/city";
import {useBusStop, useFavoriteStops} from "@entities/station/hooks";
import {BusStopPopup} from "@entities/station";
import RouteScheduleModal from "@features/map-view/RouteScheduleModal";
import type {DayMode} from "@shared/types/navigation";
import type {BusItem} from "@entities/bus/types";
import type {BusStop} from "@entities/station/types";

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
    dayMode?: DayMode;
    isTodayWeekendOrHoliday?: boolean;
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export const BusListDrawer: React.FC<BusListDrawerProps> = ({
                                                                isOpen,
                                                                onClose,
                                                                selectedRoute,
                                                                runningBuses,
                                                                isConnecting, getDirection,
                                                                onBusClick,
                                                                lastUpdated,
                                                                onReconnect,
                                                                onRouteChange,
                                                                dayMode = "AUTO",
                                                                isTodayWeekendOrHoliday,
                                                            }) => {
    const {map} = useAppMapContext();
    const {currentCity} = useCityContext();
    const isWonju = currentCity.code === "32020";

    const {variations} = useRouteVariations(selectedRoute, isOpen, currentCity.code);
    const nationwideStops = useBusStop(isOpen && !isWonju ? selectedRoute : "", currentCity.code);
    const {routes: scheduleRoutes} = useSchedule(isOpen && isWonju);
    const {isFavoriteStop, toggleFavoriteStop} = useFavoriteStops(currentCity.code);

    // Desktop view detection (>= 768px: left floating window with 2-column split view support)
    const [isDesktop, setIsDesktop] = useState(() => {
        if (typeof window !== "undefined") {
            return window.innerWidth >= 768;
        }
        return false;
    });

    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth >= 768);
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
    const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const [activeBottomTab, setActiveBottomTab] = useState<"stop" | "schedule">("stop");
    const [directionFilter, setDirectionFilter] = useState<"all" | "up" | "down" | "fav">("all");
    const [stopSearchQuery, setStopSearchQuery] = useState("");
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [timeAgo, setTimeAgo] = useState("0초 전");
    const listRef = useRef<HTMLDivElement>(null);
    const hasAutoScrolledRef = useRef<string | null>(null);

    // Listen to external focus stop event (from map marker click or search)
    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleFocusStop = (e: Event) => {
            const detail = (e as CustomEvent<BusStop>).detail;
            if (detail && detail.nodeid) {
                setSelectedStop(detail);
                setSelectedStopId(detail.nodeid);
                setActiveBottomTab("stop");
            }
        };
        window.addEventListener("wbus:focus-stop", handleFocusStop);
        return () => window.removeEventListener("wbus:focus-stop", handleFocusStop);
    }, []);

    // Listen to external open schedule event (from timetable pin, schedule button, or nav)
    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleOpenSchedule = () => {
            setIsScheduleOpen(true);
            setActiveBottomTab("schedule");
        };
        window.addEventListener("wbus:open-schedule", handleOpenSchedule);
        return () => window.removeEventListener("wbus:open-schedule", handleOpenSchedule);
    }, []);

    // Deselect stop or close split on desktop when empty map area is clicked or deselected
    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleDeselectStop = () => {
            if (window.innerWidth >= 768) {
                setSelectedStop(null);
                setSelectedStopId(null);
                setIsScheduleOpen(false);
            }
        };
        window.addEventListener("wbus:close-popups", handleDeselectStop);
        window.addEventListener("wbus:deselect-stop", handleDeselectStop);
        return () => {
            window.removeEventListener("wbus:close-popups", handleDeselectStop);
            window.removeEventListener("wbus:deselect-stop", handleDeselectStop);
        };
    }, []);

    const [prevRoute, setPrevRoute] = useState(selectedRoute);
    if (selectedRoute !== prevRoute) {
        setPrevRoute(selectedRoute);
        setStopSearchQuery("");
        setDirectionFilter("all");
        setSelectedStop(null);
        setSelectedStopId(null);
        setIsScheduleOpen(false);
    }

    // Route Metadata & Schedule info
    const meta = useMemo(() => getRouteMeta(selectedRoute, currentCity.code), [selectedRoute, currentCity.code]);

    // Construct synthetic single variation for nationwide cities when variations are not yet resolved
    const nationwideVariations = useMemo<RouteVariation[]>(() => {
        if (isWonju || !nationwideStops || nationwideStops.length === 0) return [];
        return [
            {
                routeId: selectedRoute,
                label: `${selectedRoute}번`,
                stops: nationwideStops as RouteVariationStop[],
                stopCount: nationwideStops.length,
                turningStop: null,
            },
        ];
    }, [isWonju, nationwideStops, selectedRoute]);

    const effectiveVariations = variations.length > 0 ? variations : nationwideVariations;

    // Active variant object: keep user selection if valid, otherwise prefer variant with running buses or fallback to first
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
        const map = new Map<string, number>();
        for (const bus of runningBuses) {
            if (bus.routeid) {
                map.set(bus.routeid, (map.get(bus.routeid) ?? 0) + 1);
            }
        }
        return map;
    }, [runningBuses]);

    // ESC key close listener
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (isDesktop) {
                    // On desktop, drawer is permanent; Escape closes the split view if open
                    setSelectedStop(null);
                    setSelectedStopId(null);
                    setIsScheduleOpen(false);
                    return;
                }
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose, isDesktop]);

    // Live elapsed time since last API update
    useEffect(() => {
        if (!isOpen) return;
        const update = () => {
            if (!lastUpdated) {
                setTimeAgo("방금 전");
                return;
            }
            const diffSec = Math.max(0, Math.floor((Date.now() - lastUpdated) / 1000));
            if (diffSec < 60) {
                setTimeAgo(`${diffSec}초 전`);
            } else {
                const min = Math.floor(diffSec / 60);
                setTimeAgo(`${min}분 전`);
            }
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [isOpen, lastUpdated]);

    // Route Schedule info
    const matchedSchedule = useMemo(() => {
        return scheduleRoutes.find((r) => r.routeNo === selectedRoute);
    }, [scheduleRoutes, selectedRoute]);

    const routeInterval = matchedSchedule?.interval;
    const routeSubInfo = useMemo(() => {
        const routePath = `${meta.origin} → ${meta.destination}`;
        return routeInterval ? `${routePath} · ${routeInterval}` : routePath;
    }, [meta.origin, meta.destination, routeInterval]);

    // Determine if current variant has up/down separation
    const hasDirections = useMemo(() => {
        const uds = new Set(currentStops
            .map((s) => s.updowncd)
            .filter((u): u is number => u !== undefined && u !== null)
        );
        return uds.size > 1;
    }, [currentStops]);

    const favoriteStopsCountInRoute = useMemo(() => {
        return currentStops.filter((s) => isFavoriteStop(s.nodeid)).length;
    }, [currentStops, isFavoriteStop]);

    // Filtered stops by direction, favorite, & search query
    const filteredStops = useMemo(() => {
        let list = currentStops;
        if (directionFilter === "fav") {
            list = list.filter((s) => isFavoriteStop(s.nodeid));
        } else if (directionFilter !== "all" && hasDirections) {
            const targetUd = directionFilter === "up" ? 0 : 1;
            list = list.filter((s) => s.updowncd === targetUd);
        }
        const q = stopSearchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter(
                (s) =>
                    s.nodenm.toLowerCase().includes(q) ||
                    String(s.nodeno ?? "").toLowerCase().includes(q)
            );
        }
        return list;
    }, [currentStops, directionFilter, hasDirections, stopSearchQuery, isFavoriteStop]);

    // Match live running buses to current variation's stops
    const busesByStopKey = useMemo(() => {
        const map = new Map<string, BusItem[]>();
        if (!runningBuses || runningBuses.length === 0 || currentStops.length === 0) {
            return map;
        }

        for (const bus of runningBuses) {
            // When multiple variations exist, ignore buses that explicitly belong to a different variation
            if (effectiveVariations.length > 1 && bus.routeid && currentVariant && bus.routeid !== currentVariant.routeId) {
                continue;
            }

            // 1. Exact match: both nodeid and nodeord match
            let matched = currentStops.find(
                (s) => bus.nodeid && s.nodeid === bus.nodeid &&
                    bus.nodeord !== undefined && s.nodeord === bus.nodeord
            );

            // 2. Match by nodeid
            if (!matched && bus.nodeid) {
                const candidates = currentStops.filter((s) => s.nodeid === bus.nodeid);
                if (candidates.length === 1) {
                    matched = candidates[0];
                } else if (candidates.length > 1) {
                    // Disambiguate using getDirection or nodeord proximity
                    const dir = getDirection ? getDirection(bus.nodeid, bus.nodeord ?? 0, bus.routeid) : null;
                    if (dir !== null && dir !== undefined) {
                        const targetUd = dir === 1 ? 1 : 0;
                        matched = candidates.find((c) => c.updowncd === targetUd) || candidates[0];
                    } else if (bus.nodeord !== undefined) {
                        matched = candidates.reduce((prev, curr) => Math.abs(curr.nodeord - (bus.nodeord ?? 0)) < Math.abs(prev.nodeord - (bus.nodeord ?? 0)) ? curr : prev);
                    } else {
                        matched = candidates[0];
                    }
                }
            }

            // 3. Match by nodeord
            if (!matched && bus.nodeord !== undefined) {
                matched = currentStops.find((s) => s.nodeord === bus.nodeord);
            }

            // 4. Match by stop name
            if (!matched && bus.nodenm) {
                const candidates = currentStops.filter((s) => s.nodenm === bus.nodenm);
                if (candidates.length > 0) {
                    matched = candidates[0];
                }
            }

            // 5. Fallback: Proximity search within 500m
            if (!matched && bus.gpslati && bus.gpslong) {
                let minDistance = 0.5; // 500m
                let closest: RouteVariationStop | null = null;
                for (const s of currentStops) {
                    const d = getDistanceKm(bus.gpslati, bus.gpslong, s.gpslati, s.gpslong);
                    if (d < minDistance) {
                        minDistance = d;
                        closest = s;
                    }
                }
                if (closest) matched = closest;
            }

            if (matched) {
                const key = `${matched.nodeid}-${matched.nodeord ?? ""}`;
                const existing = map.get(key) || [];
                existing.push(bus);
                map.set(key, existing);
            }
        }

        return map;
    }, [runningBuses, currentStops, effectiveVariations.length, currentVariant, getDirection]);

    // Auto-scroll timeline to selected stop when selectedStopId changes
    useEffect(() => {
        if (!selectedStopId || !listRef.current) return;
        const timer = setTimeout(() => {
            if (!listRef.current) return;
            const selectedEl = listRef.current.querySelector<HTMLElement>('[data-selected-stop="true"]');
            if (selectedEl) {
                selectedEl.scrollIntoView({behavior: "smooth", block: "nearest"});
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [selectedStopId]);

    // Scroll to the first active running bus in the timeline
    const scrollToActiveBus = useCallback(() => {
        if (!listRef.current) return;
        const busRow = listRef.current.querySelector<HTMLElement>('[data-has-bus="true"]');
        if (busRow) {
            busRow.scrollIntoView({behavior: "smooth", block: "center"});
        }
    }, []);

    // Auto-scroll to first active bus once when drawer opens & stops are ready
    useEffect(() => {
        if (!isOpen || currentStops.length === 0 || busesByStopKey.size === 0) return;
        const scrollKey = `${currentCity.code}:${selectedRoute}:${currentVariant?.routeId ?? ""}`;
        if (hasAutoScrolledRef.current === scrollKey) return;
        hasAutoScrolledRef.current = scrollKey;

        const timer = setTimeout(() => {
            scrollToActiveBus();
        }, 120);
        return () => clearTimeout(timer);
    }, [isOpen, currentStops.length, busesByStopKey.size, currentCity.code, selectedRoute, currentVariant?.routeId, scrollToActiveBus]);

    // Trigger manual telemetry refresh
    const handleRefresh = useCallback(() => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        onReconnect?.();
        setTimeout(() => setIsRefreshing(false), 800);
    }, [isRefreshing, onReconnect]);

    const isSelectedStopRouteStop = useMemo(() => {
        if (!selectedStop) return false;
        return currentStops.some((s) => s.nodeid === selectedStop.nodeid);
    }, [selectedStop, currentStops]);

    // Station selection: on desktop, expands context-aware split pane; on mobile, flies to stop and opens mobile popup
    const handleStopClick = useCallback(
        (stop: BusStop) => {
            const desktopView = typeof window !== "undefined" && window.innerWidth >= 768;
            setSelectedStopId(stop.nodeid);

            if (desktopView) {
                setSelectedStop(stop);
                setActiveBottomTab("stop");
                if (map && stop.gpslong && stop.gpslati) {
                    map.flyTo({
                        center: [stop.gpslong, stop.gpslati],
                        zoom: Math.max(map.getZoom(), 15.8),
                        padding: {
                            left: 420, // Offset map camera so marker is placed nicely beside the left window
                            right: 40,
                            top: 80,
                            bottom: 80,
                        },
                        duration: 800,
                    });
                }
                return;
            }

            if (map && stop.gpslong && stop.gpslati) {
                map.flyTo({
                    center: [stop.gpslong, stop.gpslati],
                    zoom: Math.max(map.getZoom(), 16.2),
                    duration: 950,
                });
            }
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("wbus:focus-stop", {detail: stop}));
                onClose();
            }
        },
        [map, onClose]
    );

    const handleBusBadgeClick = useCallback(
        (e: React.MouseEvent, lat: number, lng: number) => {
            e.stopPropagation();
            onBusClick(lat, lng);
            if (typeof window !== "undefined" && window.innerWidth < 768) {
                onClose();
            }
        },
        [onBusClick, onClose]
    );

    const hasBottomSplit = isDesktop && (Boolean(selectedStop) || isScheduleOpen);

    if (!isOpen) return null;

    return (
        <div
            className="flex flex-col backdrop-blur-2xl bg-white/95 dark:bg-[#0c100f]/95 border border-slate-200/80 dark:border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.18)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7)] rounded-[28px] overflow-hidden transition-all duration-300 animate-fadeIn text-slate-900 dark:text-white select-none pointer-events-auto max-md:fixed max-md:bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] max-md:left-1/2 max-md:-translate-x-1/2 max-md:z-50 max-md:w-[94vw] max-md:max-w-md max-md:max-h-[70vh] md:fixed md:left-5 md:top-20 md:bottom-24 md:z-40 md:h-auto md:max-h-[calc(100vh-11rem)] md:w-[380px] lg:w-[400px]"
            role="dialog"
            aria-label={`${selectedRoute} 버스 노선 운행 목록`}
        >
            {/* Upper Section: Route Details, Variations, Filter & Stop Timeline */}
            <div
                className={`w-full flex flex-col overflow-hidden transition-all duration-300 ${
                    hasBottomSplit
                        ? "h-[50%] min-h-[220px] shrink-0"
                        : "flex-1 h-full min-h-0"
                }`}
            >
                {/* 1. Header Section */}
            <div
                className={`flex items-start justify-between border-b border-slate-200/80 dark:border-white/10 shrink-0 bg-slate-50/50 dark:bg-white/[0.02] transition-all duration-200 ${
                    hasBottomSplit ? "px-4 pt-3.5 pb-2.5" : "px-5 pt-5 pb-4"
                }`}
            >
                <div className="flex items-start gap-3 min-w-0">
                    {/* Blue Accent Vertical Bar */}
                    <div className="w-1.5 h-11 rounded-full bg-blue-600 dark:bg-blue-500 shrink-0 mt-0.5"/>

                    <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 tracking-tight">
                            버스 노선
                        </span>
                        <h2
                            className={`font-black text-slate-900 dark:text-white tracking-tight leading-none mt-0.5 transition-all duration-200 ${
                                hasBottomSplit ? "text-2xl" : "text-3xl"
                            }`}
                        >
                            {selectedRoute}
                        </h2>
                        <p
                            className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[210px] sm:max-w-[260px] mt-1.5"
                            title={routeSubInfo}
                        >
                            {routeSubInfo}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-xs flex-wrap">
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                                {isConnecting
                                    ? "실시간 연결 중..."
                                    : `실시간 ${runningBuses.length}대 운행중`}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500 font-medium">{timeAgo}</span>
                            {busesByStopKey.size > 0 && (
                                <button
                                    type="button"
                                    onClick={scrollToActiveBus}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-300 text-[10px] font-extrabold border border-blue-500/25 transition cursor-pointer active:scale-95"
                                    title="현재 운행 중인 버스 정류장 위치로 스크롤"
                                >
                                    <LocateFixed className="w-2.5 h-2.5"/>
                                    <span>버스 위치로</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Top Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="w-8 h-8 rounded-full border border-slate-200/80 dark:border-white/15 bg-slate-100 hover:bg-slate-200/80 dark:bg-white/5 dark:hover:bg-white/15 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer active:scale-90"
                        title="실시간 위치 새로고침"
                        aria-label="실시간 위치 새로고침"
                    >
                        <RefreshCw
                            className={`w-4 h-4 ${isRefreshing ? "animate-spin text-blue-600 dark:text-blue-400" : ""}`}
                        />
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full border border-slate-200/80 dark:border-white/15 bg-slate-100 hover:bg-slate-200/80 dark:bg-white/5 dark:hover:bg-white/15 flex md:hidden items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer active:scale-90"
                        title="닫기"
                        aria-label="닫기"
                    >
                        <X className="w-4 h-4"/>
                    </button>
                </div>
            </div>

            {/* 1.5 Variation Selector (if route has multiple variations) */}
            {effectiveVariations.length > 1 && (<div
                className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-200/80 dark:border-white/10 bg-slate-100/60 dark:bg-white/[0.02] text-xs shrink-0 overflow-x-auto custom-scrollbar-hidden"
                role="tablist"
                aria-label="노선 종류 선택"
            >
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 mr-1">
                        노선:
                    </span>
                {effectiveVariations.map((variant) => {
                    const isSelectedVariant = variant.routeId === currentVariant?.routeId;
                    const busCountOnVariant = busesPerVariation.get(variant.routeId) ?? 0;

                    return (<button
                        key={variant.routeId}
                        type="button"
                        role="tab"
                        aria-selected={isSelectedVariant}
                        onClick={() => {
                            setSelectedVariantId(variant.routeId);
                            setDirectionFilter("all");
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${isSelectedVariant ? "bg-blue-500/15 dark:bg-blue-500/25 text-blue-700 dark:text-blue-300 border border-blue-500/30 dark:border-blue-500/50 shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5 border border-slate-200/60 dark:border-white/5"}`}
                    >
                        <span>{variant.label}</span>
                        {busCountOnVariant > 0 && (<span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-black leading-none ${isSelectedVariant ? "bg-blue-600 text-white dark:bg-blue-400 dark:text-black" : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"}`}
                        >
                                        {busCountOnVariant}대
                                    </span>)}
                    </button>);
                })}
            </div>)}

            {/* 2. Direction Filter & Stop Quick Search Bar */}
            <div
                className="flex flex-col gap-2 px-4 py-2.5 border-b border-slate-200/80 dark:border-white/5 bg-slate-100/40 dark:bg-black/20 shrink-0">
                {(hasDirections || favoriteStopsCountInRoute > 0) && (
                    <div className="flex items-center gap-1.5 text-xs overflow-x-auto custom-scrollbar-hidden">
                        <button
                            type="button"
                            onClick={() => setDirectionFilter("all")}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                directionFilter === "all" ? "bg-blue-500/15 dark:bg-blue-500/25 text-blue-700 dark:text-blue-300 border border-blue-500/30 dark:border-blue-500/50 shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5"
                            }`}
                        >
                            전체 ({currentStops.length})
                        </button>
                        {favoriteStopsCountInRoute > 0 && (
                            <button
                                type="button"
                                onClick={() => setDirectionFilter("fav")}
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                    directionFilter === "fav"
                                        ? "bg-amber-500/20 dark:bg-amber-500/30 text-amber-800 dark:text-amber-300 border border-amber-500/40 shadow-xs"
                                        : "text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                                }`}
                            >
                                <Star className="w-3 h-3 fill-amber-500 text-amber-500"/>
                                <span>즐겨찾기 ({favoriteStopsCountInRoute})</span>
                            </button>
                        )}
                        {hasDirections && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setDirectionFilter("up")}
                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                        directionFilter === "up" ? "bg-blue-500/15 dark:bg-blue-500/25 text-blue-700 dark:text-blue-300 border border-blue-500/30 dark:border-blue-500/50 shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5"
                                    }`}
                                >
                                    {meta.destination || "종점"} 방면 (상행)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDirectionFilter("down")}
                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                        directionFilter === "down" ? "bg-blue-500/15 dark:bg-blue-500/25 text-blue-700 dark:text-blue-300 border border-blue-500/30 dark:border-blue-500/50 shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5"
                                    }`}
                                >
                                    {meta.origin || "기점"} 방면 (하행)
                                </button>
                            </>
                        )}
                    </div>
                )}

                {currentStops.length > 5 && (
                    <div className="relative flex items-center">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none"/>
                        <input
                            type="text"
                            value={stopSearchQuery}
                            onChange={(e) => setStopSearchQuery(e.target.value)}
                            placeholder="정류장 이름 또는 번호 검색..."
                            aria-label="정류장 검색"
                            className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-white/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
                        />
                        {stopSearchQuery && (
                            <button
                                type="button"
                                onClick={() => setStopSearchQuery("")}
                                className="absolute right-2 p-0.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                                aria-label="검색어 지우기"
                            >
                                <X className="w-3.5 h-3.5"/>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* 3. Bus Stop Timeline List Body */}
            <div
                ref={listRef}
                className="flex-1 overflow-y-auto custom-scrollbar relative min-h-[220px]"
            >
                {currentStops.length === 0 ? (<div
                        className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500 gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400"/>
                        <span className="text-xs font-semibold">
                            정류장 목록을 불러오고 있습니다...
                        </span>
                    </div>
                ) : filteredStops.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs">
                        {stopSearchQuery ? `"${stopSearchQuery}" 검색 결과가 없습니다.` : "해당 방향의 정류장 정보가 없습니다."}
                    </div>
                ) : (
                    filteredStops.map((stop, index) => {
                        const stopKey = `${stop.nodeid}-${stop.nodeord ?? ""}`;
                        const busesHere = busesByStopKey.get(stopKey) || [];
                        const isFirst = index === 0;
                        const isLast = index === filteredStops.length - 1;
                        const isSelected = selectedStopId === stop.nodeid;
                        const isTurningStop = Boolean(turningStop && turningStop.nodeid === stop.nodeid && turningStop.nodeord === stop.nodeord);
                        const isFavStop = isFavoriteStop(stop.nodeid);

                        return (
                            <div
                                key={stopKey}
                                data-has-bus={busesHere.length > 0 ? "true" : undefined}
                                data-selected-stop={isSelected ? "true" : undefined}
                                className={`relative flex items-center min-h-[58px] py-3 transition-colors cursor-pointer group border-b border-slate-100 dark:border-white/5 ${
                                    isSelected ? isTurningStop ? "bg-amber-100/70 dark:bg-amber-950/30" : "bg-blue-50/80 dark:bg-blue-950/40" : isTurningStop ? "bg-amber-50/70 hover:bg-amber-100/60 dark:bg-amber-500/[0.06] dark:hover:bg-amber-500/[0.12]" : "hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                                }`}
                                onClick={() => handleStopClick(stop)}
                            >
                                {/* Left Selection/Turning Indicator Bar (zero layout shift - fixes line alignment issue!) */}
                                {isSelected ? (<div
                                    className={`absolute left-0 top-0 bottom-0 w-1 rounded-r z-20 pointer-events-none ${isTurningStop ? "bg-amber-500" : "bg-blue-600 dark:bg-blue-500"}`}
                                />) : isTurningStop ? (<div
                                    className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/70 rounded-r z-20 pointer-events-none"/>) : null}

                                {/* Vertical Timeline Connecting Track */}
                                <div
                                    className={`absolute left-[74px] w-[2px] pointer-events-none ${isTurningStop ? "bg-gradient-to-b from-blue-600/70 via-amber-500 to-blue-600/70 dark:from-blue-500/80 dark:via-amber-400 dark:to-blue-500/80" : "bg-blue-600/70 dark:bg-blue-500/80"} ${
                                        isFirst
                                            ? "top-1/2 bottom-0"
                                            : isLast
                                                ? "top-0 bottom-1/2"
                                                : "top-0 bottom-0"
                                    }`}
                                />

                                {/* Station Timeline Node (Donut Circle) */}
                                {isTurningStop ? (<div
                                    className="absolute left-[65px] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-[2.5px] border-amber-500 dark:border-amber-400 bg-amber-50 dark:bg-[#0c100f] z-10 shadow-[0_0_12px_rgba(245,158,11,0.35)] flex items-center justify-center pointer-events-none"
                                    title="회차지 정류장"
                                >
                                    <RotateCw
                                        className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 stroke-[2.5]"/>
                                </div>) : (<div
                                    className="absolute left-[68px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-[2.5px] border-blue-600 dark:border-blue-400 bg-white dark:bg-[#0c100f] z-10 shadow-xs pointer-events-none"
                                />)}

                                {/* Live Bus Markers if arriving/located at this station */}
                                {busesHere.length > 0 && (
                                    <div
                                        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1">
                                        {busesHere.map((bus) => {
                                            const plateDigits =
                                                bus.vehicleno.replace(/[^0-9]/g, "").slice(-4) ||
                                                bus.vehicleno.slice(-4);

                                            return (
                                                <button
                                                    key={`${bus.vehicleno}-${bus.nodeord}`}
                                                    type="button"
                                                    onClick={(e) => handleBusBadgeClick(e, bus.gpslati, bus.gpslong)}
                                                    className="flex items-center gap-1 group/bus cursor-pointer active:scale-95 transition-transform"
                                                    title={`${bus.vehicleno} 실시간 위치로 이동`}
                                                >
                                                    {/* Badge: Vehicle Number */}
                                                    <span
                                                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 dark:bg-[#142238] border border-slate-700 dark:border-blue-500/40 text-blue-200 dark:text-blue-300 tracking-tight whitespace-nowrap select-none shadow-xs">
                                                        {plateDigits}
                                                    </span>

                                                    {/* Blue Bus Icon Box */}
                                                    <div
                                                        className="w-6 h-6 rounded-md bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-600/25 shrink-0">
                                                        <Bus className="w-3.5 h-3.5 fill-current"/>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Station Name & Metadata */}
                                <div className="ml-[92px] flex-1 flex flex-col justify-center min-w-0 pr-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span
                                            className={`text-[14px] sm:text-[15px] font-bold truncate transition-colors ${isSelected ? isTurningStop ? "text-amber-800 dark:text-amber-300 font-black" : "text-blue-700 dark:text-blue-300 font-black" : isTurningStop ? "text-amber-900 dark:text-amber-200 font-extrabold group-hover:text-amber-950 dark:group-hover:text-amber-100" : "text-slate-800 dark:text-slate-100 group-hover:text-slate-950 dark:group-hover:text-white"}`}
                                        >
                                            {stop.nodenm}
                                        </span>
                                        {isTurningStop && (<span
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 shadow-xs shrink-0 select-none">
                                                <RotateCw className="w-2.5 h-2.5 stroke-[2.5]"/>
                                                회차지
                                            </span>)}
                                    </div>
                                    {stop.nodeno && (
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                            {stop.nodeno}
                                        </span>
                                    )}
                                </div>

                                {/* Stop Favorite Star Button */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleFavoriteStop({
                                            nodeid: stop.nodeid,
                                            nodenm: stop.nodenm,
                                            nodeno: stop.nodeno,
                                            gpslati: stop.gpslati,
                                            gpslong: stop.gpslong,
                                        });
                                    }}
                                    className={`mr-3 p-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                                        isFavStop
                                            ? "text-amber-500 hover:text-amber-600"
                                            : "text-slate-300 dark:text-slate-600 opacity-60 group-hover:opacity-100 hover:text-amber-500 dark:hover:text-amber-400"
                                    }`}
                                    title={isFavStop ? "정류장 즐겨찾기 해제" : "정류장 즐겨찾기 추가"}
                                    aria-label={isFavStop ? "정류장 즐겨찾기 해제" : "정류장 즐겨찾기 추가"}
                                >
                                    <Star className={`w-4 h-4 ${isFavStop ? "fill-amber-500" : ""}`}/>
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
            </div>

            {/* Lower Section: Context-Aware Split View (Stop Details or Route Timetable) */}
            {hasBottomSplit && (
                <div
                    className="w-full flex-1 min-h-[220px] max-h-[50%] border-t border-slate-200/80 dark:border-white/10 flex flex-col overflow-hidden bg-white dark:bg-[#11131a] animate-fadeIn select-none">
                    {/* If BOTH a stop is selected AND schedule is open, show quick segmented switch pill */}
                    {selectedStop && isScheduleOpen && (
                        <div
                            className="px-4 py-1.5 bg-slate-100/90 dark:bg-white/[0.04] border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between text-xs shrink-0">
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setActiveBottomTab("stop")}
                                    className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                        activeBottomTab === "stop"
                                            ? "bg-white dark:bg-[#1e2330] text-blue-600 dark:text-blue-400 shadow-xs"
                                            : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                                    }`}
                                >
                                    정류장 실시간 정보
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveBottomTab("schedule")}
                                    className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                        activeBottomTab === "schedule"
                                            ? "bg-white dark:bg-[#1e2330] text-blue-600 dark:text-blue-400 shadow-xs"
                                            : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                                    }`}
                                >
                                    노선 운행 시간표
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedStop(null);
                                    setSelectedStopId(null);
                                    setIsScheduleOpen(false);
                                }}
                                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
                                title="분할 닫기"
                            >
                                <X className="w-3.5 h-3.5"/>
                            </button>
                        </div>
                    )}

                    {/* Tab 1: Selected Stop Details */}
                    {selectedStop && (!isScheduleOpen || activeBottomTab === "stop") && (
                        <div className="w-full h-full flex flex-col overflow-hidden">
                            {/* Stop Header */}
                            <div
                                className="flex items-start justify-between px-4 py-3 border-b border-slate-200/80 dark:border-white/10 shrink-0 bg-slate-50/70 dark:bg-white/[0.03]">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div
                                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
                                        style={{
                                            backgroundColor: isSelectedStopRouteStop
                                                ? (meta?.colorTheme?.main || "#2563eb")
                                                : (isFavoriteStop(selectedStop.nodeid) ? "#f59e0b" : "#475569")
                                        }}
                                    >
                                        {isSelectedStopRouteStop ? (
                                            <MapPinned size={18} strokeWidth={2.5}/>
                                        ) : (
                                            <MapPin size={18} strokeWidth={2.5}/>
                                        )}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span
                                                className="px-1.5 py-0.2 rounded-md text-[9px] font-black text-white"
                                                style={{
                                                    backgroundColor: isSelectedStopRouteStop
                                                        ? (meta?.colorTheme?.main || "#2563eb")
                                                        : "#64748b"
                                                }}
                                            >
                                                {isSelectedStopRouteStop ? "현재 노선" : "주변 정류장"}
                                            </span>
                                            {isWonju && (
                                                <span
                                                    className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">
                                                    원주시
                                                </span>
                                            )}
                                        </div>
                                        <h3
                                            className="truncate text-lg font-black text-slate-900 dark:text-white mt-0.5 leading-tight"
                                            title={selectedStop.nodenm}
                                        >
                                            {selectedStop.nodenm}
                                        </h3>
                                        <div
                                            className="flex items-center gap-1.5 mt-1 text-slate-500 dark:text-slate-400 text-xs">
                                            <span
                                                className="text-[10px] font-bold uppercase tracking-widest text-slate-400">ID</span>
                                            <span
                                                className="font-mono font-bold text-[11px]">{selectedStop.nodeno || "미부여"}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons: Favorite, Schedule, Close Pane */}
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                    <button
                                        type="button"
                                        onClick={() => toggleFavoriteStop(selectedStop)}
                                        className={`p-1.5 rounded-full border transition cursor-pointer active:scale-90 ${
                                            isFavoriteStop(selectedStop.nodeid)
                                                ? "bg-amber-500/15 border-amber-500/40 text-amber-500"
                                                : "bg-slate-100 dark:bg-white/10 border-transparent text-slate-400 hover:text-amber-500"
                                        }`}
                                        title={isFavoriteStop(selectedStop.nodeid) ? "즐겨찾기 해제" : "즐겨찾기 등록"}
                                        aria-label="즐겨찾기"
                                    >
                                        <Star
                                            className={`w-3.5 h-3.5 ${isFavoriteStop(selectedStop.nodeid) ? "fill-amber-400" : ""}`}/>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedStop(null);
                                            setSelectedStopId(null);
                                        }}
                                        className="p-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/15 transition cursor-pointer active:scale-90"
                                        title="정류장 정보 닫기 (분할 해제)"
                                        aria-label="정류장 정보 닫기"
                                    >
                                        <X className="w-3.5 h-3.5"/>
                                    </button>
                                </div>
                            </div>

                            {/* Live Arrivals Body */}
                            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-1">
                                <BusStopPopup
                                    stopId={selectedStop.nodeid}
                                    cityCode={currentCity.code}
                                    currentRouteName={selectedRoute}
                                    onRouteChange={onRouteChange}
                                />
                            </div>

                            {/* Footer Info Note */}
                            <div
                                className="px-4 py-2 border-t border-slate-200/80 dark:border-white/10 bg-slate-100/50 dark:bg-white/[0.02] text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between shrink-0">
                                <span>실시간 도착 정보</span>
                                <span className="text-[10px]">노선 클릭 시 경로 전환</span>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Embedded Route Schedule Timetable */}
                    {isScheduleOpen && (activeBottomTab === "schedule" || !selectedStop) && (
                        <div className="w-full h-full flex flex-col overflow-hidden">
                            <RouteScheduleModal
                                embedded={true}
                                isOpen={true}
                                routeName={selectedRoute}
                                onClose={() => {
                                    setIsScheduleOpen(false);
                                    if (selectedStop) {
                                        setActiveBottomTab("stop");
                                    }
                                }}
                                dayMode={dayMode}
                                isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
