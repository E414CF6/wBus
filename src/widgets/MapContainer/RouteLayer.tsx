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
    enabled?: boolean;
    selectedDirection?: "all" | "up" | "down";
    cityCode?: string;
}

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------

/**
 * Renders all map layers for a single route (markers, stops, polyline).
 * Memoized to prevent re-rendering ALL routes when only one route's data updates.
 */
const RouteLayer = memo(({routeName, onRouteChange, enabled = true, selectedDirection = "all", cityCode}: RouteLayerProps) => {
    return (<>
        <BusMarker routeName={routeName} enabled={enabled} cityCode={cityCode}/>
        <BusStopMarker routeName={routeName} onRouteChange={onRouteChange} cityCode={cityCode}/>
        <BusRoutePolyline routeName={routeName} selectedDirection={selectedDirection} cityCode={cityCode}/>
    </>);
}, (prev, next) => {
    return (
        prev.routeName === next.routeName &&
        prev.onRouteChange === next.onRouteChange &&
        prev.enabled === next.enabled &&
        prev.selectedDirection === next.selectedDirection &&
        prev.cityCode === next.cityCode
    );
});

RouteLayer.displayName = "RouteLayer";

export default RouteLayer;
