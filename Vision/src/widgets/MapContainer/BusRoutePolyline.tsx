"use client";

import {getRouteColor} from "@entities/route/routeColor";
import type {Coordinate} from "@entities/route/types";
import {useBusData} from "@features/live-tracking/useBusData";
import {MAP_SETTINGS} from "@shared/config/env";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useEffect, useMemo, useRef} from "react";
import {Layer, Source} from "react-map-gl/maplibre";

function makeSegmentKey(p1: Coordinate, p2: Coordinate): string {
    const k1 = `${p1[0].toFixed(4)},${p1[1].toFixed(4)}`;
    const k2 = `${p2[0].toFixed(4)},${p2[1].toFixed(4)}`;
    return k1 < k2 ? `${k1}:${k2}` : `${k2}:${k1}`;
}

export default function BusRoutePolyline({routeName}: { routeName: string }) {
    const {map} = useAppMapContext();
    const {routeInfo, polylineMap, activeRouteId} = useBusData(routeName);
    const routeIds = useMemo(() => routeInfo?.vehicleRouteIds ?? [], [routeInfo]);
    const lastBoundsKeyRef = useRef<string | null>(null);

    const routeColor = useMemo(() => getRouteColor(routeName), [routeName]);

    // Filter to only render the active route ID among the available route IDs
    const selectedActiveRouteId = useMemo(() => {
        if (activeRouteId && polylineMap.has(activeRouteId)) {
            const data = polylineMap.get(activeRouteId);
            if (data && (data.upPolyline.length > 0 || data.downPolyline.length > 0)) {
                return activeRouteId;
            }
        }
        for (const id of routeIds) {
            const data = polylineMap.get(id);
            if (data && (data.upPolyline.length > 0 || data.downPolyline.length > 0)) {
                return id;
            }
        }
        return activeRouteId ?? routeIds[0] ?? null;
    }, [activeRouteId, polylineMap, routeIds]);

    const activeRouteIds = useMemo(() => {
        return selectedActiveRouteId ? [selectedActiveRouteId] : [];
    }, [selectedActiveRouteId]);

    const bbox = useMemo(() => {
        let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
        let hasBounds = false;
        for (const id of activeRouteIds) {
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
        return hasBounds ? [[minLat, minLng], [maxLat, maxLng]] as [[number, number], [number, number]] : null;
    }, [activeRouteIds, polylineMap]);

    const activeGeoJson = useMemo(() => {
        if (activeRouteIds.length === 0) return null;
        const features: any[] = [];

        for (const id of activeRouteIds) {
            const data = polylineMap.get(id);
            if (!data) continue;

            const upCoords = data.upPolyline;
            const downCoords = data.downPolyline;

            // Collect spatial keys for up and down polylines
            const upKeys = new Set<string>();
            for (let i = 0; i < upCoords.length - 1; i++) {
                upKeys.add(makeSegmentKey(upCoords[i], upCoords[i + 1]));
            }

            const downKeys = new Set<string>();
            for (let i = 0; i < downCoords.length - 1; i++) {
                downKeys.add(makeSegmentKey(downCoords[i], downCoords[i + 1]));
            }

            // Build feature chunks for up and down polylines
            const buildChunkFeatures = (coords: Coordinate[], otherKeys: Set<string>, direction: "up" | "down") => {
                if (coords.length < 2) return;

                let currentChunk: [number, number][] = [[coords[0][1], coords[0][0]]];
                let currentOverlap = false;

                for (let i = 0; i < coords.length - 1; i++) {
                    const p1 = coords[i];
                    const p2 = coords[i + 1];
                    const key = makeSegmentKey(p1, p2);
                    const isOverlap = otherKeys.has(key);

                    if (i === 0) {
                        currentOverlap = isOverlap;
                    } else if (isOverlap !== currentOverlap) {
                        if (currentChunk.length >= 2) {
                            features.push({
                                type: "Feature",
                                geometry: {type: "LineString", coordinates: currentChunk},
                                properties: {route_id: id, direction, is_overlap: currentOverlap}
                            });
                        }
                        currentChunk = [[p1[1], p1[0]]];
                        currentOverlap = isOverlap;
                    }

                    currentChunk.push([p2[1], p2[0]]);
                }

                if (currentChunk.length >= 2) {
                    features.push({
                        type: "Feature",
                        geometry: {type: "LineString", coordinates: currentChunk},
                        properties: {route_id: id, direction, is_overlap: currentOverlap}
                    });
                }
            };

            buildChunkFeatures(upCoords, downKeys, "up");
            buildChunkFeatures(downCoords, upKeys, "down");
        }

        return {type: "FeatureCollection" as const, features};
    }, [activeRouteIds, polylineMap]);

    // Color expression for MapLibre
    // - Overlapping segments (is_overlap === true) -> Default colors (#2563eb for up, #dc2626 for down)
    // - Non-overlapping active segments (is_overlap === false) -> Active route color (routeColor.main)
    const colorExpression = useMemo(() => {
        return [
            "case",
            ["get", "is_overlap"],
            [
                "match",
                ["get", "direction"],
                "up", "#2563eb",
                "down", "#dc2626",
                "#2563eb"
            ],
            routeColor.main
        ];
    }, [routeColor]);

    // Fit map to bounds of active route ID
    useEffect(() => {
        if (!map || !bbox) return;

        const key = bbox.flat().join(",");
        if (lastBoundsKeyRef.current === key) return;
        lastBoundsKeyRef.current = key;

        const [[s, w], [n, e]] = bbox;
        map.fitBounds([[w, s], [e, n]], {
            padding: 32,
            duration: MAP_SETTINGS.ANIMATION.FLY_TO_MS,
        });
    }, [map, bbox]);

    if (activeRouteIds.length === 0 || !activeGeoJson) return null;

    return (
        <Source id="active-routes-polyline" type="geojson" data={activeGeoJson}>
            <Layer
                id="polyline-active-layer"
                type="line"
                paint={{
                    "line-color": colorExpression as any,
                    "line-width": 4.5,
                    "line-opacity": 1,
                }}
                layout={{
                    "line-cap": "round",
                    "line-join": "round",
                }}
            />
            <Layer
                id="polyline-active-arrows"
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
                    "text-color": colorExpression as any,
                    "text-halo-color": "white",
                    "text-halo-width": 2,
                    "text-opacity": 0.9,
                }}
            />
        </Source>
    );
}
