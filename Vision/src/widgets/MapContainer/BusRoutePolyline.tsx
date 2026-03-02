"use client";

import { APP_CONFIG, MAP_SETTINGS } from "@core/constants/env";
import { getRouteInfo } from "@entities/route/api";

import { useBusLocationData } from "@features/live-tracking/useBusLocation";
import { type PolylineSegment, useMultiPolyline } from "@features/live-tracking/usePolyline";

import { useAppMapContext } from "@shared/context/AppMapContext";
import type { FeatureCollection, LineString } from "geojson";

import { useEffect, useMemo, useRef, useState } from "react";
import { Layer, Source } from "react-map-gl/maplibre";

// ----------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------

const COLORS = {
    // Active route colors (vibrant)
    ACTIVE_UP: "#2563eb",       // Blue-600
    ACTIVE_DOWN: "#dc2626",     // Red-600
    // Inactive route colors (muted)
    INACTIVE_UP: "#bfdbfe",     // Blue-200
    INACTIVE_DOWN: "#fecaca",   // Red-200
    // Glow effect colors
    GLOW_UP: "rgba(37, 99, 235, 0.35)",
    GLOW_DOWN: "rgba(220, 38, 38, 0.35)",
} as const;

// ----------------------------------------------------------------------
// Helper Hook: useRouteIds
// ----------------------------------------------------------------------

function useRouteIds(routeName: string) {
    const [routeIds, setRouteIds] = useState<string[]>([]);

    useEffect(() => {
        let isMounted = true;

        const fetchRouteIds = async () => {
            try {
                const info = await getRouteInfo(routeName);
                if (isMounted) {
                    setRouteIds(info?.vehicleRouteIds ?? []);
                }
            } catch (error) {
                if (APP_CONFIG.IS_DEV) console.error(error);
            }
        };

        fetchRouteIds();

        return () => {
            isMounted = false;
        };
    }, [routeName]);

    return routeIds;
}

// ----------------------------------------------------------------------
// MapLibre Layer Generators
// ----------------------------------------------------------------------

function createGeoJSON(segments: PolylineSegment[]): FeatureCollection<LineString> {
    return {
        type: "FeatureCollection",
        features: segments.map((segment) => ({
            type: "Feature",
            geometry: {
                type: "LineString",
                // Convert [lat, lng] to [lng, lat] for GeoJSON
                coordinates: segment.coords.map(([lat, lng]) => [lng, lat]),
            },
            properties: {
                direction: segment.direction,
                routeIds: segment.routeIds.join("_"),
            },
        })),
    };
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

export default function BusRoutePolyline({routeName}: { routeName: string }) {
    // Data Fetching
    const {map} = useAppMapContext();
    const routeIds = useRouteIds(routeName);
    const {data: busList} = useBusLocationData(routeName);
    const lastBoundsKeyRef = useRef<string | null>(null);

    // Determine active route IDs (routes with running buses)
    const activeRouteIds = useMemo(() => {
        const validRouteIdSet = new Set(routeIds);
        const busRouteIds = busList
            .map((bus) => bus.routeid)
            .filter((id): id is string => typeof id === "string" && validRouteIdSet.has(id));
        return Array.from(new Set(busRouteIds));
    }, [busList, routeIds]);

    const {
        activeUpSegments,
        inactiveUpSegments,
        activeDownSegments,
        inactiveDownSegments,
        bounds,
    } = useMultiPolyline(routeIds, activeRouteIds);

    // Styling Logic
    const hasActiveSegments = activeUpSegments.length > 0 || activeDownSegments.length > 0;
    const isNoBusRunning = busList.length === 0;

    const displayActiveUpSegments = hasActiveSegments ? activeUpSegments : inactiveUpSegments;
    const displayActiveDownSegments = hasActiveSegments ? activeDownSegments : inactiveDownSegments;

    // Convert to GeoJSON
    const activeUpGeoJSON = useMemo(() => createGeoJSON(displayActiveUpSegments), [displayActiveUpSegments]);
    const activeDownGeoJSON = useMemo(() => createGeoJSON(displayActiveDownSegments), [displayActiveDownSegments]);

    // Fit map to bounds
    useEffect(() => {
        if (!map || !bounds) return;

        const key = bounds.flat().join(",");
        if (lastBoundsKeyRef.current === key) return;
        lastBoundsKeyRef.current = key;

        // Leaflet bounds format: [[south, west], [north, east]]
        // maplibre-gl fitBounds expects [ [west, south], [east, north] ]
        const [[s, w], [n, e]] = bounds;

        map.fitBounds([[w, s], [e, n]], {
            padding: 32,
            duration: MAP_SETTINGS.ANIMATION.FLY_TO_MS,
        });
    }, [map, bounds]);

    return (
        <>
            <Source id="polyline-up" type="geojson" data={activeUpGeoJSON}/>
            {isNoBusRunning ? (
                <Layer
                    id="polyline-up-layer"
                    source="polyline-up"
                    type="line"
                    paint={{
                        "line-color": COLORS.ACTIVE_UP,
                        "line-width": 4,
                        "line-opacity": 0.7,
                        "line-dasharray": [1.5, 2]
                    }}
                    layout={{"line-cap": "round", "line-join": "round"}}
                />
            ) : (
                <>
                    <Layer
                        id="polyline-up-glow"
                        source="polyline-up"
                        type="line"
                        paint={{
                            "line-color": COLORS.GLOW_UP,
                            "line-width": 10,
                            "line-opacity": 1,
                        }}
                        layout={{"line-cap": "round", "line-join": "round"}}
                    />
                    <Layer
                        id="polyline-up-main"
                        source="polyline-up"
                        type="line"
                        paint={{
                            "line-color": COLORS.ACTIVE_UP,
                            "line-width": 4,
                            "line-opacity": 1,
                        }}
                        layout={{"line-cap": "round", "line-join": "round"}}
                    />
                </>
            )}

            <Source id="polyline-down" type="geojson" data={activeDownGeoJSON}/>
            {isNoBusRunning ? (
                <Layer
                    id="polyline-down-layer"
                    source="polyline-down"
                    type="line"
                    paint={{
                        "line-color": COLORS.ACTIVE_DOWN,
                        "line-width": 4,
                        "line-opacity": 0.7,
                        "line-dasharray": [1.5, 2]
                    }}
                    layout={{"line-cap": "round", "line-join": "round"}}
                />
            ) : (
                <>
                    <Layer
                        id="polyline-down-glow"
                        source="polyline-down"
                        type="line"
                        paint={{
                            "line-color": COLORS.GLOW_DOWN,
                            "line-width": 10,
                            "line-opacity": 1,
                        }}
                        layout={{"line-cap": "round", "line-join": "round"}}
                    />
                    <Layer
                        id="polyline-down-main"
                        source="polyline-down"
                        type="line"
                        paint={{
                            "line-color": COLORS.ACTIVE_DOWN,
                            "line-width": 4,
                            "line-opacity": 1,
                        }}
                        layout={{"line-cap": "round", "line-join": "round"}}
                    />
                </>
            )}
        </>
    );
}
