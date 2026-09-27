"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Bus, Loader2, RefreshCw, RotateCw, X} from "lucide-react";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useRouteVariations, type RouteVariationStop} from "@entities/route";
import {getRouteMeta} from "@entities/route/routeMetadata";
import {useSchedule} from "@entities/schedule/hooks";
import type {BusItem} from "@entities/bus/types";
import type {BusStop} from "@entities/station/types";
import type {DirectionCode} from "@entities/route/types";

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
                                                            }) => {
    const {map} = useAppMapContext();
    const {variations} = useRouteVariations(selectedRoute);
    const {routes: scheduleRoutes} = useSchedule();
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
    const [directionFilter, setDirectionFilter] = useState<"all" | "up" | "down">("all");
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [timeAgo, setTimeAgo] = useState("0초 전");
    const listRef = useRef<HTMLDivElement>(null);

    // Auto-select variation: prefer variant with running buses, or fallback to first variant
    useEffect(() => {
        if (!variations || variations.length === 0) {
            setSelectedVariantId(null);
            return;
        }

        // Keep current selected variant if still valid for this route
        if (selectedVariantId && variations.some((v) => v.routeId === selectedVariantId)) {
            return;
        }

        // Prioritize variation that has running buses
        const variantWithBuses = runningBuses.find((b) => b.routeid && variations.some((v) => v.routeId === b.routeid))?.routeid;

        setSelectedVariantId(variantWithBuses ?? variations[0].routeId);
    }, [variations, selectedRoute, runningBuses, selectedVariantId]);

    // Active variant object
    const currentVariant = useMemo(() => {
        if (!variations || variations.length === 0) return null;
        return variations.find((v) => v.routeId === selectedVariantId) ?? variations[0];
    }, [variations, selectedVariantId]);

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
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

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

    // Route Metadata & Schedule info
    const meta = useMemo(() => getRouteMeta(selectedRoute), [selectedRoute]);
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

    // Filtered stops by direction
    const filteredStops = useMemo(() => {
        if (directionFilter === "all" || !hasDirections) {
            return currentStops;
        }
        const targetUd = directionFilter === "up" ? 0 : 1;
        return currentStops.filter((s) => s.updowncd === targetUd);
    }, [currentStops, directionFilter, hasDirections]);

    // Match live running buses to current variation's stops
    const busesByStopKey = useMemo(() => {
        const map = new Map<string, BusItem[]>();
        if (!runningBuses || runningBuses.length === 0 || currentStops.length === 0) {
            return map;
        }

        for (const bus of runningBuses) {
            // When multiple variations exist, ignore buses that explicitly belong to a different variation
            if (variations.length > 1 && bus.routeid && currentVariant && bus.routeid !== currentVariant.routeId) {
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
                        const targetUd = dir === 1 ? 0 : 1;
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
    }, [runningBuses, currentStops, variations.length, currentVariant, getDirection]);

    // Trigger manual telemetry refresh
    const handleRefresh = useCallback(() => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        onReconnect?.();
        setTimeout(() => setIsRefreshing(false), 800);
    }, [isRefreshing, onReconnect]);

    // Station selection and flyTo
    const handleStopClick = useCallback(
        (stop: BusStop) => {
            setSelectedStopId(stop.nodeid);
            if (map && stop.gpslong && stop.gpslati) {
                map.flyTo({
                    center: [stop.gpslong, stop.gpslati],
                    zoom: 16,
                    duration: 1000,
                });
            }
        },
        [map]
    );

    if (!isOpen) return null;

    return (
        <div
            className="w-[94vw] sm:w-[400px] max-w-md max-h-[75vh] sm:max-h-[640px] flex flex-col backdrop-blur-2xl bg-white/95 dark:bg-[#0c100f]/95 border border-slate-200/80 dark:border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-[28px] overflow-hidden transition-all duration-300 animate-fadeIn text-slate-900 dark:text-white select-none pointer-events-auto"
            role="dialog"
            aria-label={`${selectedRoute}번 버스 정류장 목록`}
        >
            {/* 1. Header Section */}
            <div
                className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-200/80 dark:border-white/10 shrink-0 bg-slate-50/50 dark:bg-white/[0.02]">
                <div className="flex items-start gap-3 min-w-0">
                    {/* Blue Accent Vertical Bar */}
                    <div className="w-1.5 h-11 rounded-full bg-blue-600 dark:bg-blue-500 shrink-0 mt-0.5"/>

                    <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 tracking-tight">
                            버스 노선
                        </span>
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none mt-0.5">
                            {selectedRoute}
                        </h2>
                        <p
                            className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[210px] sm:max-w-[260px] mt-1.5"
                            title={routeSubInfo}
                        >
                            {routeSubInfo}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-xs">
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                                {isConnecting
                                    ? "실시간 연결 중..."
                                    : `실시간 ${runningBuses.length}대 운행중`}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500 font-medium">{timeAgo}</span>
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
                        className="w-8 h-8 rounded-full border border-slate-200/80 dark:border-white/15 bg-slate-100 hover:bg-slate-200/80 dark:bg-white/5 dark:hover:bg-white/15 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer active:scale-90"
                        title="닫기"
                        aria-label="닫기"
                    >
                        <X className="w-4 h-4"/>
                    </button>
                </div>
            </div>

            {/* 1.5 Variation Selector (if route has multiple variations) */}
            {variations.length > 1 && (<div
                    className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-200/80 dark:border-white/10 bg-slate-100/60 dark:bg-white/[0.02] text-xs shrink-0 overflow-x-auto custom-scrollbar-hidden"
                    role="tablist"
                    aria-label="노선 종류 선택"
                >
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 mr-1">
                        노선:
                    </span>
                    {variations.map((variant) => {
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

            {/* 2. Direction Filter Segment (if route has up & down stops) */}
            {hasDirections && (
                <div
                    className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-200/80 dark:border-white/5 bg-slate-100/40 dark:bg-black/20 text-xs shrink-0 overflow-x-auto custom-scrollbar-hidden">
                    <button
                        type="button"
                        onClick={() => setDirectionFilter("all")}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                            directionFilter === "all" ? "bg-blue-500/15 dark:bg-blue-500/25 text-blue-700 dark:text-blue-300 border border-blue-500/30 dark:border-blue-500/50 shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5"
                        }`}
                    >
                        전체 ({currentStops.length})
                    </button>
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
                </div>
            )}

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
                        해당 방향의 정류장 정보가 없습니다.
                    </div>
                ) : (
                    filteredStops.map((stop, index) => {
                        const stopKey = `${stop.nodeid}-${stop.nodeord ?? ""}`;
                        const busesHere = busesByStopKey.get(stopKey) || [];
                        const isFirst = index === 0;
                        const isLast = index === filteredStops.length - 1;
                        const isSelected = selectedStopId === stop.nodeid;
                        const isTurningStop = Boolean(turningStop && turningStop.nodeid === stop.nodeid && turningStop.nodeord === stop.nodeord);

                        return (
                            <div
                                key={stopKey}
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
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onBusClick(bus.gpslati, bus.gpslong);
                                                    }}
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
                                <div className="ml-[92px] flex-1 flex flex-col justify-center min-w-0 pr-4">
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
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
