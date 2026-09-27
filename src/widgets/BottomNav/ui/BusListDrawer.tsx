"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Bus, Loader2, RefreshCw, X} from "lucide-react";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useBusStop} from "@entities/station/hooks";
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
                                                                isConnecting,
                                                                onBusClick,
                                                                lastUpdated,
                                                                onReconnect,
                                                            }) => {
    const {map} = useAppMapContext();
    const stops = useBusStop(selectedRoute);
    const {routes: scheduleRoutes} = useSchedule();
    const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
    const [directionFilter, setDirectionFilter] = useState<"all" | "up" | "down">("all");
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [timeAgo, setTimeAgo] = useState("0초 전");
    const listRef = useRef<HTMLDivElement>(null);

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

    // Sorted stops by sequence order
    const sortedStops = useMemo(() => {
        if (!stops || stops.length === 0) return [];
        return [...stops].sort((a, b) => (a.nodeord ?? 0) - (b.nodeord ?? 0));
    }, [stops]);

    // Determine if route has up/down separation
    const hasDirections = useMemo(() => {
        const uds = new Set(
            sortedStops
                .map((s) => s.updowncd)
                .filter((u): u is number => u !== undefined && u !== null)
        );
        return uds.size > 1;
    }, [sortedStops]);

    // Filtered stops by direction
    const filteredStops = useMemo(() => {
        if (directionFilter === "all" || !hasDirections) {
            return sortedStops;
        }
        const targetUd = directionFilter === "up" ? 0 : 1;
        return sortedStops.filter((s) => s.updowncd === targetUd);
    }, [sortedStops, directionFilter, hasDirections]);

    // Match live running buses to stops
    const busesByStopKey = useMemo(() => {
        const map = new Map<string, BusItem[]>();
        if (!runningBuses || runningBuses.length === 0 || sortedStops.length === 0) {
            return map;
        }

        for (const bus of runningBuses) {
            // 1. Match by nodeord
            let matched = sortedStops.find(
                (s) =>
                    bus.nodeord !== undefined &&
                    s.nodeord !== undefined &&
                    bus.nodeord === s.nodeord
            );

            // 2. Match by nodeid
            if (!matched && bus.nodeid) {
                matched = sortedStops.find((s) => s.nodeid === bus.nodeid);
            }

            // 3. Match by stop name
            if (!matched && bus.nodenm) {
                matched = sortedStops.find((s) => s.nodenm === bus.nodenm);
            }

            // 4. Fallback: Proximity search within 500m
            if (!matched && bus.gpslati && bus.gpslong) {
                let minDistance = 0.5; // 500m
                let closest: BusStop | null = null;
                for (const s of sortedStops) {
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
    }, [runningBuses, sortedStops]);

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
            className="w-[94vw] sm:w-[400px] max-w-md max-h-[75vh] sm:max-h-[640px] flex flex-col backdrop-blur-2xl bg-[#0e1312]/95 dark:bg-[#0c100f]/95 border border-white/10 dark:border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-[28px] overflow-hidden transition-all duration-300 animate-fadeIn text-white select-none pointer-events-auto"
            role="dialog"
            aria-label={`${selectedRoute}번 버스 정류장 목록`}
        >
            {/* 1. Header Section */}
            <div
                className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/10 shrink-0 bg-white/[0.02]">
                <div className="flex items-start gap-3 min-w-0">
                    {/* Green Accent Vertical Bar */}
                    <div className="w-1.5 h-11 rounded-full bg-emerald-500 shrink-0 mt-0.5"/>

                    <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-bold text-emerald-400 tracking-tight">
                            버스 노선
                        </span>
                        <h2 className="text-3xl font-black text-white tracking-tight leading-none mt-0.5">
                            {selectedRoute}
                        </h2>
                        <p
                            className="text-xs text-slate-400 font-medium truncate max-w-[210px] sm:max-w-[260px] mt-1.5"
                            title={routeSubInfo}
                        >
                            {routeSubInfo}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-xs">
                            <span className="font-bold text-emerald-400">
                                {isConnecting
                                    ? "실시간 연결 중..."
                                    : `실시간 ${runningBuses.length}대 운행중`}
                            </span>
                            <span className="text-slate-400 font-medium">{timeAgo}</span>
                        </div>
                    </div>
                </div>

                {/* Right Top Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="w-8 h-8 rounded-full border border-white/15 bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer active:scale-90"
                        title="실시간 위치 새로고침"
                        aria-label="실시간 위치 새로고침"
                    >
                        <RefreshCw
                            className={`w-4 h-4 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`}
                        />
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full border border-white/15 bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer active:scale-90"
                        title="닫기"
                        aria-label="닫기"
                    >
                        <X className="w-4 h-4"/>
                    </button>
                </div>
            </div>

            {/* 2. Direction Filter Segment (if route has up & down stops) */}
            {hasDirections && (
                <div
                    className="flex items-center gap-1.5 px-4 py-2 border-b border-white/5 bg-black/20 text-xs shrink-0 overflow-x-auto custom-scrollbar-hidden">
                    <button
                        type="button"
                        onClick={() => setDirectionFilter("all")}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                            directionFilter === "all"
                                ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-xs"
                                : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`}
                    >
                        전체 ({sortedStops.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setDirectionFilter("up")}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                            directionFilter === "up"
                                ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-xs"
                                : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`}
                    >
                        {meta.destination || "종점"} 방면 (상행)
                    </button>
                    <button
                        type="button"
                        onClick={() => setDirectionFilter("down")}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                            directionFilter === "down"
                                ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-xs"
                                : "text-slate-400 hover:text-white hover:bg-white/5"
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
                {sortedStops.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-400"/>
                        <span className="text-xs font-semibold">
                            정류장 목록을 불러오고 있습니다...
                        </span>
                    </div>
                ) : filteredStops.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                        해당 방향의 정류장 정보가 없습니다.
                    </div>
                ) : (
                    filteredStops.map((stop, index) => {
                        const stopKey = `${stop.nodeid}-${stop.nodeord ?? ""}`;
                        const busesHere = busesByStopKey.get(stopKey) || [];
                        const isFirst = index === 0;
                        const isLast = index === filteredStops.length - 1;
                        const isSelected = selectedStopId === stop.nodeid;

                        return (
                            <div
                                key={stopKey}
                                className={`relative flex items-center min-h-[58px] py-3 transition-colors cursor-pointer group border-b border-white/5 ${
                                    isSelected
                                        ? "bg-emerald-950/40 border-l-2 border-emerald-500"
                                        : "hover:bg-white/[0.04]"
                                }`}
                                onClick={() => handleStopClick(stop)}
                            >
                                {/* Vertical Timeline Connecting Track */}
                                <div
                                    className={`absolute left-[74px] w-[2px] bg-emerald-500/80 pointer-events-none ${
                                        isFirst
                                            ? "top-1/2 bottom-0"
                                            : isLast
                                                ? "top-0 bottom-1/2"
                                                : "top-0 bottom-0"
                                    }`}
                                />

                                {/* Station Timeline Node (Donut Circle) */}
                                <div
                                    className="absolute left-[68px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-[2.5px] border-emerald-400 bg-[#0e1312] z-10 shadow-xs pointer-events-none"/>

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
                                                    {/* Dark Navy Badge: Vehicle Number */}
                                                    <span
                                                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#142238] border border-blue-500/40 text-blue-300 tracking-tight whitespace-nowrap select-none shadow-xs">
                                                        {plateDigits}
                                                    </span>

                                                    {/* Red Bus Icon Box */}
                                                    <div
                                                        className="w-6 h-6 rounded-md bg-[#ef4444] text-white flex items-center justify-center shadow-md shrink-0">
                                                        <Bus className="w-3.5 h-3.5 fill-current"/>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Station Name & Metadata */}
                                <div className="ml-[92px] flex-1 flex flex-col justify-center min-w-0 pr-4">
                                    <span
                                        className={`text-[14px] sm:text-[15px] font-bold truncate transition-colors ${
                                            isSelected
                                                ? "text-emerald-300"
                                                : "text-slate-100 group-hover:text-white"
                                        }`}
                                    >
                                        {stop.nodenm}
                                    </span>
                                    {stop.nodeno && (
                                        <span className="text-[10px] text-slate-500 font-mono">
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
