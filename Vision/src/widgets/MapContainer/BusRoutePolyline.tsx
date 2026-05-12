"use client";

import {useRouteIds} from "@entities/route/hooks";

import {useBusLocationData} from "@features/live-tracking/useBusLocation";
import {type PolylineSegment, useMultiPolyline} from "@features/live-tracking/usePolyline";

import {MAP_SETTINGS} from "@shared/config/env";

import {useAppMapContext} from "@shared/context/AppMapContext";
import {buildRouteIdsKey} from "@shared/utils/routeIds";

import type {FeatureCollection, LineString} from "geojson";

import {useEffect, useMemo, useRef} from "react";
import {Layer, Source} from "react-map-gl/maplibre";

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
    GLOW_UP: "rgba(37, 99, 235, 0.35)", GLOW_DOWN: "rgba(220, 38, 38, 0.35)",
} as const;

// ----------------------------------------------------------------------
// MapLibre Layer Generators
// ----------------------------------------------------------------------

function createGeoJSON(segments: PolylineSegment[]): FeatureCollection<LineString> {
    return {
        type: "FeatureCollection", features: segments.map((segment) => ({
            type: "Feature", geometry: {
                type: "LineString", // Convert [lat, lng] to [lng, lat] for GeoJSON
                coordinates: segment.coords.map(([lat, lng]) => [lng, lat]),
            }, properties: {
                direction: segment.direction, routeIds: segment.routeIds.join("_"),
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
    const {data: busList, hasFetched} = useBusLocationData(routeIds);
    const lastBoundsKeyRef = useRef<string | null>(null);

    // Determine active route IDs (routes with running buses)
    // We stringify the IDs to use as a stable dependency and prevent expensive polyline recalculations
    const activeRouteIdsStr = useMemo(() => {
        const validRouteIdSet = new Set(routeIds);
        const busRouteIds = busList
            .map((bus) => bus.routeid)
            .filter((id): id is string => typeof id === "string" && validRouteIdSet.has(id));

        return buildRouteIdsKey(busRouteIds);
    }, [busList, routeIds]);

    const activeRouteIds = useMemo(() => {
        return activeRouteIdsStr ? activeRouteIdsStr.split(",") : [];
    }, [activeRouteIdsStr]);

    const {
        activeUpSegments, inactiveUpSegments, activeDownSegments, inactiveDownSegments, bounds,
    } = useMultiPolyline(routeIds, activeRouteIds);

    // Styling Logic
    const hasActiveSegments = activeUpSegments.length > 0 || activeDownSegments.length > 0;
    const isNoBusRunning = hasFetched && busList.length === 0;

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
            padding: 32, duration: MAP_SETTINGS.ANIMATION.FLY_TO_MS,
        });
    }, [map, bounds]);

    return (<>
        <Source id="polyline-up" type="geojson" data={activeUpGeoJSON}/>
        {isNoBusRunning ? (<>
            <Layer
                id="polyline-up-layer"
                source="polyline-up"
                type="line"
                paint={{
                    "line-color": COLORS.ACTIVE_UP, "line-width": 4, "line-opacity": 0.7, "line-dasharray": [1.5, 2]
                }}
                layout={{"line-cap": "round", "line-join": "round"}}
            />
            <Layer
                id="polyline-up-arrows-inactive"
                source="polyline-up"
                type="symbol"
                layout={{
                    "symbol-placement": "line",
                    "symbol-spacing": 80,
                    "text-field": "▶",
                    "text-font": ["Noto Sans Regular"],
                    "text-size": ["interpolate", ["linear"], ["zoom"], 10, 6, 14, 12, 18, 18],
                    "text-keep-upright": false,
                    "text-rotation-alignment": "auto",
                    "symbol-avoid-edges": false,
                    "text-allow-overlap": true,
                    "text-ignore-placement": true,
                }}
                paint={{
                    "text-color": COLORS.ACTIVE_UP,
                    "text-halo-color": "white",
                    "text-halo-width": 2,
                    "text-opacity": 0.6,
                }}
            />
        </>) : (<>
            <Layer
                id="polyline-up-glow"
                source="polyline-up"
                type="line"
                paint={{
                    "line-color": COLORS.GLOW_UP, "line-width": 10, "line-opacity": 1,
                }}
                layout={{"line-cap": "round", "line-join": "round"}}
            />
            <Layer
                id="polyline-up-main"
                source="polyline-up"
                type="line"
                paint={{
                    "line-color": COLORS.ACTIVE_UP, "line-width": 4, "line-opacity": 1,
                }}
                layout={{"line-cap": "round", "line-join": "round"}}
            />
            <Layer
                id="polyline-up-arrows-active"
                source="polyline-up"
                type="symbol"
                layout={{
                    "symbol-placement": "line",
                    "symbol-spacing": 100,
                    "text-field": "▶",
                    "text-font": ["Noto Sans Regular"],
                    "text-size": ["interpolate", ["linear"], ["zoom"], 10, 6, 14, 12, 18, 18],
                    "text-keep-upright": false,
                    "text-rotation-alignment": "auto",
                    "symbol-avoid-edges": false,
                    "text-allow-overlap": true,
                    "text-ignore-placement": true,
                }}
                paint={{
                    "text-color": COLORS.ACTIVE_UP,
                    "text-halo-color": "white",
                    "text-halo-width": 2,
                    "text-opacity": 0.9,
                }}
            />
        </>)}

        <Source id="polyline-down" type="geojson" data={activeDownGeoJSON}/>
        {isNoBusRunning ? (<>
            <Layer
                id="polyline-down-layer"
                source="polyline-down"
                type="line"
                paint={{
                    "line-color": COLORS.ACTIVE_DOWN, "line-width": 4, "line-opacity": 0.7, "line-dasharray": [1.5, 2]
                }}
                layout={{"line-cap": "round", "line-join": "round"}}
            />
            <Layer
                id="polyline-down-arrows-inactive"
                source="polyline-down"
                type="symbol"
                layout={{
                    "symbol-placement": "line",
                    "symbol-spacing": 80,
                    "text-field": "▶",
                    "text-font": ["Noto Sans Regular"],
                    "text-size": ["interpolate", ["linear"], ["zoom"], 10, 6, 14, 12, 18, 18],
                    "text-keep-upright": false,
                    "text-rotation-alignment": "auto",
                    "symbol-avoid-edges": false,
                    "text-allow-overlap": true,
                    "text-ignore-placement": true,
                }}
                paint={{
                    "text-color": COLORS.ACTIVE_DOWN,
                    "text-halo-color": "white",
                    "text-halo-width": 2,
                    "text-opacity": 0.6,
                }}
            />
        </>) : (<>
            <Layer
                id="polyline-down-glow"
                source="polyline-down"
                type="line"
                paint={{
                    "line-color": COLORS.GLOW_DOWN, "line-width": 10, "line-opacity": 1,
                }}
                layout={{"line-cap": "round", "line-join": "round"}}
            />
            <Layer
                id="polyline-down-main"
                source="polyline-down"
                type="line"
                paint={{
                    "line-color": COLORS.ACTIVE_DOWN, "line-width": 4, "line-opacity": 1,
                }}
                layout={{"line-cap": "round", "line-join": "round"}}
            />
            <Layer
                id="polyline-down-arrows-active"
                source="polyline-down"
                type="symbol"
                layout={{
                    "symbol-placement": "line",
                    "symbol-spacing": 100,
                    "text-field": "▶",
                    "text-font": ["Noto Sans Regular"],
                    "text-size": ["interpolate", ["linear"], ["zoom"], 10, 6, 14, 12, 18, 18],
                    "text-keep-upright": false,
                    "text-rotation-alignment": "auto",
                    "symbol-avoid-edges": false,
                    "text-allow-overlap": true,
                    "text-ignore-placement": true,
                }}
                paint={{
                    "text-color": COLORS.ACTIVE_DOWN,
                    "text-halo-color": "white",
                    "text-halo-width": 2,
                    "text-opacity": 0.9,
                }}
            />
        </>)}
    </>);
}
