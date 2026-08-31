"use client";

import {buildSegmentedRouteGeoJson} from "@entities/route/polylineService";
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

    // Fit map to bounds of routes
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
                padding: 32,
                duration: MAP_SETTINGS.ANIMATION.FLY_TO_MS,
            }
        );
    }, [map, bbox]);

    if (validRouteIds.length === 0 || !activeGeoJson) return null;

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
            {/* Main bus route polyline layer with color driven by segment property (blue for shared, branch color for distinct parts) */}
            <Layer
                id="polyline-active-layer"
                type="line"
                paint={{
                    "line-color": ["get", "color"] as unknown as string,
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
                    "text-color": ["get", "color"] as unknown as string,
                    "text-halo-color": "#ffffff",
                    "text-halo-width": 2,
                    "text-opacity": 0.95,
                }}
            />
        </Source>
    );
}
