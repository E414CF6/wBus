"use client";

import {buildSegmentedRouteGeoJson} from "@entities/route/polylineService";
import {getRouteMeta} from "@entities/route/routeMetadata";
import {useRoutePolylineData} from "@features/live-tracking";
import {MAP_SETTINGS} from "@shared/config/env";
import {isDesktopViewport} from "@shared/ui/useIsDesktop";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {useCityContext} from "@entities/city";
import {filterRouteIdsByCity, isRouteAllowedInCity} from "@entities/city/routeBoundary";
import {useTheme} from "next-themes";
import {useEffect, useMemo, useRef, useState} from "react";
import {Layer, Source} from "react-map-gl/maplibre";
import {ensureRouteChevronImage, findFirstLabelLayerId, ROUTE_CHEVRON_IMAGE_ID,} from "./lib/routeLayerUtils";

export interface BusRoutePolylineProps {
    routeName: string;
    enabled?: boolean;
    selectedDirection?: "all" | "up" | "down";
    selectedVariantId?: string | null;
    cityCode?: string;
}

export default function BusRoutePolyline({
                                             routeName,
                                             enabled = true,
                                             selectedDirection = "all",
                                             selectedVariantId = null,
                                             cityCode,
                                         }: BusRoutePolylineProps) {
    const {map} = useAppMapContext();
    const {settings} = useAppSettings();
    const {resolvedTheme} = useTheme();
    const isDark = resolvedTheme === "dark";

    const {currentCity} = useCityContext();
    const effectiveCityCode = cityCode || currentCity?.code || "32020";

    const {routeInfo, polylineMap, activeRouteId} = useRoutePolylineData(routeName, enabled, effectiveCityCode);
    const rawRouteIds = useMemo(() => routeInfo?.vehicleRouteIds ?? [], [routeInfo?.vehicleRouteIds]);
    const routeIds = useMemo(() => filterRouteIdsByCity(effectiveCityCode, rawRouteIds), [rawRouteIds, effectiveCityCode]);
    const lastBoundsKeyRef = useRef<string | null>(null);
    const needsVisibleFitRef = useRef(false);
    const [beforeLabelLayerId, setBeforeLabelLayerId] = useState<string | undefined>(undefined);
    const [hasChevronImage, setHasChevronImage] = useState(false);

    // Sync route chevron icon & label-below insertion layer across initial load and theme switches
    useEffect(() => {
        if (!map) return;

        const mapInstance = map.getMap();
        const syncStyleHooks = () => {
            const chevronOk = ensureRouteChevronImage(mapInstance);
            setHasChevronImage(chevronOk);

            const styleLayers = mapInstance.getStyle()?.layers;
            const firstLabel = findFirstLabelLayerId(styleLayers);
            setBeforeLabelLayerId(firstLabel);
        };

        if (mapInstance.isStyleLoaded()) {
            syncStyleHooks();
        }

        mapInstance.on("style.load", syncStyleHooks);
        mapInstance.on("styledata", syncStyleHooks);
        return () => {
            mapInstance.off("style.load", syncStyleHooks);
            mapInstance.off("styledata", syncStyleHooks);
        };
    }, [map, resolvedTheme]);

    // Filter to render available route IDs for this route number, respecting selectedVariantId if provided
    const validRouteIds = useMemo(() => {
        const available = routeIds.filter((id) => {
            if (!isRouteAllowedInCity(effectiveCityCode, id)) return false;
            const data = polylineMap.get(id);
            return data && (data.upPolyline.length > 0 || data.downPolyline.length > 0);
        });

        // If a specific variant is selected and available, render only that variant's polyline
        if (selectedVariantId && selectedVariantId !== "all") {
            if (available.includes(selectedVariantId)) {
                return [selectedVariantId];
            }
            if (polylineMap.has(selectedVariantId)) {
                return [selectedVariantId];
            }
        }

        if (available.length > 0) return available;
        if (activeRouteId && polylineMap.has(activeRouteId)) {
            if (!isRouteAllowedInCity(effectiveCityCode, activeRouteId)) return [];
            const data = polylineMap.get(activeRouteId);
            if (data && (data.upPolyline.length > 0 || data.downPolyline.length > 0)) {
                return [activeRouteId];
            }
        }
        return routeIds.slice(0, 1);
    }, [routeIds, polylineMap, activeRouteId, selectedVariantId, effectiveCityCode]);

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

    // Build smart segmented GeoJSON: Overlapping parts in route theme color (Red/Blue/Green), unique branch parts in distinct colors
    const activeGeoJson = useMemo(() => {
        const meta = getRouteMeta(routeName, effectiveCityCode);
        return buildSegmentedRouteGeoJson(validRouteIds, polylineMap, meta.colorTheme.main);
    }, [validRouteIds, polylineMap, routeName, effectiveCityCode]);

    // Fit map to bounds of routes with safe asymmetric padding for floating UI elements
    const fitToRouteBounds = useMemo(() => {
        return () => {
            if (!map || !bbox) return;
            const container = map.getContainer();
            if (container.clientWidth === 0 || container.clientHeight === 0) {
                needsVisibleFitRef.current = true;
                return;
            }

            const [[s, w], [n, e]] = bbox;
            const isCompact = typeof window !== "undefined" && window.innerWidth < 640;
            const isDesktop = isDesktopViewport();
            needsVisibleFitRef.current = false;
            map.resize();
            map.fitBounds(
                [
                    [w, s],
                    [e, n],
                ],
                {
                    padding: {
                        top: isCompact ? 196 : 168,
                        bottom: isCompact ? 124 : 116,
                        left: isCompact ? 56 : isDesktop ? 440 : 64,
                        right: isCompact ? 76 : 84,
                    },
                    duration: settings.reduceMotion ? 0 : MAP_SETTINGS.ANIMATION.FLY_TO_MS,
                }
            );
        };
    }, [map, bbox, settings.reduceMotion]);

    useEffect(() => {
        if (!map || !bbox) return;

        const key = bbox.flat().join(",");
        if (lastBoundsKeyRef.current === key) return;
        lastBoundsKeyRef.current = key;

        if (!settings.autoFitRouteBounds) return;
        fitToRouteBounds();
    }, [map, bbox, fitToRouteBounds, settings.autoFitRouteBounds]);

    // The map is mounted while the timetable view is hidden. Re-fit after its
    // container gets a real size instead of fitting against a zero-sized canvas.
    useEffect(() => {
        if (!map || !bbox || typeof ResizeObserver === "undefined") return;

        const container = map.getContainer();
        const observer = new ResizeObserver(() => {
            if (
                needsVisibleFitRef.current &&
                container.clientWidth > 0 &&
                container.clientHeight > 0
            ) {
                map.resize();
                fitToRouteBounds();
            }
        });
        observer.observe(container);

        return () => observer.disconnect();
    }, [map, bbox, fitToRouteBounds]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleFitBoundsEvent = () => {
            fitToRouteBounds();
        };
        window.addEventListener("wbus:fit-route-bounds", handleFitBoundsEvent);
        return () => window.removeEventListener("wbus:fit-route-bounds", handleFitBoundsEvent);
    }, [fitToRouteBounds]);

    if (validRouteIds.length === 0 || !activeGeoJson) return null;

    // Theme-adaptive colors
    const casingColor = isDark ? "#090d16" : "#ffffff";
    const casingOpacity = isDark ? 0.92 : 0.95;

    return (
        <Source id="active-routes-polyline" type="geojson" data={activeGeoJson}>
            {/* Outline casing for crisp contrast against map tiles */}
            <Layer
                id="polyline-active-casing"
                type="line"
                beforeId={beforeLabelLayerId}
                paint={{
                    "line-color": casingColor,
                    "line-width": [
                        "interpolate",
                        ["exponential", 1.4],
                        ["zoom"],
                        10, 4,
                        13, 6.5,
                        15, 9.2,
                        18, 14.5,
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
                beforeId={beforeLabelLayerId}
                paint={{
                    "line-color": ["get", "color"] as unknown as string,
                    "line-width":
                        selectedDirection === "all"
                            ? [
                                "interpolate",
                                ["exponential", 1.4],
                                ["zoom"],
                                10, 2.2,
                                13, 4.2,
                                15, 6,
                                18, 9.6,
                            ]
                            : [
                                "case",
                                ["==", ["get", "direction"], selectedDirection],
                                [
                                    "interpolate",
                                    ["exponential", 1.4],
                                    ["zoom"],
                                    10, 2.6,
                                    13, 4.8,
                                    15, 7,
                                    18, 11,
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
                            ? 0.96
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
            {/* Crisp directional chevrons embedded inside the route line */}
            {hasChevronImage && (
                <Layer
                    id="polyline-active-arrows"
                    type="symbol"
                    beforeId={beforeLabelLayerId}
                    filter={
                        selectedDirection === "all" || !selectedDirection
                            ? ["has", "direction"]
                            : ["==", ["get", "direction"], selectedDirection]
                    }
                    layout={{
                        "symbol-placement": "line",
                        "symbol-spacing": 120,
                        "icon-image": ROUTE_CHEVRON_IMAGE_ID,
                        "icon-size": [
                            "interpolate",
                            ["linear"],
                            ["zoom"],
                            10, 0.35,
                            13, 0.55,
                            15, 0.72,
                            18, 0.95,
                        ],
                        "icon-offset": [
                            "interpolate",
                            ["linear"],
                            ["zoom"],
                            12, ["literal", [0, 0]],
                            14, ["literal", [0, 2.2]],
                            16, ["literal", [0, 3.2]],
                            18, ["literal", [0, 4.2]],
                        ],
                        "icon-keep-upright": false,
                        "icon-rotation-alignment": "map",
                        "icon-allow-overlap": false,
                        "icon-ignore-placement": false,
                        "symbol-avoid-edges": true,
                    }}
                    paint={{
                        "icon-opacity":
                            selectedDirection === "all"
                                ? 0.92
                                : [
                                    "case",
                                    ["==", ["get", "direction"], selectedDirection],
                                    0.96,
                                    0.2,
                                ],
                    }}
                />
            )}
        </Source>
    );
}
