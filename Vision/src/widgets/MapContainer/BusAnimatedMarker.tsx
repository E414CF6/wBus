"use client";

import { MAP_SETTINGS } from "@core/constants/env";

import { useAnimatedPosition } from "@shared/hooks/useAnimatedPosition";
import { type Coordinate, normalizeAngle } from "@shared/utils/geo";
import type { Marker as MapLibreMarker } from "maplibre-gl";
import { memo, useRef } from "react";
import { Marker } from "react-map-gl/maplibre";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface BusAnimatedMarkerProps {
    position: Coordinate;
    rotationAngle: number;
    polyline?: Coordinate[];
    snapIndexHint?: number | null;
    snapIndexRange?: number;
    /** Animation duration in ms. Longer = smoother but more lag behind real-time data */
    animationDuration?: number;
    /** Force a re-sync when external state (like route) changes. */
    refreshKey?: string | number;
    onClick?: () => void;
    children?: React.ReactNode;
}

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------

/**
 * A bus marker that smoothly animates along a polyline when its position updates.
 * Uses requestAnimationFrame for smooth 60fps animation.
 * Optimized with direct MapLibre marker updates to bypass React re-renders during animation.
 */
function BusAnimatedMarker({
                               position,
                               rotationAngle,
                               polyline = [],
                               snapIndexHint,
                               snapIndexRange,
                               animationDuration = MAP_SETTINGS.ANIMATION.BUS_MOVE_MS,
                               refreshKey,
                               onClick,
                               children,
                           }: BusAnimatedMarkerProps) {
    // Ref to MapLibre marker for direct DOM updates (bypasses React)
    const markerRef = useRef<MapLibreMarker | null>(null);

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

    const handleMarkerClick = (e: any) => {
        if (e.originalEvent) {
            e.originalEvent.stopPropagation();
        }
        onClick?.();
    };

    return (
        <Marker
            ref={markerRef}
            longitude={animatedPosition[1]}
            latitude={animatedPosition[0]}
            rotation={normalizeAngle(animatedAngle)}
            onClick={handleMarkerClick}
            anchor="center"
            style={{pointerEvents: 'auto'}}
        >
            {children}
        </Marker>
    );
}

// Memoize to prevent re-setup of animation hook if parent re-renders 
// without actual data changes (e.g. map zoom/pan events passing through context)
export default memo(BusAnimatedMarker);
