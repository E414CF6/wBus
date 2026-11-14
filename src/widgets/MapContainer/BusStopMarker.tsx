"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useBusStop, useFavoriteStops, useNearbyStops} from "@entities/station/hooks";
import type {BusStop} from "@entities/station/types";
import {computeOptimalLabelPlacements} from "@entities/station/busStopMarkerUtils";
import {MAP_SETTINGS} from "@shared/config/env";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useCityContext} from "@entities/city";
import {filterRouteIdsByCity, isRouteAllowedInCity} from "@entities/city/routeBoundary";
import {useRoutePolylineData} from "@features/live-tracking";
import {getRouteMeta} from "@entities/route/routeMetadata";
import {buildSegmentedRouteGeoJson} from "@entities/route/polylineService";
import {findNearestFeatureColor} from "./lib/markerGeometry";
import {BusStopMarkerItem} from "./ui/BusStopMarkerItem";
import {useVisibleStops} from "./hooks/useVisibleStops";

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
    const [zoom, setZoom] = useState(map?.getZoom() ?? MAP_SETTINGS.ZOOM.DEFAULT);
    const [bounds, setBounds] = useState(map?.getBounds() ?? null);
    const [centerCoords, setCenterCoords] = useState<{ lat: number; lng: number } | null>(() => {
        const c = map?.getCenter();
        return c ? {lat: c.lat, lng: c.lng} : null;
    });
    const rafRef = useRef<number | null>(null);

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
            const key = `${stop.nodeid}-${stop.updowncd ?? "na"}`;
            colorMap.set(key, color);
            colorMap.set(stop.nodeid, color);
        }

        return colorMap;
    }, [routeStops, activeGeoJson, routeMainColor]);

    // Track map zoom and viewport center/bounds
    useEffect(() => {
        if (!map) return;

        const updateViewState = () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                setZoom(map.getZoom());
                setBounds(map.getBounds());
                const c = map.getCenter();
                if (c) {
                    setCenterCoords({lat: c.lat, lng: c.lng});
                }
            });
        };

        updateViewState();

        map.on("zoomend", updateViewState);
        map.on("moveend", updateViewState);
        map.on("zoom", updateViewState);
        map.on("move", updateViewState);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            map.off("zoomend", updateViewState);
            map.off("moveend", updateViewState);
            map.off("zoom", updateViewState);
            map.off("move", updateViewState);
        };
    }, [map]);

    const [eventFocusedStop, setEventFocusedStop] = useState<BusStop | null>(null);
    const [prevFocusedCityCode, setPrevFocusedCityCode] = useState(effectiveCityCode);
    if (prevFocusedCityCode !== effectiveCityCode) {
        setPrevFocusedCityCode(effectiveCityCode);
        setEventFocusedStop(null);
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

    // Viewport-aware visible stops derivation
    const visibleStops = useVisibleStops({
        routeStops,
        favoriteStops,
        nearbyStops,
        showNearbyStops,
        showStopLabels,
        bounds,
        zoom,
        stopColorMap,
        routeMainColor,
        activeFocusedStopId,
        eventFocusedStop,
    });

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

    const placementsMap = useMemo(() => {
        return computeOptimalLabelPlacements(visibleStops, map, centerCoords, activeFocusedStopId);
    }, [visibleStops, map, centerCoords, activeFocusedStopId]);

    const isCompactNode = zoom < 14.3;

    return (
        <>
            {visibleStops.map((stop, index) => {
                const key = stop.nodeid ? `${stop.nodeid}-${stop.updowncd ?? "na"}` : `stop-${index}`;
                const isFav = isFavoriteStop(stop.nodeid);
                const isFocused = Boolean(activeFocusedStopId && stop.nodeid === activeFocusedStopId);
                const placementInfo = placementsMap.get(stop.nodeid) || {
                    placement: "right" as const,
                    showLabel: stop.showLabel,
                };

                return (
                    <BusStopMarkerItem
                        key={key}
                        stop={stop}
                        cityCode={effectiveCityCode}
                        currentRouteName={routeName}
                        isRouteStop={stop.isRouteStop}
                        isFavorite={isFav}
                        isCompactNode={isCompactNode}
                        onToggleFavorite={toggleFavoriteStop}
                        showLabel={placementInfo.showLabel}
                        labelPlacement={placementInfo.placement}
                        disambiguationLabel={placementInfo.disambiguationLabel}
                        pairedOppositeStop={placementInfo.pairedOppositeStop}
                        onSelectOppositeStop={handleSelectOppositeStop}
                        color={stop.color}
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
