"use client";

import {getDirectionIcon} from "@entities/bus/directionIcons";
import {getBusMarkerColor} from "@entities/route/routeColor";
import {getRouteMeta} from "@entities/route/routeMetadata";

import {getSnappedPosition} from "@features/live-tracking";

import type {BusItem} from "@entities/bus/types";
import type {Coordinate} from "@shared/utils/geo";

import {useBusData} from "@features/live-tracking/useBusData";

import {API_CONFIG, MAP_SETTINGS} from "@shared/config/env";
import {UI_TEXT} from "@shared/config/locale";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {useCityContext} from "@entities/city";

import {LocateFixed, Navigation} from "lucide-react";
import React, {memo, useCallback, useEffect, useMemo, useState} from "react";
import {Popup} from "react-map-gl/maplibre";
import type {LngLatBounds} from "maplibre-gl";
import BusAnimatedMarker from "./BusAnimatedMarker";

// ----------------------------------------------------------------------
// Constants & Styles
// ----------------------------------------------------------------------

const SNAP_INDEX_RANGE = 80;

// ----------------------------------------------------------------------
// Sub-Component: Bus Icon DOM
// ----------------------------------------------------------------------

interface BusIconDOMProps {
    routeNumber: string;
    color?: string;
    isSelected?: boolean;
    isFollowed?: boolean;
    plateNumber?: string;
}

const BusHeadingConeSVG = memo(({color}: { color: string }) => (
    <svg
        width="44"
        height="44"
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <path
            d="M22 22 L12.5 5.5 A19 19 0 0 1 31.5 5.5 Z"
            fill={color}
            fillOpacity="0.22"
        />
        <path
            d="M22 2.2 L27.2 10.6 L22 8.8 L16.8 10.6 Z"
            fill={color}
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinejoin="round"
        />
        <circle
            cx="22"
            cy="22"
            r="14.2"
            stroke={color}
            strokeOpacity="0.4"
            strokeWidth="1.25"
        />
    </svg>
));

BusHeadingConeSVG.displayName = "BusHeadingConeSVG";

/**
 * Always-upright transit bus route capsule & optional plate pill.
 */
const BusIconDOM = memo(({routeNumber, color, isSelected, isFollowed, plateNumber}: BusIconDOMProps) => {
    const themeColor = color || "#2563eb";
    const cleanRoute = (routeNumber || "").trim();
    const isMarquee = cleanRoute.length >= 4;
    const shortPlate = plateNumber ? plateNumber.trim().slice(-4) : "";

    return (
        <>
            {isFollowed && (
                <span
                    className="motion-safe:animate-ping absolute inset-1 rounded-full opacity-40 pointer-events-none"
                    style={{backgroundColor: themeColor}}
                />
            )}

            <div
                role="img"
                aria-label={UI_TEXT.ACCESSIBILITY.BUS_ICON_ALT}
                className={`relative z-10 flex items-center h-6 min-w-7.5 max-w-9 px-1.5 rounded-full text-white text-[11px] font-extrabold border-2 border-white tracking-tight overflow-hidden ${
                    isMarquee ? "justify-start" : "justify-center"
                }`}
                style={{
                    backgroundColor: themeColor,
                    boxShadow:
                        isSelected || isFollowed
                            ? `0 0 0 2px ${themeColor}55, 0 4px 12px rgba(0,0,0,0.4)`
                            : "0 3px 10px rgba(0,0,0,0.3)",
                }}
            >
                {isMarquee ? (
                    <div className="marquee-scroll flex-nowrap items-center hover:[animation-play-state:paused]">
                        <span className="pr-2 whitespace-nowrap shrink-0">{cleanRoute}</span>
                        <span className="pr-2 whitespace-nowrap shrink-0" aria-hidden="true">{cleanRoute}</span>
                    </div>
                ) : (
                    <span
                        className={`text-center whitespace-nowrap select-none leading-none ${
                            cleanRoute.length === 3 ? "text-[10px] tracking-tight" : ""
                        }`}
                    >
                        {cleanRoute}
                    </span>
                )}
            </div>

            {shortPlate && (
                <span
                    className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-20 px-1.5 py-0.5 rounded-full bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 text-[9px] font-mono font-bold leading-none whitespace-nowrap shadow-sm border border-black/15 dark:border-white/20 pointer-events-none select-none">
                    {shortPlate}
                </span>
            )}
        </>
    );
});

BusIconDOM.displayName = "BusIconDOM";

// ----------------------------------------------------------------------
// Sub-Component: Popup Content
// ----------------------------------------------------------------------

