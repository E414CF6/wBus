"use client";

import React, {memo} from "react";
import BusMarker from "./BusMarker";
import BusRoutePolyline from "./BusRoutePolyline";
import BusStopMarker from "./BusStopMarker";
import {TimetableMapPins} from "./TimetableMapPin";
import type {TimetableSubTab} from "@shared/types/navigation";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface RouteLayerProps {
    routeName: string;
    onRouteChange?: (routeName: string) => void;
    onOpenScheduleModal?: (subTab?: TimetableSubTab) => void;
    enabled?: boolean;
    selectedDirection?: "all" | "up" | "down";
    cityCode?: string;
}

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------

/**
 * Renders all map layers for a single route (markers, stops, polyline, and timetable hub pins).
 * Memoized to prevent re-rendering ALL routes when only one route's data updates.
 */
const RouteLayer = memo(({
                             routeName,
                             onRouteChange,
                             onOpenScheduleModal,
                             enabled = true,
                             selectedDirection = "all",
                             cityCode,
                         }: RouteLayerProps) => {
    const isWonju = !cityCode || cityCode === "32020";

    return (<>
        <BusMarker routeName={routeName} enabled={enabled} cityCode={cityCode}/>
        <BusStopMarker
            routeName={routeName}
            onRouteChange={onRouteChange}
            onOpenScheduleModal={onOpenScheduleModal}
            cityCode={cityCode}
        />
        <BusRoutePolyline routeName={routeName} selectedDirection={selectedDirection} cityCode={cityCode}/>
        {onOpenScheduleModal && (
            <TimetableMapPins isWonju={isWonju} onOpenScheduleModal={onOpenScheduleModal}/>
        )}
    </>);
}, (prev, next) => {
    return (
        prev.routeName === next.routeName &&
        prev.onRouteChange === next.onRouteChange &&
        prev.onOpenScheduleModal === next.onOpenScheduleModal &&
        prev.enabled === next.enabled &&
        prev.selectedDirection === next.selectedDirection &&
        prev.cityCode === next.cityCode
    );
});

RouteLayer.displayName = "RouteLayer";

export default RouteLayer;

