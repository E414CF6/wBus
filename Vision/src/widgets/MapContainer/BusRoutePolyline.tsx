"use client";

import {useRouteIds} from "@entities/route/hooks";
import {useBusPolylineMap} from "@features/live-tracking/usePolyline";
import {getRouteIdColorMapping, PALETTE} from "@entities/route/polylineService";
import {MAP_SETTINGS} from "@shared/config/env";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useEffect, useMemo, useRef} from "react";
import {Layer, Source} from "react-map-gl/maplibre";

export default function BusRoutePolyline({routeName}: { routeName: string }) {
    const {map} = useAppMapContext();
    const routeIds = useRouteIds(routeName);
    const polylineMap = useBusPolylineMap(routeIds);
    const lastBoundsKeyRef = useRef<string | null>(null);

    const routeIdColorMapping = useMemo(() => {
        return getRouteIdColorMapping(routeIds, polylineMap);
    }, [routeIds, polylineMap]);

    const bbox = useMemo(() => {
        let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
        let hasBounds = false;
        for (const data of polylineMap.values()) {
            if (data.bbox) {
                const [[s, w], [n, e]] = data.bbox;
                minLat = Math.min(minLat, s);
                minLng = Math.min(minLng, w);
                maxLat = Math.max(maxLat, n);
                maxLng = Math.max(maxLng, e);
                hasBounds = true;
            }
        }
        return hasBounds ? [[minLat, minLng], [maxLat, maxLng]] as [[number, number], [number, number]] : null;
    }, [polylineMap]);

    // Build maplibre match expression for colors
    const colorExpression = useMemo(() => {
        if (routeIds.length === 0) return "#2563eb"; // fallback
        const expr: any[] = ["match", ["get", "route_id"]];
        for (const id of routeIds) {
            const colorIndex = routeIdColorMapping[id] ?? 0;
            const colors = PALETTE[colorIndex % PALETTE.length];

            const directionExpr = [
                "match",
                ["get", "direction"],
                "up", colors.up,
                "down", colors.down,
                colors.up
            ];

            expr.push(id, directionExpr);
        }
        expr.push("#2563eb"); // default fallback
        return expr;
    }, [routeIds, routeIdColorMapping]);

    const activeGeoJson = useMemo(() => {
        if (routeIds.length === 0) return null;
        const features: any[] = [];

        for (const id of routeIds) {
            const data = polylineMap.get(id);
            if (!data) continue;

            if (data.upPolyline.length > 0) {
                features.push({
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: data.upPolyline.map(c => [c[1], c[0]]) // MapLibre expects [lng, lat]
                    },
                    properties: {route_id: id, direction: "up"}
                });
            }
            if (data.downPolyline.length > 0) {
                features.push({
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: data.downPolyline.map(c => [c[1], c[0]])
                    },
                    properties: {route_id: id, direction: "down"}
                });
            }
        }

        return {type: "FeatureCollection" as const, features};
    }, [routeIds, polylineMap]);

    // Fit map to bounds
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

    if (routeIds.length === 0 || !activeGeoJson) return null;

    return (
        <Source id="active-routes-polyline" type="geojson" data={activeGeoJson}>
            <Layer
                id="polyline-active-layer"
                type="line"
                paint={{
                    "line-color": colorExpression as any,
                    "line-width": 4,
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
                    "text-color": [
                        "match",
                        ["get", "direction"],
                        "up", "#2563eb",
                        "down", "#dc2626",
                        "#2563eb"
                    ],
                    "text-halo-color": "white",
                    "text-halo-width": 2,
                    "text-opacity": 0.9,
                }}
            />
        </Source>
    );
}
