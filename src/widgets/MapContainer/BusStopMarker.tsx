"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Layer, Source} from "react-map-gl/maplibre";
import type {MapLayerMouseEvent} from "maplibre-gl";
import {useTheme} from "next-themes";
import {useBusStop, useFavoriteStops, useNearbyStops} from "@entities/station/hooks";
import type {BusStop} from "@entities/station/types";
import {findPairedOppositeStop} from "@entities/station/busStopMarkerUtils";
import {MAP_SETTINGS} from "@shared/config/env";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useIsDesktop} from "@shared/ui/useIsDesktop";
import {useCityContext} from "@entities/city";
import {filterRouteIdsByCity, isRouteAllowedInCity} from "@entities/city/routeBoundary";
import {useRoutePolylineData} from "@features/live-tracking";
import {getRouteMeta} from "@entities/route/routeMetadata";
import {buildSegmentedRouteGeoJson} from "@entities/route/polylineService";
import {findNearestFeatureColor} from "./lib/markerGeometry";
import {
    buildBusStopsGeoJson,
    getBusStopKey,
    STOP_CIRCLE_NEARBY_LAYER_ID,
    STOP_CIRCLE_ROUTE_LAYER_ID,
    STOP_INTERACTIVE_LAYER_IDS,
    STOP_LABEL_NEARBY_LAYER_ID,
    STOP_LABEL_PRIORITY_LAYER_ID,
    STOP_LABEL_ROUTE_LAYER_ID,
    STOP_SOURCE_ID,
} from "./lib/stopLayerUtils";
import {BusStopMarkerItem} from "./ui/BusStopMarkerItem";

export interface BusStopMarkerProps {
    routeName: string;
    onRouteChange?: (routeName: string) => void;
    enabled?: boolean;
    cityCode?: string;
    showNearbyStops?: boolean;
    showStopLabels?: boolean;
    focusedStopId?: string | null;
    onClearFocusedStop?: () => void;
}

