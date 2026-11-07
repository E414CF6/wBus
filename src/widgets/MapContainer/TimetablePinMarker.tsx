"use client";

import React, {memo, useCallback, useEffect, useMemo, useState} from "react";
import {Marker} from "react-map-gl/maplibre";
import {Clock, RotateCw} from "lucide-react";

import {type RouteVariation, type RouteVariationStop, useRouteVariations} from "@entities/route";
import {type BusRoute, getUpcomingDepartures, resolveActiveScheduleVariant, useSchedule} from "@entities/schedule";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {getCityFeatures} from "@entities/city";
import type {DayMode} from "@shared/types/navigation";

// ----------------------------------------------------------------------
// Helper to safely format terminus names (strip 차고지, (시내방면), etc.)
// ----------------------------------------------------------------------

export function formatTerminalStopName(name: string): string {
    return name
        .replace(/\s*(종점|차고지|승강장)$/, "")
        .replace(/\s*\((시내방면|교내|종점|회차)\)$/, "")
        .trim();
}

// ----------------------------------------------------------------------
// Helper to safely identify turnaround stop
// ----------------------------------------------------------------------

export function resolveTurnaroundStop(
    variant: RouteVariation | null,
    stops: RouteVariationStop[],
    destHint?: string
): RouteVariationStop | null {
    if (variant?.turningStop && variant.turningStop.gpslati > 0 && variant.turningStop.gpslong > 0) {
        return variant.turningStop;
    }

    // 1. Explicit station name contains "회차"
    const explicit = stops.find(
        (s) => s.nodenm && s.nodenm.includes("회차") && s.gpslati > 0 && s.gpslong > 0
    );
    if (explicit) return explicit;

    // 2. Outbound to Inbound transition (ud 0 -> 1)
    for (let i = 0; i < stops.length - 1; i++) {
        if (stops[i].updowncd === 0 && stops[i + 1].updowncd === 1) {
            if (stops[i].gpslati > 0 && stops[i].gpslong > 0) {
                return stops[i];
            }
        }
    }

    // 3. Match destination hint from timetable
    if (destHint) {
        const cleanHint = destHint.replace(/종점|차고지|승강장/g, "").trim();
        if (cleanHint.length >= 2) {
            const matched = stops.find(
                (s) => s.nodenm && s.nodenm.includes(cleanHint) && s.gpslati > 0 && s.gpslong > 0
            );
            if (matched) return matched;
        }
    }

    // 4. Middle stop if circular
    if (stops.length > 2) {
        const mid = stops[Math.floor(stops.length / 2)];
        if (mid && mid.gpslati > 0 && mid.gpslong > 0) return mid;
    }

    // 5. Last stop if different from first
    if (stops.length > 1) {
        const last = stops[stops.length - 1];
        if (last && last.gpslati > 0 && last.gpslong > 0 && last.nodeid !== stops[0]?.nodeid) {
            return last;
        }
    }

    return null;
}

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export interface TimetablePinMarkerProps {
    routeName: string;
    cityCode?: string;
    onRouteChange?: (routeName: string) => void;
    onOpenScheduleModal?: (docOrSubTab?: string, initialLocation?: "origin" | "dest") => void;
    enabled?: boolean;
    dayMode?: DayMode;
    isTodayWeekendOrHoliday?: boolean;
}

type TerminalRole = "ORIGIN" | "DEST";

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------

