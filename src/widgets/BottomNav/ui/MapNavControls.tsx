"use client";

import React, {memo, useState} from "react";
import {Bus, ChevronDown} from "lucide-react";
import {UI_TEXT} from "@shared/config/locale";
import {RouteSelectModal} from "@features/map-view/RouteSelectModal";
import {YONSEI_ROUTE_SET} from "@entities/route/routeMetadata";
import type {BusItem, LiveConnectionStatus} from "@entities/bus/types";

interface MapNavControlsProps {
    allRoutes?: string[];
    selectedRoute?: string;
    onSelectRoute?: (route: string) => void;
    runningBuses?: BusItem[];
    connectionStatus?: LiveConnectionStatus;
    hasFetched?: boolean;
    isBusListOpen?: boolean;
    onToggleBusList?: () => void;
}

export const MapNavControls = memo(function MapNavControls({
                                                               allRoutes = [],
                                                               selectedRoute = "",
                                                               onSelectRoute,
                                                               runningBuses = [],
                                                               connectionStatus = "connected",
                                                               hasFetched = true,
                                                               isBusListOpen: controlledBusListOpen,
                                                               onToggleBusList,
                                                           }: MapNavControlsProps) {
    const [internalBusListOpen, setInternalBusListOpen] = useState(false);
    const [isRoutePickerOpen, setIsRoutePickerOpen] = useState(false);

    const isBusListOpen = controlledBusListOpen !== undefined ? controlledBusListOpen : internalBusListOpen;
    const handleToggleBusList = onToggleBusList ?? (() => setInternalBusListOpen((prev) => !prev));

    const isYonseiSelected = YONSEI_ROUTE_SET.has(selectedRoute);
    const isConnecting = !hasFetched || connectionStatus === "connecting";

    return (
        <>
            {/* Route Selection Modal Sheet (Search, Categories, Grid) */}
            <RouteSelectModal
                isOpen={isRoutePickerOpen}
                onClose={() => setIsRoutePickerOpen(false)}
                allRoutes={allRoutes}
                selectedRoute={selectedRoute}
                onSelectRoute={(route) => {
                    onSelectRoute?.(route);
                    setIsRoutePickerOpen(false);
                }}
            />

            {/* Route Selector Button */}
            <button
                type="button"
                onClick={() => setIsRoutePickerOpen(true)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-extrabold tracking-tight transition-all duration-200 cursor-pointer select-none active:scale-95 shrink-0 animate-fadeIn shadow-xs ${
                    isYonseiSelected
                        ? "bg-[#003876]/15 dark:bg-[#003876]/35 hover:bg-[#003876]/25 border border-[#003876]/40 text-[#003876] dark:text-blue-300"
                        : "bg-blue-600/10 dark:bg-blue-500/15 hover:bg-blue-600/20 dark:hover:bg-blue-500/25 border border-blue-500/30 text-blue-700 dark:text-blue-300"
                }`}
                title="노선 선택 (검색/목록)"
            >
                <Bus className="w-3.5 h-3.5"/>
                <span className="whitespace-nowrap font-black">{selectedRoute || "노선"}번</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70"/>
            </button>

            {/* Running Bus List Toggle Button (Mobile Only: on desktop the left panel is always displayed) */}
            <button
                type="button"
                onClick={handleToggleBusList}
                className={`flex md:hidden items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 shrink-0 animate-fadeIn ${
                    isBusListOpen
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                        : isConnecting
                            ? "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                            : runningBuses.length > 0
                                ? "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                : "bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 border border-black/5 dark:border-white/10"
                }`}
                title={UI_TEXT.NAV.BUS_LIST_LABEL}
            >
                <Bus className="w-3.5 h-3.5 shrink-0"/>
                <span className="whitespace-nowrap">
                    {isConnecting
                        ? "연결 중..."
                        : runningBuses.length > 0
                            ? UI_TEXT.BOTTOM_NAV.RUNNING_LIST_BTN(runningBuses.length)
                            : "운행 종료 (0)"}
                </span>
            </button>
        </>
    );
});