export const BusStopMarker = ({
                                  routeName,
                                  onRouteChange,
                                  enabled = true,
                                  cityCode,
                                  showNearbyStops = true,
                                  showStopLabels = true,
                                  focusedStopId = null,
                                  onClearFocusedStop,
                              }: BusStopMarkerProps) => {
    const {currentCity} = useCityContext();
    const effectiveCityCode = cityCode || currentCity?.code || "32020";
    const activeRouteName = enabled ? routeName : "";
    const routeStops = useBusStop(activeRouteName, effectiveCityCode);
    const {favoriteStops, isFavoriteStop, toggleFavoriteStop} = useFavoriteStops(effectiveCityCode);

    const {map} = useAppMapContext();
    const isDesktop = useIsDesktop();
    const {resolvedTheme} = useTheme();
    const isDark = resolvedTheme === "dark";

    const [zoom, setZoom] = useState(map?.getZoom() ?? MAP_SETTINGS.ZOOM.DEFAULT);
    const [centerCoords, setCenterCoords] = useState<{ lat: number; lng: number } | null>(() => {
        const c = map?.getCenter();
        return c ? {lat: c.lat, lng: c.lng} : null;
    });

    // Fetch spatial nearby stops when zoomed in >= 14.3 and showNearbyStops is enabled
    const shouldFetchNearby = Boolean(showNearbyStops && zoom >= 14.3 && centerCoords);
    const {nearbyStops} = useNearbyStops(
        centerCoords?.lat ?? null,
        centerCoords?.lng ?? null,
        shouldFetchNearby,
        35
    );

    // Retrieve polyline data to synchronize stop marker & label colors with route segments
    const {routeInfo, polylineMap, activeRouteId} = useRoutePolylineData(routeName, enabled, effectiveCityCode);
    const rawRouteIds = useMemo(() => routeInfo?.vehicleRouteIds ?? [], [routeInfo?.vehicleRouteIds]);
    const routeIds = useMemo(() => filterRouteIdsByCity(effectiveCityCode, rawRouteIds), [rawRouteIds, effectiveCityCode]);

    const routeMainColor = useMemo(
        () => getRouteMeta(routeName, effectiveCityCode).colorTheme.main,
        [routeName, effectiveCityCode]
    );

    const validRouteIds = useMemo(() => {
        const available = routeIds.filter((id) => {
            if (!isRouteAllowedInCity(effectiveCityCode, id)) return false;
            const data = polylineMap.get(id);
            return data && (data.upPolyline.length > 0 || data.downPolyline.length > 0);
        });
        if (available.length > 0) return available;
        if (activeRouteId && polylineMap.has(activeRouteId)) {
            if (!isRouteAllowedInCity(effectiveCityCode, activeRouteId)) return [];
            const data = polylineMap.get(activeRouteId);
            if (data && (data.upPolyline.length > 0 || data.downPolyline.length > 0)) {
                return [activeRouteId];
            }
        }
        return routeIds.slice(0, 1);
    }, [routeIds, polylineMap, activeRouteId, effectiveCityCode]);

    const activeGeoJson = useMemo(() => {
        return buildSegmentedRouteGeoJson(validRouteIds, polylineMap, routeMainColor);
    }, [validRouteIds, polylineMap, routeMainColor]);

    // Map each stop ID to its corresponding polyline segment color
    const stopColorMap = useMemo(() => {
        const colorMap = new Map<string, string>();
        const features = activeGeoJson?.features || [];
        if (features.length === 0) return colorMap;

        for (const stop of routeStops) {
            const color = findNearestFeatureColor(stop.gpslati, stop.gpslong, features, routeMainColor);
            const key = getBusStopKey(stop);
            colorMap.set(key, color);
            colorMap.set(stop.nodeid, color);
        }

        return colorMap;
    }, [routeStops, activeGeoJson, routeMainColor]);

    // Only update React view state on moveend/zoomend (WebGL layers handle per-frame pan/zoom natively)
    useEffect(() => {
        if (!map) return;

        const updateViewState = () => {
            setZoom(map.getZoom());
            const c = map.getCenter();
            if (c) {
                setCenterCoords({lat: c.lat, lng: c.lng});
            }
        };

        updateViewState();

        map.on("zoomend", updateViewState);
        map.on("moveend", updateViewState);

        return () => {
            map.off("zoomend", updateViewState);
            map.off("moveend", updateViewState);
        };
    }, [map]);

    const [eventFocusedStop, setEventFocusedStop] = useState<BusStop | null>(null);
    const [hoveredStopKey, setHoveredStopKey] = useState<string | null>(null);
    const [prevFocusedCityCode, setPrevFocusedCityCode] = useState(effectiveCityCode);
    if (prevFocusedCityCode !== effectiveCityCode) {
        setPrevFocusedCityCode(effectiveCityCode);
        setEventFocusedStop(null);
        setHoveredStopKey(null);
    }
    const activeFocusedStopId = focusedStopId || eventFocusedStop?.nodeid || null;

    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleFocusStop = (e: Event) => {
            const detail = (e as CustomEvent<BusStop>).detail;
            if (detail && detail.nodeid) {
                setEventFocusedStop({...detail});
            }
        };
        const handleClearFocus = () => {
            setEventFocusedStop(null);
        };
        window.addEventListener("wbus:focus-stop", handleFocusStop);
        window.addEventListener("wbus:close-stop-popup", handleClearFocus);
        window.addEventListener("wbus:close-popups", handleClearFocus);
        return () => {
            window.removeEventListener("wbus:focus-stop", handleFocusStop);
            window.removeEventListener("wbus:close-stop-popup", handleClearFocus);
            window.removeEventListener("wbus:close-popups", handleClearFocus);
        };
    }, []);

    const handleClearFocused = useCallback(() => {
        setEventFocusedStop(null);
        onClearFocusedStop?.();
    }, [onClearFocusedStop]);

    const favoriteNodeIds = useMemo(
        () => new Set(favoriteStops.map((s) => s.nodeid)),
        [favoriteStops]
    );

    const {geoJson: stopsGeoJson, stopByKey} = useMemo(
        () =>
            buildBusStopsGeoJson({
                routeStops,
                favoriteStops,
                nearbyStops,
                showNearbyStops,
                stopColorMap,
                routeMainColor,
                favoriteNodeIds,
            }),
        [routeStops, favoriteStops, nearbyStops, showNearbyStops, stopColorMap, routeMainColor, favoriteNodeIds]
    );

    const stopByKeyRef = useRef(stopByKey);
    useEffect(() => {
        stopByKeyRef.current = stopByKey;
    }, [stopByKey]);

    // Handle click and hover interactions on WebGL stop layers
    useEffect(() => {
        if (!map) return;
        const mapInstance = map.getMap();
        if (!mapInstance) return;

        const handleLayerClick = (e: MapLayerMouseEvent) => {
            const feature = e.features?.[0];
            const stopKey = feature?.properties?.stopKey as string | undefined;
            if (!stopKey) return;

            const stop = stopByKeyRef.current.get(stopKey);
            if (!stop) return;

            e.preventDefault();

            if (isDesktop) {
                window.dispatchEvent(new CustomEvent("wbus:focus-stop", {detail: stop}));
                window.dispatchEvent(new CustomEvent("wbus:open-bus-list"));
                return;
            }

            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("wbus:close-stop-popup"));
                window.dispatchEvent(new CustomEvent("wbus:close-bus-list"));
                window.dispatchEvent(new CustomEvent("wbus:close-timetable"));
            }
            setEventFocusedStop(stop);

            if (stop.gpslong && stop.gpslati) {
                map.easeTo({
                    center: [stop.gpslong, stop.gpslati],
                    offset: [0, -120],
                    duration: 350,
                });
            }
        };

        const handleLayerMouseMove = (e: MapLayerMouseEvent) => {
            mapInstance.getCanvas().style.cursor = "pointer";
            if (!isDesktop) return;
            const stopKey = e.features?.[0]?.properties?.stopKey as string | undefined;
            setHoveredStopKey((prev) => (prev === (stopKey ?? null) ? prev : (stopKey ?? null)));
        };

        const handleLayerMouseLeave = () => {
            mapInstance.getCanvas().style.cursor = "";
            setHoveredStopKey((prev) => (prev === null ? prev : null));
        };

        const layerIds = [...STOP_INTERACTIVE_LAYER_IDS];
        for (const layerId of layerIds) {
            mapInstance.on("click", layerId, handleLayerClick);
            mapInstance.on("mousemove", layerId, handleLayerMouseMove);
            mapInstance.on("mouseleave", layerId, handleLayerMouseLeave);
        }

        return () => {
            for (const layerId of layerIds) {
                mapInstance.off("click", layerId, handleLayerClick);
                mapInstance.off("mousemove", layerId, handleLayerMouseMove);
                mapInstance.off("mouseleave", layerId, handleLayerMouseLeave);
            }
        };
    }, [map, isDesktop]);

    const handleSelectOppositeStop = useCallback(
        (targetStop: BusStop) => {
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("wbus:focus-stop", {detail: targetStop}));
            }
            if (map && targetStop.gpslong && targetStop.gpslati) {
                map.easeTo({
                    center: [targetStop.gpslong, targetStop.gpslati],
                    offset: [0, -120],
                    duration: 450,
                });
            }
        },
        [map]
    );

    // Resolve only the active DOM markers (focused stop + optional desktop hovered stop)
    const activeDomStops = useMemo(() => {
        const result: Array<{ stop: BusStop; isRouteStop: boolean; color: string; isFocused: boolean }> = [];
        const addedIds = new Set<string>();

        const resolveMeta = (stop: BusStop) => {
            const isRoute = routeStops.some((s) => s.nodeid === stop.nodeid);
            const key = getBusStopKey(stop);
            const color = isRoute
                ? stopColorMap.get(key) || stopColorMap.get(stop.nodeid) || routeMainColor
                : favoriteNodeIds.has(stop.nodeid)
                    ? "#f59e0b"
                    : "#64748b";
            return {isRouteStop: isRoute, color};
        };

        if (activeFocusedStopId) {
            const focused =
                eventFocusedStop?.nodeid === activeFocusedStopId
                    ? eventFocusedStop
                    : routeStops.find((s) => s.nodeid === activeFocusedStopId) ||
                    favoriteStops.find((s) => s.nodeid === activeFocusedStopId) ||
                    nearbyStops.find((s) => s.nodeid === activeFocusedStopId) ||
                    null;

            if (focused) {
                addedIds.add(focused.nodeid);
                result.push({stop: focused, ...resolveMeta(focused), isFocused: true});
            }
        }

        if (isDesktop && hoveredStopKey) {
            const hovered = stopByKey.get(hoveredStopKey);
            if (hovered && !addedIds.has(hovered.nodeid)) {
                addedIds.add(hovered.nodeid);
                result.push({stop: hovered, ...resolveMeta(hovered), isFocused: false});
            }
        }

        return result;
    }, [
        activeFocusedStopId,
        eventFocusedStop,
        routeStops,
        favoriteStops,
        nearbyStops,
        isDesktop,
        hoveredStopKey,
        stopByKey,
        stopColorMap,
        routeMainColor,
        favoriteNodeIds,
    ]);

    const allStopsForPairing = useMemo(
        () => [...routeStops, ...favoriteStops, ...nearbyStops],
        [routeStops, favoriteStops, nearbyStops]
    );

    const textHaloColor = isDark ? "rgba(15, 23, 42, 0.92)" : "rgba(255, 255, 255, 0.95)";
    const labelColorPrimary = isDark ? "#f8fafc" : "#0f172a";
    const labelColorNearby = isDark ? "#cbd5e1" : "#475569";

    return (
        <>
            <Source id={STOP_SOURCE_ID} type="geojson" data={stopsGeoJson}>
                {/* 1. Nearby non-route stop circles (zoom >= 14.3) */}
                <Layer
                    id={STOP_CIRCLE_NEARBY_LAYER_ID}
                    type="circle"
                    minzoom={14.3}
                    filter={["all", ["==", ["get", "isRouteStop"], false], ["==", ["get", "isFavorite"], false]]}
                    paint={{
                        "circle-radius": ["interpolate", ["linear"], ["zoom"], 14.3, 4, 16, 5.5],
                        "circle-color": isDark ? "#1e293b" : "#ffffff",
                        "circle-stroke-width": 1.5,
                        "circle-stroke-color": isDark ? "#64748b" : "#94a3b8",
                        "circle-opacity": 0.92,
                    }}
                />

                {/* 2. Route & Favorite stop circles (zoom >= 12.0) */}
                <Layer
                    id={STOP_CIRCLE_ROUTE_LAYER_ID}
                    type="circle"
                    minzoom={12.0}
                    filter={["any", ["==", ["get", "isRouteStop"], true], ["==", ["get", "isFavorite"], true]]}
                    paint={{
                        "circle-radius": [
                            "case",
                            ["==", ["get", "isFavorite"], true],
                            ["interpolate", ["linear"], ["zoom"], 12, 4.5, 14.3, 6.5, 16, 7.5],
                            ["interpolate", ["linear"], ["zoom"], 12, 3.5, 14.3, 5.5, 16, 6.5],
                        ],
                        "circle-color": ["case", ["==", ["get", "isFavorite"], true], "#f59e0b", ["get", "color"]],
                        "circle-stroke-width": 2,
                        "circle-stroke-color": isDark ? "#0f172a" : "#ffffff",
                    }}
                />

                {/* 3. Native WebGL symbol labels with GPU collision detection */}
                {showStopLabels && (
                    <Layer
                        id={STOP_LABEL_PRIORITY_LAYER_ID}
                        type="symbol"
                        minzoom={12.0}
                        filter={["==", ["get", "isFavorite"], true]}
                        layout={{
                            "text-field": ["get", "nodenm"],
                            "text-font": ["Noto Sans Bold"],
                            "text-size": 11.5,
                            "text-anchor": "left",
                            "text-offset": [0.85, 0],
                            "text-allow-overlap": false,
                            "text-ignore-placement": false,
                            "symbol-sort-key": ["get", "sortKey"],
                            "text-padding": 4,
                        }}
                        paint={{
                            "text-color": labelColorPrimary,
                            "text-halo-color": textHaloColor,
                            "text-halo-width": 2,
                        }}
                    />
                )}

                {showStopLabels && (
                    <Layer
                        id={STOP_LABEL_ROUTE_LAYER_ID}
                        type="symbol"
                        minzoom={14.2}
                        filter={["all", ["==", ["get", "isRouteStop"], true], ["==", ["get", "isFavorite"], false]]}
                        layout={{
                            "text-field": ["get", "nodenm"],
                            "text-font": ["Noto Sans Bold"],
                            "text-size": 11.5,
                            "text-anchor": "left",
                            "text-offset": [0.85, 0],
                            "text-allow-overlap": false,
                            "text-ignore-placement": false,
                            "symbol-sort-key": ["get", "sortKey"],
                            "text-padding": 4,
                        }}
                        paint={{
                            "text-color": labelColorPrimary,
                            "text-halo-color": textHaloColor,
                            "text-halo-width": 2,
                        }}
                    />
                )}

                {showStopLabels && (
                    <Layer
                        id={STOP_LABEL_NEARBY_LAYER_ID}
                        type="symbol"
                        minzoom={15.6}
                        filter={["all", ["==", ["get", "isRouteStop"], false], ["==", ["get", "isFavorite"], false]]}
                        layout={{
                            "text-field": ["get", "nodenm"],
                            "text-font": ["Noto Sans Bold"],
                            "text-size": 11,
                            "text-anchor": "left",
                            "text-offset": [0.8, 0],
                            "text-allow-overlap": false,
                            "text-ignore-placement": false,
                            "symbol-sort-key": ["get", "sortKey"],
                            "text-padding": 4,
                        }}
                        paint={{
                            "text-color": labelColorNearby,
                            "text-halo-color": textHaloColor,
                            "text-halo-width": 2,
                        }}
                    />
                )}
            </Source>

            {/* Render rich DOM marker + bottom sheet ONLY for focused / hovered stop (max 1-2 nodes) */}
            {activeDomStops.map(({stop, isRouteStop, color, isFocused}) => {
                const key = getBusStopKey(stop);
                const isFav = isFavoriteStop(stop.nodeid);
                const pairedOppositeStop = isFocused ? findPairedOppositeStop(stop, allStopsForPairing) : null;

                return (
                    <BusStopMarkerItem
                        key={key}
                        stop={stop}
                        cityCode={effectiveCityCode}
                        currentRouteName={routeName}
                        isRouteStop={isRouteStop}
                        isFavorite={isFav}
                        isCompactNode={false}
                        onToggleFavorite={toggleFavoriteStop}
                        showLabel={true}
                        labelPlacement="right"
                        pairedOppositeStop={pairedOppositeStop}
                        onSelectOppositeStop={handleSelectOppositeStop}
                        color={color}
                        onRouteChange={onRouteChange}
                        initialOpen={isFocused}
                        onClearInitialOpen={handleClearFocused}
                    />
                );
            })}
        </>
    );
};

export default BusStopMarker;