export const TimetablePinMarker = memo(function TimetablePinMarker({
                                                                       routeName,
                                                                       cityCode = "32020",
                                                                       onRouteChange: _onRouteChange,
                                                                       onOpenScheduleModal,
                                                                       enabled = true,
                                                                       dayMode = "AUTO",
                                                                       isTodayWeekendOrHoliday,
                                                                   }: TimetablePinMarkerProps) {
    const {map} = useAppMapContext();
    const {hasDetailedTimetable} = getCityFeatures(cityCode);

    // 1. Fetch Route Variations (stops & turning points)
    const {variations} = useRouteVariations(routeName, enabled, cityCode);
    const primaryVariant = variations?.[0] ?? null;
    const stops = useMemo(() => primaryVariant?.stops ?? [], [primaryVariant?.stops]);

    // 2. Fetch Timetable Schedules
    const {routes: scheduleRoutes} = useSchedule(enabled && hasDetailedTimetable);

    // Matching timetable variants for current route
    const routeSchedules = useMemo(
        () => (scheduleRoutes ? scheduleRoutes.filter((r) => r.routeNo === routeName) : []),
        [scheduleRoutes, routeName]
    );

    // Live clock for next departure countdown
    const [now, setNow] = useState<Date>(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 15000);
        return () => clearInterval(timer);
    }, []);

    // Active Day Mode selection for timetable (평일 vs 주말/공휴일 등)
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [prevSelectionKey, setPrevSelectionKey] = useState(() => `${dayMode}_${routeName}`);

    // Reset variant selection during render when dayMode or routeName changes
    const currentSelectionKey = `${dayMode}_${routeName}`;
    if (prevSelectionKey !== currentSelectionKey) {
        setPrevSelectionKey(currentSelectionKey);
        setSelectedVariantId(null);
    }

    const activeSchedule: BusRoute | null = useMemo(() => {
        return resolveActiveScheduleVariant(
            routeSchedules,
            selectedVariantId,
            dayMode,
            isTodayWeekendOrHoliday
        );
    }, [routeSchedules, selectedVariantId, dayMode, isTodayWeekendOrHoliday]);

    // 3. Resolve Origin Stop & Turnaround Stop
    const originStop: RouteVariationStop | null = useMemo(() => {
        if (!stops.length) return null;
        const first = stops[0];
        return first && first.gpslati > 0 && first.gpslong > 0 ? first : null;
    }, [stops]);

    const turningStop: RouteVariationStop | null = useMemo(() => {
        if (!stops.length) return null;
        return resolveTurnaroundStop(primaryVariant, stops, activeSchedule?.destination);
    }, [primaryVariant, stops, activeSchedule?.destination]);

    // 4. Calculate Upcoming Departures
    const originDepartures = useMemo(() => {
        if (!activeSchedule?.timetable) return {nextDeparture: null, subsequentDepartures: [], allValidDepartures: []};
        return getUpcomingDepartures(activeSchedule.timetable, "ORIGIN", now);
    }, [activeSchedule, now]);

    const destDepartures = useMemo(() => {
        if (!activeSchedule?.timetable) return {nextDeparture: null, subsequentDepartures: [], allValidDepartures: []};
        return getUpcomingDepartures(activeSchedule.timetable, "DEST", now);
    }, [activeSchedule, now]);

    // Handler to open full timetable modal with context of the clicked terminal stop
    const handleOpenPinSchedule = useCallback(
        (targetRole: TerminalRole) => {
            const targetStop = targetRole === "ORIGIN" ? originStop : turningStop;

            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("wbus:close-stop-popup"));
                window.dispatchEvent(new CustomEvent("wbus:close-timetable"));
            }
            if (map && targetStop && targetStop.gpslati && targetStop.gpslong) {
                map.flyTo({
                    center: [targetStop.gpslong, targetStop.gpslati],
                    zoom: Math.max(map.getZoom(), 15.2),
                    duration: 650,
                });
            }

            const initialLoc: "origin" | "dest" = targetRole === "ORIGIN" ? "origin" : "dest";
            onOpenScheduleModal?.(`route:${routeName}:${initialLoc}`, initialLoc);
        },
        [map, originStop, turningStop, onOpenScheduleModal, routeName]
    );

    // Timetable pins are only supported for cities with detailed schedule
    if (!enabled || !hasDetailedTimetable || !stops.length || !originStop) {
        return null;
    }

    const isSameLocation =
        turningStop &&
        originStop.nodeid === turningStop.nodeid &&
        Math.abs(originStop.gpslati - turningStop.gpslati) < 0.0001 &&
        Math.abs(originStop.gpslong - turningStop.gpslong) < 0.0001;

    const formattedOriginName = formatTerminalStopName(originStop.nodenm);
    const formattedTurningName = turningStop ? formatTerminalStopName(turningStop.nodenm) : "";

    return (
        <>
            {/* 1. Origin Terminus Timetable Pin (기점 시간표 핀) */}
            <Marker
                longitude={originStop.gpslong}
                latitude={originStop.gpslati}
                anchor="bottom"
                style={{zIndex: 26, pointerEvents: "auto", cursor: "pointer"}}
                onClick={(e) => {
                    e.originalEvent?.stopPropagation();
                    handleOpenPinSchedule("ORIGIN");
                }}
            >
                <div
                    className="relative flex flex-col items-center select-none group transition-transform duration-200 hover:scale-105 active:scale-95"
                    title={`기점 시간표: ${originStop.nodenm}`}
                    aria-label={`기점 시간표: ${originStop.nodenm}`}
                >
                    {/* Pin Pill Label */}
                    <div
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-lg border backdrop-blur-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-300/80 shadow-blue-600/35 ring-2 ring-blue-500/25">
                        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-white/20 shrink-0">
                            <Clock className="w-2.5 h-2.5 text-white stroke-[2.5]"/>
                        </div>
                        <div className="flex flex-col text-left leading-tight">
                            <span className="text-[9px] uppercase font-black tracking-wider text-blue-200">
                                기점 시간표
                            </span>
                            <span className="font-extrabold text-[11px] max-w-[110px] truncate text-white">
                                {formattedOriginName}
                            </span>
                        </div>
                        {originDepartures.nextDeparture && (
                            <div className="ml-1 pl-1.5 border-l border-white/25 flex flex-col items-end leading-none">
                                <span className="font-mono font-black text-[11px] text-white">
                                    {originDepartures.nextDeparture.timeStr}
                                </span>
                                <span className="text-[9px] font-bold text-blue-100">
                                    {originDepartures.nextDeparture.waitMins <= 0
                                        ? "곧 출발"
                                        : `${originDepartures.nextDeparture.waitMins}분 후`}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Downward Pointer Triangle */}
                    <div
                        className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-indigo-600 -mt-px"/>

                    {/* Ground Beacon Pulse Dot */}
                    <div className="relative flex items-center justify-center w-3 h-3 -mt-0.5">
                        <span
                            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-blue-400"/>
                        <span
                            className="relative inline-flex rounded-full h-2 w-2 border border-white shadow-xs bg-blue-600"/>
                    </div>
                </div>
            </Marker>

            {/* 2. Turnaround Terminus Timetable Pin (회차지 시간표 핀) */}
            {turningStop && !isSameLocation && (
                <Marker
                    longitude={turningStop.gpslong}
                    latitude={turningStop.gpslati}
                    anchor="bottom"
                    style={{zIndex: 26, pointerEvents: "auto", cursor: "pointer"}}
                    onClick={(e) => {
                        e.originalEvent?.stopPropagation();
                        handleOpenPinSchedule("DEST");
                    }}
                >
                    <div
                        className="relative flex flex-col items-center select-none group transition-transform duration-200 hover:scale-105 active:scale-95"
                        title={`회차지 시간표: ${turningStop.nodenm}`}
                        aria-label={`회차지 시간표: ${turningStop.nodenm}`}
                    >
                        {/* Pin Pill Label */}
                        <div
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-lg border backdrop-blur-md bg-gradient-to-r from-amber-600 to-orange-600 text-white border-amber-300/80 shadow-amber-600/35 ring-2 ring-amber-500/25">
                            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-white/20 shrink-0">
                                <RotateCw className="w-2.5 h-2.5 text-white stroke-[2.5]"/>
                            </div>
                            <div className="flex flex-col text-left leading-tight">
                                <span className="text-[9px] uppercase font-black tracking-wider text-amber-200">
                                    회차지 시간표
                                </span>
                                <span className="font-extrabold text-[11px] max-w-[110px] truncate text-white">
                                    {formattedTurningName}
                                </span>
                            </div>
                            {destDepartures.nextDeparture && (
                                <div
                                    className="ml-1 pl-1.5 border-l border-white/25 flex flex-col items-end leading-none">
                                    <span className="font-mono font-black text-[11px] text-white">
                                        {destDepartures.nextDeparture.timeStr}
                                    </span>
                                    <span className="text-[9px] font-bold text-amber-100">
                                        {destDepartures.nextDeparture.waitMins <= 0
                                            ? "곧 출발"
                                            : `${destDepartures.nextDeparture.waitMins}분 후`}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Downward Pointer Triangle */}
                        <div
                            className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-orange-600 -mt-px"/>

                        {/* Ground Beacon Pulse Dot */}
                        <div className="relative flex items-center justify-center w-3 h-3 -mt-0.5">
                            <span
                                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-amber-400"/>
                            <span
                                className="relative inline-flex rounded-full h-2 w-2 border border-white shadow-xs bg-amber-600"/>
                        </div>
                    </div>
                </Marker>
            )}
        </>
    );
});

export default TimetablePinMarker;
