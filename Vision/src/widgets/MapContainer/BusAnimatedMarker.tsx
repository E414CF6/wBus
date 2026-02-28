"use client";

import { MAP_SETTINGS } from "@core/constants/env";

import { useAnimatedPosition } from "@shared/hooks/useAnimatedPosition";
import L from "@shared/lib/leafletSetup";

import { normalizeAngle } from "@shared/utils/geo";
import type { DivIcon, Icon, LatLngTuple, LeafletEventHandlerFnMap } from "leaflet";
import { memo, useRef } from "react";
import BusRotatedMarker from "./BusRotatedMarker";

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
 * Optimized with direct Leaflet marker updates to bypass React re-renders during animation.
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
    // Ref to Leaflet marker for direct DOM updates (bypasses React)
    const markerRef = useRef<L.Marker | null>(null);

    // Hook handles the interpolation loop (requestAnimationFrame)
    // Now with direct marker updates for smoother animation
    const {position: animatedPosition, angle: animatedAngle} = useAnimatedPosition(
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
            // Pass marker ref for direct DOM updates during animation
            markerRef,
        }
    );

    return (
        <BusRotatedMarker
            ref={markerRef}
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
