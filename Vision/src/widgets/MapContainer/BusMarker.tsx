"use client";

import {getDirectionIcon} from "@entities/bus/directionIcons";

import type {BusItem} from "@entities/bus/types";

import {getSnappedPosition} from "@entities/route/snapService";
import {useBusData} from "@features/live-tracking/useBusData";
import {API_CONFIG, MAP_SETTINGS} from "@shared/config/env";
import {UI_TEXT} from "@shared/config/locale";

import PopupMarquee from "@shared/ui/MarqueeText";

import React, {memo, useMemo, useState} from "react";
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

/**
 * Minimal 3D top-down bus marker
 */
const BusIconDOM = memo(({routeNumber}: { routeNumber: string }) => {
    const [w, h] = SETTINGS.ICON_SIZE;

    return (<div
        className="bus-marker-with-label relative"
        style={{width: w, height: h, filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.3))"}}
    >
        <svg
            width={w}
            height={h}
            viewBox="0 0 40 50"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label={UI_TEXT.ACCESSIBILITY.BUS_ICON_ALT}
            role="img"
        >
            <rect x="4" y="2" width="32" height="50" rx="10" fill="#4f46e5"/>
        </svg>
        <div
            className="bus-route-text-container absolute top-1 left-1/2 -translate-x-1/2 bg-[#4f46e5] text-white text-[11px] font-extrabold px-1 py-px rounded-lg border-[1.5px] border-white shadow-[0_2px_8px_rgba(79,70,229,0.3)] tracking-[0.3px] min-w-7 max-w-7 flex items-center justify-center">
            <PopupMarquee text={routeNumber} maxWidthClass="max-w-7"/>
        </div>
    </div>);
});

BusIconDOM.displayName = "BusIconDOM";

// ----------------------------------------------------------------------
// Sub-Component: Popup Content
// ----------------------------------------------------------------------

const BusPopupContent = memo(({bus, stopName, DirectionIcon}: {
    bus: BusItem; stopName: string; DirectionIcon: React.ElementType
}) => (<div
    className="min-w-60 sm:min-w-70 flex flex-col bg-white/95 dark:bg-[#111111]/95 backdrop-blur-3xl rounded-[28px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-black/4 dark:border-white/6">
    {/* Header */}
    <div className="bg-transparent px-4 py-4 border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-2.5 text-black dark:text-white">
            <div
                className="p-1.5 bg-indigo-100/50 dark:bg-indigo-500/20 rounded-[10px] text-indigo-600 dark:text-indigo-400">
                <DirectionIcon className="w-4 h-4" strokeWidth={2.5} aria-hidden="true"/>
            </div>
            <span className="font-extrabold text-lg tracking-tight leading-none">
                    {UI_TEXT.BUS_LIST.TITLE_ROUTE(bus.routenm)}
                </span>
        </div>
    </div>

    {/* Body */}
    <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest shrink-0">
                    {UI_TEXT.BUS_ITEM.VEHICLE_NUM}
                </span>
            <div
                className="font-mono font-bold text-sm text-gray-800 dark:text-gray-200 bg-black/3 dark:bg-white/5 px-2.5 py-1 rounded-lg">
                {bus.vehicleno}
            </div>
        </div>

        <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest shrink-0">
                    {UI_TEXT.BUS_ITEM.CURRENT_LOC}
                </span>
            <div className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 min-w-0">
                <PopupMarquee text={stopName} maxWidthClass="max-w-[150px]"/>
            </div>
        </div>
    </div>
</div>));

BusPopupContent.displayName = "BusPopupContent";

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

interface BusMarkerProps {
    routeName: string;
    onPopupOpen?: (routeName: string) => void;
    onPopupClose?: () => void;
}

