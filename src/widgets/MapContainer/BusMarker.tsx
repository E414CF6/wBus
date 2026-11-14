"use client";

import {getDirectionIcon} from "@entities/bus/directionIcons";
import {getBusMarkerColor} from "@entities/route/routeColor";
import {getRouteMeta} from "@entities/route/routeMetadata";

import {getSnappedPosition} from "@features/live-tracking";

import type {Coordinate} from "@shared/utils/geo";

import {useBusData} from "@features/live-tracking/useBusData";

import {API_CONFIG, MAP_SETTINGS} from "@shared/config/env";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {useCityContext} from "@entities/city";

import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Popup} from "react-map-gl/maplibre";
import type {LngLatBounds} from "maplibre-gl";
import {BusPopupContent} from "./bus-marker/BusPopupContent";
import {MarkerItemComponent} from "./bus-marker/MarkerItemComponent";

const SNAP_INDEX_RANGE = 80;

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

interface BusMarkerProps {
    routeName: string;
    enabled?: boolean;
    onPopupOpen?: (routeName: string) => void;
    onPopupClose?: () => void;
    cityCode?: string;
}

export default function BusMarker({routeName, enabled = true, onPopupOpen, onPopupClose, cityCode}: BusMarkerProps) {
    const {currentCity} = useCityContext();
    const {map} = useAppMapContext();
    const {settings} = useAppSettings();
    const effectiveCityCode = cityCode || currentCity?.code || "32020";

    // Data Fetching
    const {
        routeInfo,
        busList,
        getDirection,
        polylineMap,
        fallbackPolylines,
        activeRouteId,
        serverAgeMs,
    } = useBusData(routeName, enabled, effectiveCityCode);

    const [selectedBusKey, setSelectedBusKey] = useState<string | null>(null);
    const [followedBusKey, setFollowedBusKey] = useState<string | null>(null);
    const [livePositions, setLivePositions] = useState<Record<string, Coordinate>>({});

    const handleLivePositionChange = useCallback((key: string, pos: Coordinate) => {
        setLivePositions((prev) => {
            const current = prev[key];
            if (
                current &&
                Math.abs(current[0] - pos[0]) < 0.00005 &&
                Math.abs(current[1] - pos[1]) < 0.00005
            ) {
                return prev;
            }
            return {...prev, [key]: pos};
        });
    }, []);


    const [prevRouteName, setPrevRouteName] = useState(routeName);
    if (routeName !== prevRouteName) {
        setPrevRouteName(routeName);
        setSelectedBusKey(null);
        setFollowedBusKey(null);
    }

    const effectiveAnimationDuration =
        settings.smoothBusAnimation && !settings.reduceMotion ? MAP_SETTINGS.ANIMATION.BUS_MOVE_MS : 0;
    const effectivePollingIntervalMs = settings.livePollingIntervalMs || API_CONFIG.LIVE.POLLING_INTERVAL_MS;
    const effectiveDataDelayMs =
        typeof serverAgeMs === "number" && Number.isFinite(serverAgeMs)
            ? Math.min(30000, Math.max(0, API_CONFIG.LIVE.DATA_DELAY_MS + serverAgeMs))
            : API_CONFIG.LIVE.DATA_DELAY_MS;

    const routeIndicesMap = useMemo(() => {
        if (!routeInfo) return new Map();

        const map = new Map();
        for (const id of routeInfo.vehicleRouteIds) {
            const polylineSet = polylineMap.get(id) ?? fallbackPolylines;
            const {stopIndexMap, upPolyline, downPolyline} = polylineSet;

            let upIndices: number[] = [];
            let downIndices: number[] = [];

            if (stopIndexMap) {
                const getIndicesForDir = (dir: number) => {
                    const allIndices = new Set<number>();
                    const dirSuffix = `-${dir}`;
                    for (const [key, idx] of Object.entries(stopIndexMap.byIdDir)) {
                        if (key.endsWith(dirSuffix)) allIndices.add(idx as number);
                    }
                    if (allIndices.size === 0) {
                        for (const idx of Object.values(stopIndexMap.byId))
                            allIndices.add(idx as number);
                    }
                    return Array.from(allIndices);
                };

                const rawUp = getIndicesForDir(1);
                const rawDown = getIndicesForDir(0);

                upIndices = rawUp
                    .filter((i) => i >= 0 && i < upPolyline.length)
                    .sort((a, b) => a - b);
                downIndices = rawDown
                    .filter((i) => i >= 0 && i < downPolyline.length)
                    .sort((a, b) => a - b);
            }

            map.set(id, {upIndices, downIndices});
        }
        return map;
    }, [routeInfo, polylineMap, fallbackPolylines]);

    const markers = useMemo(() => {
        if (!routeInfo || busList.length === 0) return [];

        return busList.map((bus) => {
            const effectiveBus = bus.routenm ? bus : {...bus, routenm: routeName};
            const targetRouteId =
                effectiveBus.routeid ?? activeRouteId ?? routeInfo.vehicleRouteIds[0] ?? null;
            const polylineSet = targetRouteId ? polylineMap.get(targetRouteId) : null;
            const {upPolyline, downPolyline, stopIndexMap, turnIndex} =
            polylineSet ?? fallbackPolylines;
            const markerKey = `${routeName}-${effectiveBus.vehicleno}`;

            const snapped = getSnappedPosition(effectiveBus, getDirection, upPolyline, downPolyline, {
                stopIndexMap,
                turnIndex,
                snapIndexRange: SNAP_INDEX_RANGE,
            });
            const activePolyline = snapped.direction === 1 ? upPolyline : downPolyline;

            const routeIndices = targetRouteId ? routeIndicesMap.get(targetRouteId) : null;
            let stopCoordIndices: number[] = [];
            if (routeIndices) {
                stopCoordIndices =
                    snapped.direction === 1 ? routeIndices.upIndices : routeIndices.downIndices;
            }

            const meta = getRouteMeta(routeName, effectiveCityCode);
            const markerColor = getBusMarkerColor(
                effectiveBus.routenm || routeName,
                snapped.direction,
                targetRouteId,
                routeInfo.vehicleRouteIds,
                snapped.position,
                polylineMap,
                meta.routeType
            );

            return {
                key: markerKey,
                bus: effectiveBus,
                position: snapped.position,
                angle: snapped.angle,
                direction: snapped.direction,
                polyline: activePolyline,
                snapIndexHint: snapped.segmentIndex ?? null,
                stopCoordIndices,
                refreshKey: markerKey,
                markerColor,
            };
        });
    }, [
        routeInfo,
        busList,
        getDirection,
        polylineMap,
        fallbackPolylines,
        activeRouteId,
        routeName,
        effectiveCityCode,
        routeIndicesMap,
    ]);

    const followedMarker = followedBusKey ? markers.find((m) => m.key === followedBusKey) : null;
    const followedPosition = followedBusKey && followedMarker ? (livePositions[followedBusKey] || followedMarker.position) : null;

    // Camera follow effect when a bus is locked for live tracking (smoothly tracks live animated marker)
    useEffect(() => {
        if (!map || !followedPosition) return;
        const [lat, lng] = followedPosition;
        if (!lat || !lng) return;
        map.easeTo({
            center: [lng, lat],
            duration: 600,
        });
    }, [map, followedPosition]);

    // Cancel camera follow when user manually drags the map
    useEffect(() => {
        if (!map || !followedBusKey) return;
        const handleDragStart = () => {
            setFollowedBusKey(null);
        };
        map.on("dragstart", handleDragStart);
        return () => {
            map.off("dragstart", handleDragStart);
        };
    }, [map, followedBusKey]);

    // Viewport-based culling for live bus markers: only animate & render buses in visible view (+ buffer)
    const [bounds, setBounds] = useState<LngLatBounds | null>(() => (map ? map.getBounds() : null));

    useEffect(() => {
        if (!map) return;
        let rafId: number | null = null;
        const updateBounds = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                setBounds(map.getBounds());
            });
        };
        map.on("moveend", updateBounds);
        map.on("zoomend", updateBounds);
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            map.off("moveend", updateBounds);
            map.off("zoomend", updateBounds);
        };
    }, [map]);

    const visibleMarkers = useMemo(() => {
        if (!bounds) return markers;

        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        // 25% safety buffer margin around viewport so buses entering the screen are pre-mounted
        const latBuffer = Math.max(Math.abs(ne.lat - sw.lat) * 0.25, 0.01);
        const lngBuffer = Math.max(Math.abs(ne.lng - sw.lng) * 0.25, 0.01);

        const minLat = sw.lat - latBuffer;
        const maxLat = ne.lat + latBuffer;
        const minLng = sw.lng - lngBuffer;
        const maxLng = ne.lng + lngBuffer;

        return markers.filter((m) => {
            // Always render followed or clicked bus regardless of position
            if (m.key === selectedBusKey || m.key === followedBusKey) return true;
            const [lat, lng] = m.position;
            return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
        });
    }, [markers, bounds, selectedBusKey, followedBusKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const closePopup = () => setSelectedBusKey(null);
        window.addEventListener("wbus:close-popups", closePopup);
        window.addEventListener("wbus:close-stop-popup", closePopup);
        return () => {
            window.removeEventListener("wbus:close-popups", closePopup);
            window.removeEventListener("wbus:close-stop-popup", closePopup);
        };
    }, []);

    const handleMarkerClick = useCallback(
        (key: string) => {
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("wbus:close-stop-popup"));
            }
            setSelectedBusKey(key);
            onPopupOpen?.(routeName);
        },
        [routeName, onPopupOpen]
    );

    if (!routeInfo || markers.length === 0) return null;

    const selectedMarker = selectedBusKey ? markers.find((m) => m.key === selectedBusKey) : null;
    const selectedPosition = selectedBusKey && selectedMarker ? (livePositions[selectedBusKey] || selectedMarker.position) : null;

    return (
        <>
            {visibleMarkers.map((marker) => (
                <MarkerItemComponent
                    key={marker.key}
                    markerKey={marker.key}
                    bus={marker.bus}
                    position={marker.position}
                    angle={marker.angle}
                    polyline={marker.polyline}
                    snapIndexHint={marker.snapIndexHint}
                    stopCoordIndices={marker.stopCoordIndices}
                    refreshKey={marker.refreshKey}
                    markerColor={marker.markerColor}
                    isSelected={selectedBusKey === marker.key}
                    isFollowed={followedBusKey === marker.key}
                    showPlateNumber={settings.showBusPlateNumber}
                    routeName={routeName}
                    effectiveAnimationDuration={effectiveAnimationDuration}
                    effectivePollingIntervalMs={effectivePollingIntervalMs}
                    effectiveDataDelayMs={effectiveDataDelayMs}
                    onPositionChange={handleLivePositionChange}
                    onClick={handleMarkerClick}
                />
            ))}

            {selectedMarker && selectedPosition && (
                <Popup
                    longitude={selectedPosition[1]}
                    latitude={selectedPosition[0]}
                    offset={[0, -10]}
                    closeButton={false}
                    closeOnClick={true}
                    onClose={() => {
                        setSelectedBusKey(null);
                        onPopupClose?.();
                    }}
                    maxWidth="none"
                    className="custom-bus-popup"
                    style={{zIndex: 100}}
                >
                    <BusPopupContent
                        bus={selectedMarker.bus}
                        routeName={routeName}
                        stopName={selectedMarker.bus.nodenm || ""}
                        DirectionIcon={getDirectionIcon(selectedMarker.direction)}
                        themeColor={selectedMarker.markerColor}
                        direction={selectedMarker.direction}
                        isFollowed={followedBusKey === selectedMarker.key}
                        onToggleFollow={() =>
                            setFollowedBusKey((prev) =>
                                prev === selectedMarker.key ? null : selectedMarker.key
                            )
                        }
                    />
                </Popup>
            )}
        </>
    );
}
