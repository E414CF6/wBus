"use client";

import {getBusErrorMessage} from "@entities/bus/errorMessages";
import {useScheduleData} from "@entities/route/hooks";
import {formatTime, getNearestBusTime} from "@entities/route/time";

import type {BusSchedule} from "@entities/route/types";

import {useBusSortedList} from "@features/live-tracking/useBusSortedList";
import {MAP_SETTINGS} from "@shared/config/env";
import {UI_TEXT} from "@shared/config/locale";

import {useAppMapContext} from "@shared/context/AppMapContext";

import LiveStatusBadge from "@shared/ui/LiveStatusBadge";

import React, {useCallback, useEffect, useMemo, useState} from "react";

import {useNoticeList} from "@entities/notice/hooks";
import {NoticeModal} from "@widgets/NoticeWidget";
import {Calendar, Megaphone} from "lucide-react";

import {BusListItem} from "./BusListItem";
import ScheduleView from "./BusScheduleView";

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

const getUrgencyClass = (minutes: number): string => {
    if (minutes <= 3) return "bg-red-500 animate-pulse";
    if (minutes <= 10) return "bg-amber-500";
    return "bg-emerald-500";
};

const STYLES = {
    CONTAINER: "w-full max-w-sm backdrop-blur-2xl bg-white/80 dark:bg-[#121212]/80 border border-black/10 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)] rounded-[28px] overflow-hidden transition-all duration-300 pointer-events-auto",
    HEADER: "px-4 pt-4 pb-3.5 bg-transparent",
    SELECT_WRAPPER: "relative flex items-center group transition-all duration-200 bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] rounded-[20px] px-3.5 py-2.5",
    SELECT_ELEMENT: "appearance-none bg-transparent text-lg font-extrabold text-black dark:text-white pr-7 cursor-pointer focus:outline-none z-10 w-full tracking-tight",
    SELECT_ICON: "absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-black/30 dark:text-white/30 group-hover:text-black/50 dark:group-hover:text-white/50 transition-colors",
    INFO_TEXT: "text-[11px] font-bold tracking-tight",
    LIST_CONTAINER: "text-sm text-black dark:text-white max-h-[35svh] overflow-y-auto px-2.5 pb-3.5 space-y-1.5 custom-scrollbar",
    SCHEDULE_CONTAINER: "max-h-[45svh] overflow-y-auto px-4 py-3.5 text-black dark:text-white custom-scrollbar",
};

//-------------------------------------------------------------------
// Sub-Components
//-------------------------------------------------------------------