export default function BusMarker({routeName, onPopupOpen, onPopupClose}: BusMarkerProps) {
    // Data Fetching
    const {
        routeInfo, busList, getDirection, polylineMap, fallbackPolylines, activeRouteId
    } = useBusData(routeName);

    const [selectedBusKey, setSelectedBusKey] = useState<string | null>(null);

    const routeIndicesMap = useMemo(() => {
        if (!routeInfo) return new Map();

        const map = new Map();
        for (const id of routeInfo.vehicleRouteIds) {
            const polylineSet = polylineMap.get(id) ?? fallbackPolylines;
            const {stopIndexMap, turnIndex, isSwapped, upPolyline, downPolyline} = polylineSet;

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
                        for (const idx of Object.values(stopIndexMap.byId)) allIndices.add(idx as number);
                    }
                    return Array.from(allIndices);
                };

                const effectiveUp = isSwapped ? 0 : 1;
                const effectiveDown = isSwapped ? 1 : 0;

                const rawUp = getIndicesForDir(effectiveUp);
                const rawDown = getIndicesForDir(effectiveDown);

                upIndices = rawUp.filter(i => i >= 0 && i < upPolyline.length).sort((a, b) => a - b);

                if (turnIndex !== undefined) {
                    const safeTurn = Math.round(turnIndex);
                    downIndices = rawDown
                        .map(i => i - safeTurn)
                        .filter(i => i >= 0 && i < downPolyline.length)
                        .sort((a, b) => a - b);
                } else {
                    downIndices = rawDown.filter(i => i >= 0 && i < downPolyline.length).sort((a, b) => a - b);
                }
            }

            map.set(id, {upIndices, downIndices});
        }
        return map;
    }, [routeInfo, polylineMap, fallbackPolylines]);

    const markers = useMemo(() => {
        if (!routeInfo || busList.length === 0) return [];

        return busList.map((bus) => {
            const targetRouteId = bus.routeid ?? activeRouteId ?? routeInfo.vehicleRouteIds[0] ?? null;
            const polylineSet = targetRouteId ? polylineMap.get(targetRouteId) : null;
            const {upPolyline, downPolyline, stopIndexMap, turnIndex, isSwapped} = polylineSet ?? fallbackPolylines;
            const markerRouteContext = targetRouteId ?? "none";
            const markerKey = `${routeName}-${markerRouteContext}-${bus.vehicleno}`;

            const snapped = getSnappedPosition(bus, getDirection, upPolyline, downPolyline, {
                stopIndexMap, turnIndex, isSwapped, snapIndexRange: SNAP_INDEX_RANGE,
            });
            const activePolyline = snapped.direction === 1 ? upPolyline : downPolyline;

            const routeIndices = targetRouteId ? routeIndicesMap.get(targetRouteId) : null;
            let stopCoordIndices: number[] = [];
            if (routeIndices) {
                stopCoordIndices = snapped.direction === 1 ? routeIndices.upIndices : routeIndices.downIndices;
            }

            return {
                key: markerKey,
                bus,
                position: snapped.position,
                angle: snapped.angle,
                direction: snapped.direction,
                polyline: activePolyline,
                snapIndexHint: snapped.segmentIndex ?? null,
                stopCoordIndices,
                refreshKey: markerKey,
            };
        });
    }, [routeInfo, busList, getDirection, polylineMap, fallbackPolylines, activeRouteId, routeName, routeIndicesMap]);

    if (!routeInfo || markers.length === 0) return null;

    const selectedMarker = selectedBusKey ? markers.find(m => m.key === selectedBusKey) : null;

    return (<>
        {markers.map(({key, bus, position, angle, polyline, snapIndexHint, stopCoordIndices, refreshKey}) => {
            return (<BusAnimatedMarker
                key={key}
                position={position}
                rotationAngle={(angle || 0) % 360}
                polyline={polyline}
                snapIndexHint={snapIndexHint}
                snapIndexRange={SNAP_INDEX_RANGE}
                animationDuration={MAP_SETTINGS.ANIMATION.BUS_MOVE_MS}
                pollingIntervalMs={API_CONFIG.LIVE.POLLING_INTERVAL_MS}
                dataDelayMs={API_CONFIG.LIVE.DATA_DELAY_MS}
                stopCoordIndices={stopCoordIndices}
                refreshKey={refreshKey}
                onClick={() => {
                    setSelectedBusKey(key);
                    onPopupOpen?.(routeName);
                }}
            >
                <BusIconDOM routeNumber={bus.routenm}/>
            </BusAnimatedMarker>);
        })}

        {selectedMarker && (<Popup
            longitude={selectedMarker.position[1]}
            latitude={selectedMarker.position[0]}
            offset={[0, -10]}
            closeButton={false}
            closeOnClick={true}
            onClose={() => {
                setSelectedBusKey(null);
                onPopupClose?.();
            }}
            maxWidth="none"
            className="custom-bus-popup"
        >
            <BusPopupContent
                bus={selectedMarker.bus}
                stopName={selectedMarker.bus.nodenm || ""}
                DirectionIcon={getDirectionIcon(selectedMarker.direction)}
            />
        </Popup>)}
    </>);
}