const BusPopupContent = memo(
    ({
         bus,
         routeName,
         stopName,
         DirectionIcon,
         themeColor,
         direction,
         isFollowed,
         onToggleFollow,
     }: {
        bus: BusItem;
        routeName?: string;
        stopName: string;
        DirectionIcon: React.ElementType;
        themeColor?: string;
        direction?: number | null;
        isFollowed?: boolean;
        onToggleFollow?: () => void;
    }) => {
        const directionLabel =
            direction === 1
                ? "상행"
                : direction === 0
                    ? "하행"
                    : "운행 중";

        return (
            <div
                className="min-w-64 sm:min-w-72 flex flex-col bg-white/95 dark:bg-[#111116]/95 backdrop-blur-3xl rounded-3xl overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.7)] border border-black/10 dark:border-white/10">
                {/* Header */}
                <div className="bg-transparent px-4 py-3.5 border-b border-black/5 dark:border-white/5">
                    <div className="flex items-center justify-between gap-2 text-black dark:text-white">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div
                                className="p-1.5 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                                style={{
                                    backgroundColor: themeColor || "#2563eb",
                                }}
                            >
                                <DirectionIcon className="w-4 h-4" strokeWidth={2.5} aria-hidden="true"/>
                            </div>
                            <span className="font-black text-lg tracking-tight leading-none truncate">
                                {UI_TEXT.BUS_LIST.TITLE_ROUTE(bus.routenm || routeName || "")}
                            </span>
                        </div>
                        <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-black shrink-0"
                            style={{
                                backgroundColor: `${themeColor || "#2563eb"}18`,
                                color: themeColor || "#2563eb",
                                border: `1px solid ${themeColor || "#2563eb"}35`,
                            }}
                        >
                            {directionLabel}
                        </span>
                    </div>
                </div>

                {/* Body */}
                <div className="px-4 py-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                        <span
                            className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">
                            {UI_TEXT.BUS_ITEM.VEHICLE_NUM}
                        </span>
                        <div
                            className="font-mono font-black text-xs text-slate-800 dark:text-slate-100 bg-black/5 dark:bg-white/10 px-2.5 py-1 rounded-xl border border-black/5 dark:border-white/10 tracking-tight">
                            {bus.vehicleno}
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <span
                            className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">
                            {UI_TEXT.BUS_ITEM.CURRENT_LOC}
                        </span>
                        <div className="text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-100 min-w-0">
                            <p className="truncate max-w-[155px] font-bold" title={stopName}>{stopName}</p>
                        </div>
                    </div>

                    {onToggleFollow && (
                        <button
                            type="button"
                            onClick={onToggleFollow}
                            className={`w-full mt-1.5 py-2 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                                isFollowed
                                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-500/30"
                                    : "bg-slate-100 hover:bg-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 border border-black/5 dark:border-white/10"
                            }`}
                        >
                            {isFollowed ? (
                                <>
                                    <Navigation className="w-3.5 h-3.5 animate-pulse"/>
                                    <span>버스 따라가는 중</span>
                                </>
                            ) : (
                                <>
                                    <LocateFixed className="w-3.5 h-3.5"/>
                                    <span>버스 따라가기</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        );
    }
);

BusPopupContent.displayName = "BusPopupContent";

interface MarkerItemComponentProps {
    markerKey: string;
    bus: BusItem;
    position: Coordinate;
    angle?: number;
    polyline: Coordinate[];
    snapIndexHint: number | null;
    stopCoordIndices: number[];
    refreshKey: string;
    markerColor: string;
    isSelected: boolean;
    isFollowed: boolean;
    showPlateNumber?: boolean;
    routeName: string;
    effectiveAnimationDuration: number;
    effectivePollingIntervalMs: number;
    effectiveDataDelayMs: number;
    onPositionChange?: (key: string, pos: Coordinate) => void;
    onClick: (key: string) => void;
}

const MarkerItemComponent = memo(function MarkerItemComponent({
                                                                  markerKey,
                                                                  bus,
                                                                  position,
                                                                  angle,
                                                                  polyline,
                                                                  snapIndexHint,
                                                                  stopCoordIndices,
                                                                  refreshKey,
                                                                  markerColor,
                                                                  isSelected,
                                                                  isFollowed,
                                                                  showPlateNumber = false,
                                                                  routeName,
                                                                  effectiveAnimationDuration,
                                                                  effectivePollingIntervalMs,
                                                                  effectiveDataDelayMs,
                                                                  onPositionChange,
                                                                  onClick,
                                                              }: MarkerItemComponentProps) {
    const handlePosChange = useCallback(
        (pos: Coordinate) => {
            onPositionChange?.(markerKey, pos);
        },
        [markerKey, onPositionChange]
    );

    const handleClick = useCallback(() => {
        onClick(markerKey);
    }, [markerKey, onClick]);

    const themeColor = markerColor || "#2563eb";
    const headingOverlay = useMemo(() => <BusHeadingConeSVG color={themeColor}/>, [themeColor]);
    const wrapperClassName = `relative flex items-center justify-center w-11 h-11 transition-transform duration-150 select-none ${
        isSelected || isFollowed ? "scale-115 z-50" : "z-10 hover:scale-105"
    }`;

    return (
        <BusAnimatedMarker
            position={position}
            rotationAngle={(angle || 0) % 360}
            polyline={polyline}
            snapIndexHint={snapIndexHint}
            snapIndexRange={SNAP_INDEX_RANGE}
            animationDuration={effectiveAnimationDuration}
            pollingIntervalMs={effectivePollingIntervalMs}
            dataDelayMs={effectiveDataDelayMs}
            stopCoordIndices={stopCoordIndices}
            refreshKey={refreshKey}
            onPositionChange={isSelected || isFollowed ? handlePosChange : undefined}
            onClick={handleClick}
            headingOverlay={headingOverlay}
            wrapperClassName={wrapperClassName}
        >
            <BusIconDOM
                routeNumber={bus.routenm || routeName}
                color={themeColor}
                isSelected={isSelected}
                isFollowed={isFollowed}
                plateNumber={showPlateNumber || isSelected || isFollowed ? bus.vehicleno : undefined}
            />
        </BusAnimatedMarker>
    );
});

MarkerItemComponent.displayName = "MarkerItemComponent";

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