const RouteDataCollector = React.memo(({
                                           routeName, onDataUpdate
                                       }: {
    routeName: string; onDataUpdate: (name: string, data: RouteData) => void
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

const SchedulePreview = ({data, loading, isOpen, onToggle}: SchedulePreviewProps) => {
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
        <div className="flex items-center justify-between gap-1.5 mt-3 pt-0.5 max-w-full overflow-hidden">
            {/* Next Bus Arrival Info Badge */}
            <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-tight bg-black/[0.04] dark:bg-white/[0.06] border border-black/5 dark:border-white/10 backdrop-blur-md shadow-xs min-w-0 flex-1 overflow-hidden">
                <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${dotClass}`}/>
                </span>

                <span className="dark:text-gray-400 font-bold whitespace-nowrap shrink-0">
                    {UI_TEXT.SCHEDULE.NEXT_BUS}
                </span>

                {nearestBus ? (
                    <div className="flex items-center gap-1 min-w-0 truncate">
                        <span className="dark:text-gray-100 font-extrabold whitespace-nowrap">
                            {UI_TEXT.TIME.FORMAT_REMAINING(nearestBus.minutesUntil)}
                        </span>
                        <span
                            className="dark:text-gray-400 font-medium whitespace-nowrap flex items-center gap-1 truncate">
                            <span className="opacity-30 font-normal">•</span>
                            <span className="font-semibold truncate">{nearestBus.destination}</span>
                            <span className="font-mono text-[10px] opacity-80 pl-0.5">{displayTime}</span>
                        </span>
                    </div>
                ) : (
                    <span className="dark:text-gray-400 font-medium whitespace-nowrap truncate">
                        • {statusMessage}
                    </span>
                )}
            </div>

            {/* Dedicated Schedule Timetable Toggle Button */}
            <button
                type="button"
                onClick={onToggle}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-tight transition-all duration-200 ${
                    isOpen
                        ? "bg-indigo-500/10 dark:bg-indigo-400/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 dark:border-indigo-400/30 shadow-xs"
                        : "bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] text-gray-700 dark:text-gray-300 border border-black/5 dark:border-white/10 shadow-xs"
                } backdrop-blur-md active:scale-95 cursor-pointer shrink-0 ml-1`}
                aria-label={UI_TEXT.ACCESSIBILITY.TOGGLE_SCHEDULE}
            >
                <Calendar className="w-3 h-3 stroke-[2.2] dark:text-indigo-400"/>
                <span className="whitespace-nowrap">{UI_TEXT.SCHEDULE.SHOW_DETAILS}</span>
                <svg
                    className={`w-3 h-3 ml-0.5 opacity-70 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
            </button>
        </div>
    );
};

//-------------------------------------------------------------------
// Main Component
//-------------------------------------------------------------------

export default function BusList({routeNames, allRoutes, selectedRoute, onRouteChange}: BusListProps) {
    const {map} = useAppMapContext();
    const [routesData, setRoutesData] = useState<Record<string, RouteData>>({});
    const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel>(null);
    const [isNoticeOpen, setIsNoticeOpen] = useState(false);

    const {data: noticeData} = useNoticeList(1);
    const hasUnreadNotice = useMemo(() => {
        if (!noticeData?.notices || noticeData.notices.length === 0) return false;
        return noticeData.notices.some((n) => n.isNotice);
    }, [noticeData]);

    const {data: scheduleData, loading: scheduleLoading, missing: scheduleMissing} = useScheduleData(selectedRoute);

    const isBusExpanded = expandedPanel === "bus";
    const isScheduleExpanded = expandedPanel === "schedule";
    const schedulePayload = scheduleData?.schedule;
    const hasScheduleData = Boolean(schedulePayload && (schedulePayload.general || schedulePayload.weekday || schedulePayload.weekend));
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
            const current = prev[name];
            if (current && current.sortedList === data.sortedList && current.error === data.error && current.hasFetched === data.hasFetched) {
                return prev;
            }
            return {...prev, [name]: data};
        });
    }, []);

    const handleBusClick = useCallback((lat: number, lng: number) => {
        map?.flyTo({
            center: [lng, lat], zoom: map.getZoom(), duration: MAP_SETTINGS.ANIMATION.FLY_TO_MS,
        });
    }, [map]);

    const setMapScroll = useCallback((enabled: boolean) => {
        if (!map?.scrollZoom) return;
        if (enabled) {
            map.scrollZoom.enable();
        } else {
            map.scrollZoom.disable();
        }
    }, [map]);

    // UI State Logic
    const allBuses = useMemo(() => {
        return routeNames
            .map(name => routesData[name] ? {routeName: name, ...routesData[name]} : null)
            .filter((item): item is { routeName: string } & RouteData => item !== null)
            .flatMap(({routeName, sortedList, getDirection}) => sortedList.map(bus => ({
                bus, routeName, getDirection
            })));
    }, [routeNames, routesData]);

    const uiState = useMemo(() => {
        const activeData = routeNames.map(n => routesData[n]).filter(Boolean);
        const anyError = activeData.find(d => d.error !== null)?.error || null;
        const isLoading = activeData.length === 0 || activeData.some(d => !d.hasFetched);
        const connectionStatus = activeData[0]?.connectionStatus || "connecting";
        const lastUpdated = activeData[0]?.lastUpdated || null;
        const isDegraded = activeData.some(d => d.isDegraded);
        const reconnect = activeData[0]?.reconnect;

        let countText = "";
        if (anyError) {
            countText = getBusErrorMessage(anyError);
        } else if (isLoading) {
            countText = UI_TEXT.COMMON.LOADING;
        } else {
            countText = UI_TEXT.BUS_LIST.COUNT_RUNNING(allBuses.length);
        }

        return {
            countText,
            isNoData: allBuses.length === 0,
            connectionStatus,
            lastUpdated,
            isDegraded,
            reconnect,
        };
    }, [routeNames, routesData, allBuses.length]);

    return (<>
        {routeNames.map((name) => (<RouteDataCollector key={name} routeName={name} onDataUpdate={handleDataUpdate}/>))}

        <div
            className={STYLES.CONTAINER}
            onWheel={(e) => e.stopPropagation()}
            onMouseEnter={() => setMapScroll(false)}
            onMouseLeave={() => setMapScroll(true)}
        >
            <div className={STYLES.HEADER}>
                {/* Row 1: Combined Title & Selector + Notice Header */}
                <div className="flex items-center justify-between gap-2">
                    <div className={`${STYLES.SELECT_WRAPPER} flex-1 min-w-0`}>
                        <select
                            value={selectedRoute}
                            onChange={(e) => handleRouteChange(e.target.value)}
                            className={STYLES.SELECT_ELEMENT}
                            aria-label={UI_TEXT.BUS_LIST.TITLE_ALL}
                        >
                            {allRoutes.filter(Boolean).map((route) => (
                                <option key={route} value={route} className="text-black bg-white font-sans">
                                    {UI_TEXT.BUS_LIST.TITLE_ROUTE(route)}
                                </option>
                            ))}
                        </select>
                        <div className={STYLES.SELECT_ICON}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                 fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                                 strokeLinejoin="round">
                                <path d="m6 9 6 6 6-6"/>
                            </svg>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsNoticeOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-[20px] text-xs font-bold tracking-tight transition-all duration-200 bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] border border-black/5 dark:border-white/10 text-gray-900 dark:text-white backdrop-blur-md shadow-xs active:scale-95 cursor-pointer shrink-0"
                        aria-label={UI_TEXT.NAV.NOTICE_OPEN_ARIA}
                    >
                        <div
                            className="relative flex items-center justify-center shrink-0 dark:text-amber-400">
                            <Megaphone className="w-3.5 h-3.5 stroke-[2.2]"/>
                            {hasUnreadNotice && (
                                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                    <span
                                        className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"/>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"/>
                                </span>
                            )}
                        </div>
                        <span className="whitespace-nowrap">{UI_TEXT.NOTICE.SECTION_TITLE}</span>
                    </button>
                </div>

                {/* Row 2: Schedule Preview */}
                {showSchedule && (
                    <SchedulePreview
                        data={scheduleData}
                        loading={scheduleLoading}
                        isOpen={isScheduleExpanded}
                        onToggle={() => togglePanel("schedule")}
                    />
                )}

                {/* Row 3: Telemetry Live Status Badge + Bus List Toggle */}
                <div className="flex items-center justify-between mt-3 pt-0.5">
                    <LiveStatusBadge
                        countText={uiState.countText}
                        connectionStatus={uiState.connectionStatus}
                        lastUpdated={uiState.lastUpdated}
                        isDegraded={uiState.isDegraded}
                        onReconnect={uiState.reconnect}
                    />
                    <button
                        type="button"
                        onClick={() => togglePanel("bus")}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-tight transition-all duration-200 ${
                            isBusExpanded
                                ? "bg-indigo-500/10 dark:bg-indigo-400/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 dark:border-indigo-400/30 shadow-xs"
                                : "bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] text-gray-700 dark:text-gray-300 border border-black/5 dark:border-white/10 shadow-xs"
                        } backdrop-blur-md active:scale-95 cursor-pointer shrink-0 ml-2`}
                        aria-label={UI_TEXT.NAV.BUS_LIST_LABEL}
                    >
                        <span>{UI_TEXT.NAV.BUS_LIST_LABEL}</span>
                        <svg
                            className={`w-3 h-3 ml-0.5 opacity-70 transition-transform duration-200 shrink-0 ${isBusExpanded ? "rotate-180" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                        </svg>
                    </button>
                </div>
            </div>

            {/* Expandable Content */}
            {isScheduleExpanded && showSchedule && hasScheduleData && scheduleData && (
                <div className={STYLES.SCHEDULE_CONTAINER}>
                    <ScheduleView data={scheduleData} mode="full"/>
                </div>)}

            {isBusExpanded && (<ul className={STYLES.LIST_CONTAINER}>
                {uiState.isNoData ? (<li className="text-center py-6 text-gray-400 text-xs font-medium italic">
                    {UI_TEXT.BUS_LIST.NO_RUNNING_DESC}
                </li>) : (allBuses.map(({bus, routeName, getDirection}) => (<BusListItem
                    key={`${routeName}-${bus.vehicleno}`}
                    bus={bus}
                    routeName={routeName}
                    getDirection={getDirection}
                    onClick={handleBusClick}
                />)))}
            </ul>)}

            {/* Notice Modal */}
            <NoticeModal
                isOpen={isNoticeOpen}
                onClose={() => setIsNoticeOpen(false)}
            />
        </div>
    </>);
}
