"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { MAP_SETTINGS } from "@core/config/env";
import { UI_TEXT } from "@core/config/locale";

import { useBusContext } from "@map/context/MapContext";

import { BusListItem } from "@bus/components/BusListItem";
import { useBusSortedList } from "@bus/hooks/useBusSortedList";
import { getBusErrorMessage } from "@bus/utils/errorMessages";

import { useScheduleData } from "@schedule/hooks/useScheduleData";
import { formatTime, getNearestBusTime } from "@schedule/utils/time";

import ScheduleView from "@schedule/components/ScheduleView";

import Pill from "@shared/ui/Pill";

import type { BusSchedule } from "@core/domain";

//-------------------------------------------------------------------
// Types & Interfaces
//-------------------------------------------------------------------

interface BusListProps {
    routeNames: string[];
    allRoutes: string[];
    selectedRoute: string;
    onRouteChange: (route: string) => void;
}

type RouteData = ReturnType<typeof useBusSortedList>;

interface NearestBus {
    time: string;
    minutesUntil: number;
    destination: string;
}

type ExpandedPanel = "bus" | "schedule" | null;

//-------------------------------------------------------------------
// Constants & Utility Styles
//-------------------------------------------------------------------

const getUrgencyClass = (minutesUntil: number): string => {
    if (minutesUntil <= 3) return "bg-red-500 dark:bg-red-400";
    if (minutesUntil <= 7) return "bg-amber-500 dark:bg-amber-400";
    if (minutesUntil <= 15) return "bg-emerald-500 dark:bg-emerald-400";
    return "bg-blue-500 dark:bg-blue-400";
};

const STYLES = {
    CONTAINER: "bg-white/90 dark:bg-black/80 backdrop-blur-2xl rounded-[32px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] w-full max-w-sm border border-black/5 dark:border-white/10 overflow-hidden transition-all duration-300 pointer-events-auto mx-auto",
    HEADER: "px-5 pt-5 pb-4 bg-transparent",
    SELECT_WRAPPER: "relative flex items-center group transition-all duration-200 bg-gray-100/80 dark:bg-white/10 rounded-2xl px-4 py-2",
    SELECT_ELEMENT: "appearance-none bg-transparent text-2xl font-bold text-black dark:text-white pr-8 cursor-pointer focus:outline-none z-10 w-full tracking-tight",
    SELECT_ICON: "absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-black/30 dark:text-white/30 group-hover:text-black dark:group-hover:text-white transition-colors",
    INFO_TEXT: "text-xs font-semibold",
    LIST_CONTAINER: "text-sm text-black dark:text-white max-h-[35vh] overflow-y-auto px-3 py-2 space-y-2 custom-scrollbar",
    SCHEDULE_CONTAINER: "max-h-[50svh] overflow-y-auto px-5 py-4 text-black dark:text-white custom-scrollbar",
};

//-------------------------------------------------------------------
// Sub-Components
//-------------------------------------------------------------------

const RouteDataCollector = React.memo(({
    routeName,
    onDataUpdate
}: {
    routeName: string;
    onDataUpdate: (name: string, data: RouteData) => void
}) => {
    const data = useBusSortedList(routeName);

    useEffect(() => {
        onDataUpdate(routeName, data);
    }, [routeName, data, onDataUpdate]);

    return null;
});
RouteDataCollector.displayName = 'RouteDataCollector';

interface SchedulePreviewProps {
    data: BusSchedule | null;
    loading: boolean;
    isOpen: boolean;
    onToggle: () => void;
}

