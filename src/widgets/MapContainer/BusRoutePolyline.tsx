"use client";

import {getRouteColor} from "@entities/route/routeColor";
import {useBusData} from "@features/live-tracking/useBusData";
import {MAP_SETTINGS} from "@shared/config/env";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useEffect, useMemo, useRef} from "react";
import {Layer, Source} from "react-map-gl/maplibre";

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
        const features: GeoJSON.Feature[] = [];

        for (const id of activeRouteIds) {
            const data = polylineMap.get(id);
            if (!data) continue;

            if (data.upPolyline.length >= 2) {
                features.push({
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: data.upPolyline.map((c) => [c[1], c[0]])
                    },
                    properties: {route_id: id, direction: "up"}
                });
            }

            if (data.downPolyline.length >= 2) {
                features.push({
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: data.downPolyline.map((c) => [c[1], c[0]])
                    },
                    properties: {route_id: id, direction: "down"}
                });
            }
        }

        return {type: "FeatureCollection" as const, features};
    }, [activeRouteIds, polylineMap]);

    const lineColor = routeColor.main;

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
            {/* White outline casing for crisp contrast against map tiles */}
            <Layer
                id="polyline-active-casing"
                type="line"
                paint={{
                    "line-color": "#ffffff",
                    "line-width": 7,
                    "line-opacity": 0.6,
                }}
                layout={{
                    "line-cap": "round",
                    "line-join": "round",
                }}
            />
            {/* Main bus route polyline layer */}
            <Layer
                id="polyline-active-layer"
                type="line"
                paint={{
                    "line-color": lineColor,
                    "line-width": 4.5,
                    "line-opacity": 0.95,
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
                    "text-color": lineColor,
                    "text-halo-color": "#ffffff",
                    "text-halo-width": 2,
                    "text-opacity": 0.95,
                }}
            />
        </Source>
    );
}

