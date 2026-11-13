"use client";

import React, {memo} from "react";
import BusMarker from "./BusMarker";
import BusRoutePolyline from "./BusRoutePolyline";
import BusStopMarker from "./BusStopMarker";
import TimetablePinMarker from "./TimetablePinMarker";
import YonseiShuttlePinMarker from "./YonseiShuttlePinMarker";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import type {DayMode} from "@shared/types/navigation";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface RouteLayerProps {
    routeName: string;
    onRouteChange?: (routeName: string) => void;
    onOpenScheduleModal?: (docOrSubTab?: string, initialLocation?: "origin" | "dest") => void;
    enabled?: boolean;
    selectedDirection?: "all" | "up" | "down";
    selectedVariantId?: string | null;
    cityCode?: string;
    showNearbyStops?: boolean;
    focusedStopId?: string | null;
    onClearFocusedStop?: () => void;
    dayMode?: DayMode;
    isTodayWeekendOrHoliday?: boolean;
}

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------

// Routes passing through Yonsei University Mirae Campus that show the shuttle bus pin
export const YONSEI_SHUTTLE_ROUTES = new Set(["30", "34", "34-1"]);

/**
 * Renders all map layers for a single route (markers, stops, and polyline).
 * Memoized to prevent re-rendering ALL routes when only one route's data updates.
 */
const RouteLayer = memo(({
                             routeName,
                             onRouteChange,
                             onOpenScheduleModal,
                             enabled = true,
                             selectedDirection = "all",
                             selectedVariantId = null,
                             cityCode,
                             showNearbyStops,
                             focusedStopId = null,
                             onClearFocusedStop,
                             dayMode,
                             isTodayWeekendOrHoliday,
                         }: RouteLayerProps) => {
    const {settings} = useAppSettings();
    const effectiveShowNearbyStops = showNearbyStops ?? settings.showNearbyStops;
    return (<>
        <BusMarker routeName={routeName} enabled={enabled} cityCode={cityCode}/>
        <BusStopMarker
            key={cityCode || "default"}
            routeName={routeName}
            onRouteChange={onRouteChange}
            enabled={enabled}
            cityCode={cityCode}
            showNearbyStops={effectiveShowNearbyStops}
            showStopLabels={settings.showStopLabels}
            focusedStopId={focusedStopId}
            onClearFocusedStop={onClearFocusedStop}
        />
        {settings.showTimetablePins && (
            <TimetablePinMarker
                routeName={routeName}
                cityCode={cityCode}
                onRouteChange={onRouteChange}
                onOpenScheduleModal={onOpenScheduleModal}
                enabled={enabled}
                dayMode={dayMode}
                isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
            />
        )}
        {cityCode === "32020" && YONSEI_SHUTTLE_ROUTES.has(routeName) && settings.showYonseiFeatures && (
            <YonseiShuttlePinMarker
                enabled={enabled && settings.showYonseiFeatures}
                dayMode={dayMode}
                isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
            />
        )}
        <BusRoutePolyline
            routeName={routeName}
            enabled={enabled}
            selectedDirection={selectedDirection}
            selectedVariantId={selectedVariantId}
            cityCode={cityCode}
        />
    </>);
}, (prev, next) => {
    return (
        prev.routeName === next.routeName &&
        prev.onRouteChange === next.onRouteChange &&
        prev.onOpenScheduleModal === next.onOpenScheduleModal &&
        prev.enabled === next.enabled &&
        prev.selectedDirection === next.selectedDirection &&
        prev.selectedVariantId === next.selectedVariantId &&
        prev.cityCode === next.cityCode &&
        prev.showNearbyStops === next.showNearbyStops &&
        prev.focusedStopId === next.focusedStopId &&
        prev.onClearFocusedStop === next.onClearFocusedStop &&
        prev.dayMode === next.dayMode &&
        prev.isTodayWeekendOrHoliday === next.isTodayWeekendOrHoliday
    );
});

RouteLayer.displayName = "RouteLayer";

export default RouteLayer;