const SchedulePreview = ({ data, loading, isOpen, onToggle }: SchedulePreviewProps) => {
    const [nearestBus, setNearestBus] = useState<NearestBus | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted || !data) {
            setNearestBus(null);
            return;
        }
        const updateTime = () => setNearestBus(getNearestBusTime(data));
        updateTime();

        const interval = setInterval(updateTime, 10000);

        return () => clearInterval(interval);
    }, [data, mounted]);

    const statusMessage = loading || !mounted ? UI_TEXT.COMMON.LOADING : UI_TEXT.SCHEDULE.NO_SERVICE;
    const dotClass = nearestBus ? getUrgencyClass(nearestBus.minutesUntil) : "bg-gray-300 dark:bg-gray-600";

    const displayTime = useMemo(() => {
        if (!nearestBus) return "";
        const [hour, minute] = nearestBus.time.split(":");
        return hour && minute ? formatTime(hour, minute) : nearestBus.time;
    }, [nearestBus]);

    return (
        <div className="flex flex-nowrap items-center justify-between gap-2 mt-4 min-h-[32px] overflow-hidden">
            <div className="flex items-center gap-2 shrink-0">
                <div className={`h-2 w-2 rounded-full ${dotClass}`} />
                <span className={`${STYLES.INFO_TEXT} text-gray-500 dark:text-gray-400 whitespace-nowrap`}>
                    {UI_TEXT.SCHEDULE.NEXT_BUS}
                </span>
            </div>

            {nearestBus ? (
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <div className="shrink-0">
                        <Pill tone="soft" size="sm">
                            {UI_TEXT.TIME.FORMAT_REMAINING(nearestBus.minutesUntil)}
                        </Pill>
                    </div>

                    <button
                        onClick={onToggle}
                        className="transition-transform active:scale-95 focus:outline-none shrink min-w-0"
                        aria-label="Toggle Schedule"
                    >
                        <Pill tone={isOpen ? "solid" : "soft"} size="sm">
                            <div className="flex items-center truncate">
                                <span className="font-bold truncate">{nearestBus.destination}</span>
                                <span className="ml-1 opacity-90 whitespace-nowrap">{displayTime}</span>
                                <svg
                                    className={`w-3 h-3 ml-1.5 opacity-70 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </Pill>
                    </button>
                </div>
            ) : (
                <span className={`${STYLES.INFO_TEXT} text-gray-400 dark:text-gray-500 truncate`}>{statusMessage}</span>
            )}
        </div>
    );
};

//-------------------------------------------------------------------
// Main Component
//-------------------------------------------------------------------

export default function BusList({ routeNames, allRoutes, selectedRoute, onRouteChange }: BusListProps) {
    const { map } = useBusContext();
    const [routesData, setRoutesData] = useState<Record<string, RouteData>>({});
    const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel>(null);

    const { data: scheduleData, loading: scheduleLoading, missing: scheduleMissing } = useScheduleData(selectedRoute);

    const isBusExpanded = expandedPanel === "bus";
    const isScheduleExpanded = expandedPanel === "schedule";
    const schedulePayload = scheduleData?.schedule;
    const hasScheduleData = Boolean(
        schedulePayload && (schedulePayload.general || schedulePayload.weekday || schedulePayload.weekend)
    );
    const showSchedule = !scheduleMissing && (scheduleLoading || hasScheduleData);

    useEffect(() => {
        if (expandedPanel === "schedule" && !hasScheduleData) {
            setExpandedPanel(null);
        }
    }, [expandedPanel, hasScheduleData]);

    // Handlers
    const handleRouteChange = useCallback((route: string) => {
        setRoutesData({});
        onRouteChange(route);
    }, [onRouteChange]);

    const togglePanel = useCallback((panel: "bus" | "schedule") => {
        setExpandedPanel((prev) => (prev === panel ? null : panel));
    }, []);

    const handleDataUpdate = useCallback((name: string, data: RouteData) => {
        setRoutesData((prev) => {
            if (prev[name]?.sortedList === data.sortedList && prev[name]?.error === data.error) return prev;
            return { ...prev, [name]: data };
        });
    }, []);

    const handleBusClick = useCallback((lat: number, lng: number) => {
        map?.flyTo([lat, lng], map.getZoom(), {
            animate: true,
            duration: MAP_SETTINGS.ANIMATION.FLY_TO_MS / 1000,
        });
    }, [map]);

    const setMapScroll = useCallback((enabled: boolean) => {
        if (!map?.scrollWheelZoom) return;
        if (enabled) {
            map.scrollWheelZoom.enable();
        } else {
            map.scrollWheelZoom.disable();
        }
    }, [map]);

    // UI State Logic
    const allBuses = useMemo(() => {
        return routeNames
            .map(name => routesData[name] ? { routeName: name, ...routesData[name] } : null)
            .filter((item): item is { routeName: string } & RouteData => item !== null)
            .flatMap(({ routeName, sortedList, getDirection }) =>
                sortedList.map(bus => ({ bus, routeName, getDirection }))
            );
    }, [routeNames, routesData]);

    const uiState = useMemo(() => {
        const activeData = routeNames.map(n => routesData[n]).filter(Boolean);
        const anyError = activeData.find(d => d.error !== null)?.error || null;
        const isLoading = activeData.length === 0 || activeData.some(d => !d.hasFetched);

        return {
            statusText: anyError ? getBusErrorMessage(anyError) : (isLoading ? UI_TEXT.COMMON.LOADING : UI_TEXT.BUS_LIST.COUNT_RUNNING(allBuses.length)),
            dotClass: anyError ? "bg-red-500" : (isLoading ? "bg-blue-400" : "bg-green-500"),
            isNoData: allBuses.length === 0
        };
    }, [routeNames, routesData, allBuses.length]);

    return (
        <>
            {routeNames.map((name) => (
                <RouteDataCollector key={name} routeName={name} onDataUpdate={handleDataUpdate} />
            ))}

            <div
                className={STYLES.CONTAINER}
                onWheel={(e) => e.stopPropagation()}
                onMouseEnter={() => setMapScroll(false)}
                onMouseLeave={() => setMapScroll(true)}
            >
                <div className={STYLES.HEADER}>
                    {/* Combined Title & Selector */}
                    <div>
                        <div className={STYLES.SELECT_WRAPPER}>
                            <select
                                value={selectedRoute}
                                onChange={(e) => handleRouteChange(e.target.value)}
                                className={STYLES.SELECT_ELEMENT}
                            >
                                {allRoutes.filter(Boolean).map((route) => (
                                    <option key={route} value={route} className="text-black font-sans">
                                        {UI_TEXT.BUS_LIST.TITLE_ROUTE(route)}
                                    </option>
                                ))}
                            </select>
                            <div className={STYLES.SELECT_ICON}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                                    fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                                    strokeLinejoin="round">
                                    <path d="m6 9 6 6 6-6" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Schedule Preview */}
                    {showSchedule && (
                        <SchedulePreview
                            data={scheduleData}
                            loading={scheduleLoading}
                            isOpen={isScheduleExpanded}
                            onToggle={() => togglePanel("schedule")}
                        />
                    )}

                    {/* Action Row */}
                    <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full animate-pulse ${uiState.dotClass}`} />
                            <p className={`${STYLES.INFO_TEXT} text-gray-500 dark:text-gray-400`}>{uiState.statusText}</p>
                        </div>
                        <button onClick={() => togglePanel("bus")} className="focus:outline-none active:scale-95 transition-transform">
                            <Pill tone={isBusExpanded ? "solid" : "soft"} size="sm">
                                {isBusExpanded ? UI_TEXT.NAV.HIDE_LIST : UI_TEXT.NAV.SHOW_LIST}
                            </Pill>
                        </button>
                    </div>
                </div>

                {/* Expandable Content */}
                {isScheduleExpanded && showSchedule && hasScheduleData && scheduleData && (
                    <div className={STYLES.SCHEDULE_CONTAINER}>
                        <ScheduleView data={scheduleData} mode="full" />
                    </div>
                )}

                {isBusExpanded && (
                    <ul className={STYLES.LIST_CONTAINER}>
                        {uiState.isNoData ? (
                            <li className="text-center py-6 text-gray-400 dark:text-gray-500 text-xs font-medium italic">
                                {UI_TEXT.BUS_LIST.NO_RUNNING_DESC}
                            </li>
                        ) : (
                            allBuses.map(({ bus, routeName, getDirection }) => (
                                <BusListItem
                                    key={`${routeName}-${bus.vehicleno}`}
                                    bus={bus}
                                    routeName={routeName}
                                    getDirection={getDirection}
                                    onClick={handleBusClick}
                                />
                            ))
                        )}
                    </ul>
                )}
            </div>
        </>
    );
}
