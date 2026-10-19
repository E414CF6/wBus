"use client";

import React, {memo} from "react";
import BusMarker from "./BusMarker";
import BusRoutePolyline from "./BusRoutePolyline";
import BusStopMarker from "./BusStopMarker";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface RouteLayerProps {
    routeName: string;
    onRouteChange?: (routeName: string) => void;
    onOpenScheduleModal?: (docOrSubTab?: string) => void;
    enabled?: boolean;
    selectedDirection?: "all" | "up" | "down";
    cityCode?: string;
    showNearbyStops?: boolean;
    focusedStopId?: string | null;
    onClearFocusedStop?: () => void;
}

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------

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
                             cityCode,
                             showNearbyStops = true,
                             focusedStopId = null,
                             onClearFocusedStop,
                         }: RouteLayerProps) => {
    return (<>
        <BusMarker routeName={routeName} enabled={enabled} cityCode={cityCode}/>
        <BusStopMarker
            routeName={routeName}
            onRouteChange={onRouteChange}
            onOpenScheduleModal={onOpenScheduleModal}
            cityCode={cityCode}
            showNearbyStops={showNearbyStops}
            focusedStopId={focusedStopId}
            onClearFocusedStop={onClearFocusedStop}
        />
        <BusRoutePolyline routeName={routeName} selectedDirection={selectedDirection} cityCode={cityCode}/>
    </>);
}, (prev, next) => {
    return (
        prev.routeName === next.routeName &&
        prev.onRouteChange === next.onRouteChange &&
        prev.onOpenScheduleModal === next.onOpenScheduleModal &&
        prev.enabled === next.enabled &&
        prev.selectedDirection === next.selectedDirection &&
        prev.cityCode === next.cityCode &&
        prev.showNearbyStops === next.showNearbyStops &&
        prev.focusedStopId === next.focusedStopId &&
        prev.onClearFocusedStop === next.onClearFocusedStop
    );
});

RouteLayer.displayName = "RouteLayer";

export default RouteLayer;

