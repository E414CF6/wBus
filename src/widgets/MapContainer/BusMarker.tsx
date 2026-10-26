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
import {useCityContext} from "@entities/city";

import PopupMarquee from "@shared/ui/MarqueeText";

import {LocateFixed, Navigation} from "lucide-react";
import React, {memo, useCallback, useEffect, useMemo, useState} from "react";
import {Popup} from "react-map-gl/maplibre";
import BusAnimatedMarker from "./BusAnimatedMarker";

// ----------------------------------------------------------------------
// Constants & Styles
// ----------------------------------------------------------------------

const SETTINGS = MAP_SETTINGS.MARKERS.BUS;
const SNAP_INDEX_RANGE = 80;

// ----------------------------------------------------------------------
// Sub-Component: Bus Icon DOM
// ----------------------------------------------------------------------

interface BusIconDOMProps {
    routeNumber: string;
    color?: string;
    isSelected?: boolean;
    isFollowed?: boolean;
}

/**
 * Clean, minimalist top-down bus marker capsule.
 */
const BusIconDOM = memo(({routeNumber, color, isSelected, isFollowed}: BusIconDOMProps) => {
    const [w, h] = SETTINGS.ICON_SIZE;
    const themeColor = color || "#2563eb";

    return (
        <div
            className={`bus-marker-with-label relative transition-transform duration-150 ${
                isSelected || isFollowed ? "scale-115 z-50" : "z-10"
            }`}
            style={{
                width: w,
                height: h,
                filter:
                    isSelected || isFollowed
                        ? `drop-shadow(0 0 10px ${themeColor}) drop-shadow(0 4px 12px rgba(0,0,0,0.4))`
                        : "drop-shadow(0 3px 8px rgba(0,0,0,0.3))",
            }}
        >
            {isFollowed && (
                <span
                    className="animate-ping absolute -inset-1 rounded-2xl opacity-45 pointer-events-none"
                    style={{backgroundColor: themeColor}}
                />
            )}
            <svg
                width={w}
                height={h}
                viewBox="0 0 40 50"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-label={UI_TEXT.ACCESSIBILITY.BUS_ICON_ALT}
                role="img"
            >
                <rect x="4" y="2" width="32" height="50" rx="10" fill={themeColor}/>
            </svg>
            <div
                className="bus-route-text-container absolute top-1 left-1/2 -translate-x-1/2 text-white text-[11px] font-extrabold px-1 py-px rounded-lg border-[1.5px] border-white shadow-[0_2px_6px_rgba(0,0,0,0.3)] tracking-[0.3px] min-w-7 max-w-7 flex items-center justify-center select-none"
                style={{backgroundColor: themeColor}}
            >
                <PopupMarquee text={routeNumber} maxWidthClass="max-w-7"/>
            </div>
        </div>
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
                className="min-w-64 sm:min-w-72 flex flex-col bg-white/95 dark:bg-[#111111]/95 backdrop-blur-3xl rounded-[28px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-black/4 dark:border-white/6">
                {/* Header */}
                <div className="bg-transparent px-4 py-3.5 border-b border-black/5 dark:border-white/5">
                    <div className="flex items-center justify-between gap-2 text-black dark:text-white">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div
                                className="p-1.5 rounded-[10px] flex items-center justify-center text-white shrink-0 shadow-xs"
                                style={{
                                    backgroundColor: themeColor || "#2563eb",
                                }}
                            >
                                <DirectionIcon className="w-4 h-4" strokeWidth={2.5} aria-hidden="true"/>
                            </div>
                            <span className="font-extrabold text-lg tracking-tight leading-none truncate">
                                {UI_TEXT.BUS_LIST.TITLE_ROUTE(bus.routenm || routeName || "")}
                            </span>
                        </div>
                        <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0"
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
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest shrink-0">
                            {UI_TEXT.BUS_ITEM.VEHICLE_NUM}
                        </span>
                        <div
                            className="font-mono font-bold text-sm text-gray-800 dark:text-gray-200 bg-black/4 dark:bg-white/6 px-2.5 py-1 rounded-lg">
                            {bus.vehicleno}
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest shrink-0">
                            {UI_TEXT.BUS_ITEM.CURRENT_LOC}
                        </span>
                        <div className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 min-w-0">
                            <PopupMarquee text={stopName} maxWidthClass="max-w-[155px]"/>
                        </div>
                    </div>

                    {onToggleFollow && (
                        <button
                            type="button"
                            onClick={onToggleFollow}
                            className={`w-full mt-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                                isFollowed
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                                    : "bg-slate-100 hover:bg-slate-200 dark:bg-white/8 dark:hover:bg-white/14 text-slate-700 dark:text-slate-200"
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
    const effectiveCityCode = cityCode || currentCity?.code || "32020";

    // Data Fetching
    const {
        routeInfo,
        busList,
        getDirection,
        polylineMap,
        fallbackPolylines,
        activeRouteId,
    } = useBusData(routeName, enabled, effectiveCityCode);

    const [selectedBusKey, setSelectedBusKey] = useState<string | null>(null);
    const [followedBusKey, setFollowedBusKey] = useState<string | null>(null);
    const [livePositions, setLivePositions] = useState<Record<string, Coordinate>>({});

    const handleLivePositionChange = useCallback((key: string, pos: Coordinate) => {
        setLivePositions((prev) => {
            const current = prev[key];
            if (current && current[0] === pos[0] && current[1] === pos[1]) return prev;
            return {...prev, [key]: pos};
        });
    }, []);

    const [prevRouteName, setPrevRouteName] = useState(routeName);
    if (routeName !== prevRouteName) {
        setPrevRouteName(routeName);
        setSelectedBusKey(null);
        setFollowedBusKey(null);
    }

    const effectiveAnimationDuration = MAP_SETTINGS.ANIMATION.BUS_MOVE_MS;
    const effectivePollingIntervalMs = API_CONFIG.LIVE.POLLING_INTERVAL_MS;
    const effectiveDataDelayMs = API_CONFIG.LIVE.DATA_DELAY_MS;

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

    if (!routeInfo || markers.length === 0) return null;

    const selectedMarker = selectedBusKey ? markers.find((m) => m.key === selectedBusKey) : null;
    const selectedPosition = selectedBusKey && selectedMarker ? (livePositions[selectedBusKey] || selectedMarker.position) : null;

    return (
        <>
            {markers.map(
                ({
                     key,
                     bus,
                     position,
                     angle,
                     polyline,
                     snapIndexHint,
                     stopCoordIndices,
                     refreshKey,
                     markerColor,
                 }) => {
                    const isSelected = selectedBusKey === key;
                    const isFollowed = followedBusKey === key;

                    return (
                        <BusAnimatedMarker
                            key={key}
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
                            onPositionChange={isSelected || isFollowed ? (pos) => handleLivePositionChange(key, pos) : undefined}
                            onClick={() => {
                                setSelectedBusKey(key);
                                onPopupOpen?.(routeName);
                            }}
                        >
                            <BusIconDOM
                                routeNumber={bus.routenm || routeName}
                                color={markerColor}
                                isSelected={isSelected}
                                isFollowed={isFollowed}
                            />
                        </BusAnimatedMarker>
                    );
                }
            )}

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

