"use client";

import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {Marker} from "react-map-gl/maplibre";
import {ArrowRight, Calendar, Clock, RotateCw, X} from "lucide-react";

import {type RouteVariation, type RouteVariationStop, useRouteVariations} from "@entities/route";
import {type BusRoute, getUpcomingDepartures, resolveActiveScheduleVariant, useSchedule} from "@entities/schedule";
import {useAppMapContext} from "@shared/context/AppMapContext";
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
    onOpenScheduleModal?: (docOrSubTab?: string) => void;
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
    const isWonju = cityCode === "32020";

    // 1. Fetch Route Variations (stops & turning points)
    const {variations} = useRouteVariations(routeName, enabled, cityCode);
    const primaryVariant = variations?.[0] ?? null;
    const stops = useMemo(() => primaryVariant?.stops ?? [], [primaryVariant?.stops]);

    // 2. Fetch Timetable Schedules
    const {routes: scheduleRoutes} = useSchedule(enabled && isWonju);

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

    // 5. Pinpoint Timetable Popup State
    const [activePopupRole, setActivePopupRole] = useState<TerminalRole | null>(null);

    const activePopupStop = useMemo(() => {
        if (activePopupRole === "ORIGIN") return originStop;
        if (activePopupRole === "DEST") return turningStop;
        return null;
    }, [activePopupRole, originStop, turningStop]);

    const activePopupDepartures = useMemo(() => {
        if (activePopupRole === "ORIGIN") return originDepartures;
        if (activePopupRole === "DEST") return destDepartures;
        return null;
    }, [activePopupRole, originDepartures, destDepartures]);

    // Handler to smoothly switch between Origin and Turnaround in popup & center in visible map view
    const handleOpenRole = useCallback(
        (targetRole: TerminalRole) => {
            const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;
            const targetStop = targetRole === "ORIGIN" ? originStop : turningStop;

            if (isDesktop) {
                if (targetStop) {
                    window.dispatchEvent(new CustomEvent("wbus:focus-stop", {detail: targetStop}));
                }
                window.dispatchEvent(new CustomEvent("wbus:open-schedule", {detail: {role: targetRole}}));
                window.dispatchEvent(new CustomEvent("wbus:open-bus-list"));
                if (map && targetStop && targetStop.gpslati && targetStop.gpslong) {
                    map.flyTo({
                        center: [targetStop.gpslong, targetStop.gpslati],
                        zoom: Math.max(map.getZoom(), 15.2),
                        padding: {
                            left: 420,
                            right: 40,
                            top: 80,
                            bottom: 80,
                        },
                        duration: 650,
                    });
                }
                return;
            }

            setActivePopupRole(targetRole);
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("wbus:close-stop-popup"));
            }
            if (map && targetStop && targetStop.gpslati && targetStop.gpslong) {
                const isCompact = typeof window !== "undefined" && window.innerWidth < 640;
                map.flyTo({
                    center: [targetStop.gpslong, targetStop.gpslati],
                    zoom: Math.max(map.getZoom(), 15.2),
                    padding: {
                        top: 120,
                        bottom: isCompact ? Math.round(window.innerHeight * 0.45) : 180,
                        left: 32,
                        right: 32,
                    },
                    duration: 650,
                });
            }
        },
        [map, originStop, turningStop]
    );

    const departureListRef = useRef<HTMLDivElement>(null);

    // Auto-scroll departure list to the next upcoming departure
    useEffect(() => {
        if (!activePopupRole) return;
        const frameId = requestAnimationFrame(() => {
            if (!departureListRef.current) return;
            const nextEl = departureListRef.current.querySelector<HTMLElement>('[data-next-departure="true"]');
            if (nextEl) {
                nextEl.scrollIntoView({behavior: "smooth", block: "center"});
            }
        });
        return () => cancelAnimationFrame(frameId);
    }, [activePopupRole, activeSchedule?.id]);

    // Close on Escape key press
    useEffect(() => {
        if (!activePopupRole) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setActivePopupRole(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activePopupRole]);

    // Close when requested by other modals
    useEffect(() => {
        if (!activePopupRole) return;
        const handleClose = () => setActivePopupRole(null);
        window.addEventListener("wbus:close-timetable", handleClose);
        return () => window.removeEventListener("wbus:close-timetable", handleClose);
    }, [activePopupRole]);

    // Timetable pins are currently only supported for Wonju
    if (!enabled || !isWonju || !stops.length || !originStop) {
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
                style={{zIndex: 24, pointerEvents: "auto", cursor: "pointer"}}
                onClick={(e) => {
                    e.originalEvent?.stopPropagation();
                    handleOpenRole("ORIGIN");
                }}
            >
                <div
                    className="relative flex flex-col items-center select-none group transition-transform duration-200 hover:scale-105 active:scale-95"
                    title={`기점 시간표: ${originStop.nodenm}`}
                    aria-label={`기점 시간표: ${originStop.nodenm}`}
                >
                    {/* Pin Pill Label */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-lg border backdrop-blur-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-300/80 shadow-blue-600/35 ring-2 ring-blue-500/25">
                        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-white/20 shrink-0">
                            <Clock className="w-2.5 h-2.5 text-white stroke-[2.5]" />
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
                    <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-indigo-600 -mt-px" />

                    {/* Ground Beacon Pulse Dot */}
                    <div className="relative flex items-center justify-center w-3 h-3 -mt-0.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-blue-400" />
                        <span className="relative inline-flex rounded-full h-2 w-2 border border-white shadow-xs bg-blue-600" />
                    </div>
                </div>
            </Marker>

            {/* 2. Turnaround Terminus Timetable Pin (회차지 시간표 핀) */}
            {turningStop && !isSameLocation && (
                <Marker
                    longitude={turningStop.gpslong}
                    latitude={turningStop.gpslati}
                    anchor="bottom"
                    style={{zIndex: 24, pointerEvents: "auto", cursor: "pointer"}}
                    onClick={(e) => {
                        e.originalEvent?.stopPropagation();
                        handleOpenRole("DEST");
                    }}
                >
                    <div
                        className="relative flex flex-col items-center select-none group transition-transform duration-200 hover:scale-105 active:scale-95"
                        title={`회차지 시간표: ${turningStop.nodenm}`}
                        aria-label={`회차지 시간표: ${turningStop.nodenm}`}
                    >
                        {/* Pin Pill Label */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-lg border backdrop-blur-md bg-gradient-to-r from-amber-600 to-orange-600 text-white border-amber-300/80 shadow-amber-600/35 ring-2 ring-amber-500/25">
                            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-white/20 shrink-0">
                                <RotateCw className="w-2.5 h-2.5 text-white stroke-[2.5]" />
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
                                <div className="ml-1 pl-1.5 border-l border-white/25 flex flex-col items-end leading-none">
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
                        <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-orange-600 -mt-px" />

                        {/* Ground Beacon Pulse Dot */}
                        <div className="relative flex items-center justify-center w-3 h-3 -mt-0.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-amber-400" />
                            <span className="relative inline-flex rounded-full h-2 w-2 border border-white shadow-xs bg-amber-600" />
                        </div>
                    </div>
                </Marker>
            )}

            {/* 3. Interactive Timetable Sheet (Floating Window above all map controls and bottom nav) */}
            {typeof document !== "undefined" && activePopupRole && activePopupStop &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[120] flex flex-col justify-end sm:justify-center items-center pb-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] sm:pb-0 pointer-events-none px-3">
                        {/* Click-outside backdrop */}
                        <div
                            className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-[2px] transition-opacity animate-fadeIn pointer-events-auto"
                            onClick={() => setActivePopupRole(null)}
                            aria-hidden="true"
                        />
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-label={`${routeName}번 ${activePopupRole === "ORIGIN" ? "기점" : "회차지"} 출발 시간표`}
                            className="relative z-10 pointer-events-auto flex flex-col w-[94vw] sm:w-[420px] max-w-md max-h-[70vh] sm:max-h-[640px] bg-white dark:bg-[#11131a] sm:bg-white/98 sm:dark:bg-[#11131a]/98 backdrop-blur-3xl overflow-hidden rounded-[28px] shadow-[0_16px_48px_rgba(0,0,0,0.35)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.65)] border border-black/10 dark:border-white/12 animate-fadeIn select-none"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Mobile Drawer Grab Indicator */}
                            <div className="pt-2 pb-0.5 flex justify-center sm:hidden shrink-0">
                                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700"/>
                            </div>

                            {/* Popup Header */}
                            <div className="p-4 border-b border-black/5 dark:border-white/5 space-y-2.5 shrink-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div
                                            className={`flex items-center justify-center w-8 h-8 rounded-xl text-white shadow-sm shrink-0 ${
                                                activePopupRole === "ORIGIN" ? "bg-blue-600" : "bg-amber-600"
                                            }`}
                                        >
                                            {activePopupRole === "ORIGIN" ? (
                                                <Clock className="w-4 h-4 stroke-[2.5]"/>
                                            ) : (
                                                <RotateCw className="w-4 h-4 stroke-[2.5]"/>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span
                                                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-black text-white shrink-0 ${
                                                        activePopupRole === "ORIGIN" ? "bg-blue-600" : "bg-amber-600"
                                                    }`}
                                                >
                                                    {activePopupRole === "ORIGIN" ? "기점 출발" : "회차지 출발"}
                                                </span>
                                                <span
                                                    className="px-1.5 py-0.2 rounded-md text-[10px] font-black bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300 shrink-0">
                                                    {routeName}번 버스
                                                </span>
                                            </div>
                                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
                                                {activePopupStop.nodenm}
                                            </h3>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setActivePopupRole(null)}
                                        className="p-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                                        aria-label="시간표 닫기"
                                    >
                                        <X className="w-4 h-4"/>
                                    </button>
                                </div>

                                {/* Terminal Quick Switcher Tabs */}
                                {turningStop && !isSameLocation && (
                                    <div className="grid grid-cols-2 rounded-xl bg-slate-100 dark:bg-white/5 p-1 gap-1">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenRole("ORIGIN")}
                                            className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer truncate ${
                                                activePopupRole === "ORIGIN"
                                                    ? "bg-blue-600 text-white shadow-xs"
                                                    : "text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5"
                                            }`}
                                        >
                                            <Clock className="w-3 h-3 shrink-0"/>
                                            <span className="truncate">
                                                기점 ({formattedOriginName})
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenRole("DEST")}
                                            className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer truncate ${
                                                activePopupRole === "DEST"
                                                    ? "bg-amber-600 text-white shadow-xs"
                                                    : "text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5"
                                            }`}
                                        >
                                            <RotateCw className="w-3 h-3 shrink-0"/>
                                            <span className="truncate">
                                                회차지 ({formattedTurningName})
                                            </span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Popup Body: Next Departure & Full Schedule */}
                            <div className="flex-1 min-h-0 p-4 space-y-3.5 overflow-y-auto custom-scrollbar">
                                {/* Live Next Departure Spotlight Card */}
                                <div
                                    className={`p-3.5 rounded-2xl border ${
                                        activePopupRole === "ORIGIN"
                                            ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60"
                                            : "bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60"
                                    }`}
                                >
                                    <div
                                        className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                                        <span>다음 예정 출발</span>
                                        {activeSchedule && (
                                            <span
                                                className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500">
                                                {activeSchedule.dayType}
                                            </span>
                                        )}
                                    </div>

                                    {activePopupDepartures?.nextDeparture ? (
                                        <div className="space-y-1">
                                            <div className="flex items-baseline gap-1.5">
                                                <span
                                                    className={`text-2xl font-black font-mono tracking-tight ${
                                                        activePopupRole === "ORIGIN"
                                                            ? "text-blue-600 dark:text-blue-400"
                                                            : "text-amber-600 dark:text-amber-400"
                                                    }`}
                                                >
                                                    {activePopupDepartures.nextDeparture.timeStr}
                                                </span>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                    (
                                                    {activePopupDepartures.nextDeparture.waitMins <= 0
                                                        ? "곧 출발 예정"
                                                        : `${activePopupDepartures.nextDeparture.waitMins}분 후`}
                                                    )
                                                </span>
                                            </div>
                                            {activePopupDepartures.nextDeparture.entry.notes && (
                                                <div
                                                    className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-black/30 px-2 py-0.5 rounded-md inline-flex items-center gap-1 border border-black/5 dark:border-white/5">
                                                    <span>※ {activePopupDepartures.nextDeparture.entry.notes}</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-sm font-bold text-slate-500 dark:text-slate-400 py-1">
                                            이후 예정된 출발이 없습니다.
                                        </div>
                                    )}

                                    {/* Subsequent departures */}
                                    {activePopupDepartures && activePopupDepartures.subsequentDepartures.length > 0 && (
                                        <div
                                            className="mt-2.5 pt-2 border-t border-black/5 dark:border-white/5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex-wrap">
                                            <span
                                                className="text-[10px] text-slate-400 font-bold shrink-0">이후 출발:</span>
                                            {activePopupDepartures.subsequentDepartures.map((sub) => (
                                                <span
                                                    key={sub.entry.seq}
                                                    className="px-1.5 py-0.5 rounded bg-white/80 dark:bg-white/10 font-mono font-bold text-[10px]"
                                                >
                                                    {sub.timeStr}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Day Type Variant Selector Buttons (if multiple variants exist) */}
                                {routeSchedules.length > 1 && (
                                    <div className="space-y-1.5">
                                        <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
                                            운행 요일 선택:
                                        </span>
                                        <div className="flex flex-wrap gap-1">
                                            {routeSchedules.map((variant) => (
                                                <button
                                                    key={variant.id}
                                                    type="button"
                                                    onClick={() => setSelectedVariantId(variant.id)}
                                                    className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                                                        activeSchedule?.id === variant.id
                                                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs"
                                                            : "bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10"
                                                    }`}
                                                >
                                                    {variant.dayType}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Scheduled Departures List */}
                                <div className="space-y-1.5">
                                    <div
                                        className="flex items-center justify-between text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
                                        <span>
                                            {activePopupRole === "ORIGIN"
                                                ? `기점(${formattedOriginName}) 전체 출발 시각`
                                                : `회차지(${formattedTurningName}) 전체 출발 시각`}
                                        </span>
                                        <span>
                                            총 {activePopupDepartures?.allValidDepartures.length ?? 0}회
                                        </span>
                                    </div>

                                    <div
                                        ref={departureListRef}
                                        className="max-h-40 overflow-y-auto rounded-xl border border-black/5 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] p-1.5 divide-y divide-black/5 dark:divide-white/5 custom-scrollbar"
                                    >
                                        {activePopupDepartures?.allValidDepartures.length ? (
                                            activePopupDepartures.allValidDepartures.map((item) => {
                                                const timeStr =
                                                    activePopupRole === "ORIGIN"
                                                        ? item.originDepTime
                                                        : item.destDepTime;
                                                const isNext =
                                                    activePopupDepartures.nextDeparture?.entry.seq === item.seq;

                                                return (
                                                    <div
                                                        key={item.seq}
                                                        data-next-departure={isNext ? "true" : undefined}
                                                        className={`flex items-center justify-between px-2 py-1.5 text-xs transition-colors rounded ${
                                                            isNext
                                                                ? activePopupRole === "ORIGIN"
                                                                    ? "bg-blue-500/15 font-black text-blue-700 dark:text-blue-300"
                                                                    : "bg-amber-500/15 font-black text-amber-700 dark:text-amber-300"
                                                                : "text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="font-mono text-[10px] text-slate-400 w-5 text-right">
                                                                {item.seq}회
                                                            </span>
                                                            <span className="font-mono font-bold">{timeStr}</span>
                                                            {isNext && (
                                                                <span
                                                                    className={`px-1 py-0.2 rounded text-[9px] font-black text-white ${
                                                                        activePopupRole === "ORIGIN"
                                                                            ? "bg-blue-600"
                                                                            : "bg-amber-600"
                                                                    }`}
                                                                >
                                                                    다음 출발
                                                                </span>
                                                            )}
                                                        </div>
                                                        {item.notes && (
                                                            <span
                                                                className="text-[10px] text-slate-400 truncate max-w-[100px]">
                                                                {item.notes}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="py-4 text-center text-xs text-slate-400">
                                                운행 시간표 정보가 등록되지 않았습니다.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Popup Footer (pinned cleanly at the bottom) */}
                            <div
                                className="p-3 border-t border-black/5 dark:border-white/5 bg-slate-50/80 dark:bg-white/[0.04] flex items-center justify-between gap-2 shrink-0">
                                {onOpenScheduleModal && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActivePopupRole(null);
                                            onOpenScheduleModal(`route:${routeName}`);
                                        }}
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-xs transition cursor-pointer active:scale-95"
                                    >
                                        <Calendar className="w-3.5 h-3.5"/>
                                        <span>노선 전체 시간표</span>
                                        <ArrowRight className="w-3.5 h-3.5"/>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
});

export default TimetablePinMarker;
