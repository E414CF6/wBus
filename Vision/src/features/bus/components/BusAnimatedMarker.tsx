"use client";

import { memo } from "react";

import { MAP_SETTINGS } from "@core/config/env";

import { useAnimatedPosition } from "@map/hooks/useAnimatedPosition";
import { normalizeAngle } from "@map/utils/geoUtils";

import BusRotatedMarker from "@bus/components/BusRotatedMarker";

import type { Icon, DivIcon, LeafletEventHandlerFnMap, LatLngTuple } from "leaflet";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface BusAnimatedMarkerProps {
    position: LatLngTuple;
    rotationAngle: number;
    icon: Icon | DivIcon;
    polyline?: LatLngTuple[];
    snapIndexHint?: number | null;
    snapIndexRange?: number;
    /** Animation duration in ms. Longer = smoother but more lag behind real-time data */
    animationDuration?: number;
    /** Force a re-sync when external state (like route) changes. */
    refreshKey?: string | number;
    eventHandlers?: LeafletEventHandlerFnMap;
    children?: React.ReactNode;
}

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------

/**
 * A bus marker that smoothly animates along a polyline when its position updates.
 * Uses requestAnimationFrame for smooth 60fps animation.
 */
function BusAnimatedMarker({
    position,
    rotationAngle,
    icon,
    polyline = [],
    snapIndexHint,
    snapIndexRange,
    animationDuration = MAP_SETTINGS.ANIMATION.BUS_MOVE_MS,
    refreshKey,
    eventHandlers,
    children,
}: BusAnimatedMarkerProps) {
    // Hook handles the interpolation loop (requestAnimationFrame)
    const { position: animatedPosition, angle: animatedAngle } = useAnimatedPosition(
        position,
        rotationAngle,
        {
            duration: animationDuration,
            polyline,
            // Only attempt to snap if we have a valid line segment
            snapToPolyline: polyline.length >= 2,
            resetKey: refreshKey,
            snapIndexHint,
            snapIndexRange,
        }
    );

    return (
        <BusRotatedMarker
            position={animatedPosition}
            rotationAngle={normalizeAngle(animatedAngle)}
            icon={icon}
            eventHandlers={eventHandlers}
        >
            {children}
        </BusRotatedMarker>
    );
}

// Memoize to prevent re-setup of animation hook if parent re-renders 
// without actual data changes (e.g. map zoom/pan events passing through context)
export default memo(BusAnimatedMarker);
