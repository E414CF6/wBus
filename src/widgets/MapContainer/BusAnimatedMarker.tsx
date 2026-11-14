"use client";

import {MAP_SETTINGS} from "@shared/config/env";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {type Coordinate, normalizeAngle} from "@shared/utils/geo";

import {useAnimatedPosition} from "@shared/animation";

import React, {memo, useCallback, useEffect, useRef} from "react";
import {Marker} from "react-map-gl/maplibre";
import type {Marker as MapLibreMarker} from "maplibre-gl";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface BusAnimatedMarkerProps {
    position: Coordinate;
    rotationAngle: number;
    polyline?: Coordinate[];
    snapIndexHint?: number | null;
    snapIndexRange?: number;
    /** Animation duration in milliseconds. Longer = smoother but more lag behind real-time data */
    animationDuration?: number;
    /** Polling interval in milliseconds. Used for velocity-based forward projection. */
    pollingIntervalMs?: number;
    /** Estimated data delay in milliseconds. How old the API data is when received. */
    dataDelayMs?: number;
    /** Polyline coordinate indices where bus stops are located. */
    stopCoordIndices?: number[];
    /** Force a re-sync when the external state (like route) changes. */
    refreshKey?: string | number;
    onClick?: () => void;
    /** Optional callback when animated position updates (used for real-time Popup & Camera tracking) */
    onPositionChange?: (position: Coordinate) => void;
    /** Optional directional overlay rotated at 60fps without rotating children */
    headingOverlay?: React.ReactNode;
    /** Wrapper class for sizing/highlighting both heading overlay and upright children */
    wrapperClassName?: string;
    children?: React.ReactNode;
}

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------

/**
 * A bus marker that smoothly animates along a polyline when its position updates.
 * Uses requestAnimationFrame for smooth 60fps animation.
 * Separates directional heading rotation (headingOverlay) from upright route badge rendering (children).
 */
function BusAnimatedMarker({
                               position,
                               rotationAngle,
                               polyline = [],
                               snapIndexHint,
                               snapIndexRange,
                               animationDuration = MAP_SETTINGS.ANIMATION.BUS_MOVE_MS,
                               pollingIntervalMs,
                               dataDelayMs,
                               stopCoordIndices,
                               refreshKey,
                               onClick,
                               onPositionChange,
                               headingOverlay,
                               wrapperClassName,
                               children,
                           }: BusAnimatedMarkerProps) {
    // Ref to MapLibre marker for direct DOM updates (bypasses React)
    const markerRef = useRef<MapLibreMarker | null>(null);
    const headingRef = useRef<HTMLDivElement | null>(null);
    const {map} = useAppMapContext();

    const getMapBearing = useCallback(() => {
        try {
            return map?.getBearing() ?? 0;
        } catch {
            return 0;
        }
    }, [map]);

    const handleDirectAngle = useCallback(
        (angle: number) => {
            const el = headingRef.current;
            if (!el) return;
            const bearing = getMapBearing();
            el.style.transform = `rotate(${normalizeAngle(angle - bearing)}deg)`;
        },
        [getMapBearing]
    );

    // Hook handles the interpolation loop (requestAnimationFrame)
    // Now with direct marker & heading updates for smoother animation
    const {position: animatedPosition, angle: animatedAngle} = useAnimatedPosition(position, rotationAngle, {
        duration: animationDuration,
        polyline,
        snapToPolyline: polyline.length >= 2,
        resetKey: refreshKey,
        snapIndexHint,
        snapIndexRange,
        markerRef,
        onDirectAngle: headingOverlay ? handleDirectAngle : undefined,
        pollingIntervalMs,
        dataDelayMs,
        stopCoordIndices,
    });

    // Keep heading cone synchronized on initial mount and whenever map viewport rotates
    useEffect(() => {
        if (!headingOverlay) return;
        const syncHeading = () => {
            handleDirectAngle(animatedAngle);
        };
        syncHeading();

        if (!map) return;
        map.on("rotate", syncHeading);
        return () => {
            map.off("rotate", syncHeading);
        };
    }, [animatedAngle, handleDirectAngle, headingOverlay, map]);

    const onPositionChangeRef = useRef(onPositionChange);
    useEffect(() => {
        onPositionChangeRef.current = onPositionChange;
    }, [onPositionChange]);

    const prevReportedPosRef = useRef<Coordinate | null>(null);

    // Notify parent if live animated position changes (throttled to >=50ms by useAnimatedPosition)
    useEffect(() => {
        if (!onPositionChangeRef.current) return;
        const prev = prevReportedPosRef.current;
        if (
            prev &&
            Math.abs(prev[0] - animatedPosition[0]) < 0.00003 &&
            Math.abs(prev[1] - animatedPosition[1]) < 0.00003
        ) {
            return;
        }
        prevReportedPosRef.current = animatedPosition;
        onPositionChangeRef.current(animatedPosition);
    }, [animatedPosition]);

    const handleMarkerClick = (e: { originalEvent?: Event }) => {
        if (e.originalEvent) {
            e.originalEvent.stopPropagation();
        }
        onClick?.();
    };

    return (<Marker
        ref={markerRef}
        longitude={animatedPosition[1]}
        latitude={animatedPosition[0]}
        rotation={headingOverlay ? 0 : normalizeAngle(animatedAngle)}
        rotationAlignment={headingOverlay ? "viewport" : "map"}
        onClick={handleMarkerClick}
        anchor="center"
        style={{pointerEvents: "auto", zIndex: 35}}
    >
        {headingOverlay ? (
            <div className={wrapperClassName}>
                <div
                    ref={headingRef}
                    className="absolute inset-0 pointer-events-none will-change-transform"
                    style={{transformOrigin: "center center"}}
                >
                    {headingOverlay}
                </div>
                {children}
            </div>
        ) : (
            children
        )}
    </Marker>);
}

// Memoize to prevent re-setup of an animation hook if the parent re-renders
// without actual data changes (e.g., map zoom/pan events passing through context)
export default memo(BusAnimatedMarker);
