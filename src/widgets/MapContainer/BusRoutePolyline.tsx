"use client";

import {buildSegmentedRouteGeoJson} from "@entities/route/polylineService";
import {useRoutePolylineData} from "@features/live-tracking";
import {MAP_SETTINGS} from "@shared/config/env";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useTheme} from "next-themes";
import {useEffect, useMemo, useRef} from "react";
import {Layer, Source} from "react-map-gl/maplibre";

export interface BusRoutePolylineProps {
    routeName: string;
    selectedDirection?: "all" | "up" | "down";
}

export default function BusRoutePolyline({routeName, selectedDirection = "all"}: BusRoutePolylineProps) {
    const {map} = useAppMapContext();
    const {resolvedTheme} = useTheme();
    const isDark = resolvedTheme === "dark";

    const {routeInfo, polylineMap, activeRouteId} = useRoutePolylineData(routeName);
    const routeIds = useMemo(() => routeInfo?.vehicleRouteIds ?? [], [routeInfo?.vehicleRouteIds]);
    const lastBoundsKeyRef = useRef<string | null>(null);

    // Filter to render all available route IDs for this route number
    const validRouteIds = useMemo(() => {
        const available = routeIds.filter((id) => {
            const data = polylineMap.get(id);
            return data && (data.upPolyline.length > 0 || data.downPolyline.length > 0);
        });
        if (available.length > 0) return available;
        if (activeRouteId && polylineMap.has(activeRouteId)) {
            const data = polylineMap.get(activeRouteId);
            if (data && (data.upPolyline.length > 0 || data.downPolyline.length > 0)) {
                return [activeRouteId];
            }
        }
        return routeIds.slice(0, 1);
    }, [routeIds, polylineMap, activeRouteId]);

    const bbox = useMemo(() => {
        let minLat = Infinity,
            minLng = Infinity,
            maxLat = -Infinity,
            maxLng = -Infinity;
        let hasBounds = false;
        for (const id of validRouteIds) {
            const data = polylineMap.get(id);
            if (data?.bbox) {
                const [[s, w], [n, e]] = data.bbox;
                minLat = Math.min(minLat, s);
                minLng = Math.min(minLng, w);
                maxLat = Math.max(maxLat, n);
                maxLng = Math.max(maxLng, e);
                hasBounds = true;
            }
        }
        return hasBounds
            ? ([[minLat, minLng], [maxLat, maxLng]] as [[number, number], [number, number]])
            : null;
    }, [validRouteIds, polylineMap]);

    // Build smart segmented GeoJSON: Overlapping parts in unified blue, unique branch parts in distinct colors
    const activeGeoJson = useMemo(() => {
        return buildSegmentedRouteGeoJson(validRouteIds, polylineMap);
    }, [validRouteIds, polylineMap]);

    // Fit map to bounds of routes with safe asymmetric padding for floating UI elements
    useEffect(() => {
        if (!map || !bbox) return;

        const key = bbox.flat().join(",");
        if (lastBoundsKeyRef.current === key) return;
        lastBoundsKeyRef.current = key;

        const [[s, w], [n, e]] = bbox;
        map.fitBounds(
            [
                [w, s],
                [e, n],
            ],
            {
                padding: {
                    top: 110,
                    bottom: 120,
                    left: 36,
                    right: 36,
                },
                duration: MAP_SETTINGS.ANIMATION.FLY_TO_MS,
            }
        );
    }, [map, bbox]);

    if (validRouteIds.length === 0 || !activeGeoJson) return null;

    // Theme-adaptive colors
    const casingColor = isDark ? "#080c14" : "#ffffff";
    const casingOpacity = isDark ? 0.95 : 0.85;
    const haloColor = isDark ? "#080c14" : "#ffffff";

    return (
        <Source id="active-routes-polyline" type="geojson" data={activeGeoJson}>
            {/* Outline casing for crisp contrast against map tiles */}
            <Layer
                id="polyline-active-casing"
                type="line"
                paint={{
                    "line-color": casingColor,
                    "line-width": [
                        "interpolate",
                        ["exponential", 1.4],
                        ["zoom"],
                        10, 3.6,
                        13, 6,
                        15, 8.5,
                        18, 13.5,
                    ],
                    "line-opacity": casingOpacity,
                    "line-offset": [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        12, 0,
                        14, 1.5,
                        16, 2.5,
                        18, 4,
                    ],
                }}
                layout={{
                    "line-cap": "round",
                    "line-join": "round",
                }}
            />
            {/* Main bus route polyline layer with color driven by segment property */}
            <Layer
                id="polyline-active-layer"
                type="line"
                paint={{
                    "line-color": ["get", "color"] as unknown as string,
                    "line-width":
                        selectedDirection === "all"
                            ? [
                                "interpolate",
                                ["exponential", 1.4],
                                ["zoom"],
                                10, 2,
                                13, 3.8,
                                15, 5.5,
                                18, 9,
                            ]
                            : [
                                "case",
                                ["==", ["get", "direction"], selectedDirection],
                                [
                                    "interpolate",
                                    ["exponential", 1.4],
                                    ["zoom"],
                                    10, 2.4,
                                    13, 4.4,
                                    15, 6.5,
                                    18, 10.5,
                                ],
                                [
                                    "interpolate",
                                    ["exponential", 1.4],
                                    ["zoom"],
                                    10, 1.4,
                                    13, 2.4,
                                    15, 3.4,
                                    18, 5.5,
                                ],
                            ],
                    "line-opacity":
                        selectedDirection === "all"
                            ? 0.95
                            : [
                                "case",
                                ["==", ["get", "direction"], selectedDirection],
                                0.98,
                                0.25,
                            ],
                    "line-offset": [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        12, 0,
                        14, 1.5,
                        16, 2.5,
                        18, 4,
                    ],
                }}
                layout={{
                    "line-cap": "round",
                    "line-join": "round",
                }}
            />
            {/* Direction arrows along line */}
            <Layer
                id="polyline-active-arrows"
                type="symbol"
                filter={
                    selectedDirection === "all"
                        ? undefined
                        : ["==", ["get", "direction"], selectedDirection]
                }
                layout={{
                    "symbol-placement": "line",
                    "symbol-spacing": 160,
                    "text-field": "▶",
                    "text-font": ["Noto Sans Regular"],
                    "text-size": [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        10, 6,
                        14, 10,
                        18, 16,
                    ],
                    "text-keep-upright": false,
                    "text-rotation-alignment": "auto",
                    "symbol-avoid-edges": true,
                    "text-allow-overlap": false,
                    "text-ignore-placement": false,
                }}
                paint={{
                    "text-color": ["get", "color"] as unknown as string,
                    "text-halo-color": haloColor,
                    "text-halo-width": 2.5,
                    "text-opacity": selectedDirection === "all" ? 0.9 : 0.95,
                }}
            />
        </Source>
    );
}
