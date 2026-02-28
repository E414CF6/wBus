"use client";

import React, { memo } from "react";
import BusMarker from "./BusMarker";
import BusRoutePolyline from "./BusRoutePolyline";
import BusStopMarker from "./BusStopMarker";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface RouteLayerProps {
    routeName: string;
    onRouteChange?: (routeName: string) => void;
}

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------

/**
 * Renders all map layers for a single route (markers, stops, polyline).
 * Memoized to prevent re-rendering ALL routes when only one route's data updates.
 */
const RouteLayer = memo(({routeName, onRouteChange}: RouteLayerProps) => {
    return (
        <>
            <BusMarker routeName={routeName}/>
            <BusStopMarker routeName={routeName} onRouteChange={onRouteChange}/>
            <BusRoutePolyline routeName={routeName}/>
        </>
    );
}, (prev, next) => {
    return (
        prev.routeName === next.routeName &&
        prev.onRouteChange === next.onRouteChange
    );
});

RouteLayer.displayName = "RouteLayer";

export default RouteLayer;
