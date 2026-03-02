"use client";

import { MAP_SETTINGS } from "@core/constants/env";
import { UI_TEXT } from "@core/constants/locale";
import { getDirectionIcon } from "@entities/bus/directionIcons";

import type { BusItem } from "@entities/bus/types";

import { getSnappedPosition } from "@entities/route/snapService";
import { useBusData } from "@features/live-tracking/useBusData";

import PopupMarquee from "@shared/ui/MarqueeText";
import Image from "next/image";

import React, { memo, useMemo, useState } from "react";
import { Popup } from "react-map-gl/maplibre";
import BusAnimatedMarker from "./BusAnimatedMarker";

// ----------------------------------------------------------------------
// Constants & Styles
// ----------------------------------------------------------------------

const SETTINGS = MAP_SETTINGS.MARKERS.BUS;
const SNAP_INDEX_RANGE = 80;

// ----------------------------------------------------------------------
// Sub-Component: Bus Icon DOM
// ----------------------------------------------------------------------

const BusIconDOM = memo(({routeNumber}: { routeNumber: string }) => {
    const needsMarquee = routeNumber.length >= SETTINGS.MARQUEE_THRESHOLD;
    const [w, h] = SETTINGS.ICON_SIZE;

    return (
        <div
            className="bus-marker-with-label relative drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
            style={{width: w, height: h}}
        >
            <Image
                src="/icons/bus-icon.png"
                width={w}
                height={h}
                className="transition-transform duration-300 ease-in-out"
                alt="Bus"
            />
            <div
                className="bus-route-text-container absolute top-1.75 left-1/2 -translate-x-1/2 bg-[#4f46e5] text-white text-[11px] font-extrabold px-1.5 py-px rounded-lg border-[1.5px] border-white shadow-[0_2px_8px_rgba(79,70,229,0.3)] tracking-[0.3px] max-w-6.5 overflow-hidden whitespace-nowrap">
                <span className={needsMarquee ? "bus-route-text-animate" : ""}>
                    {routeNumber}
                    {needsMarquee && <>&nbsp;{routeNumber}&nbsp;</>}
                </span>
            </div>
        </div>
    );
});

BusIconDOM.displayName = "BusIconDOM";

// ----------------------------------------------------------------------
// Sub-Component: Popup Content
// ----------------------------------------------------------------------

const BusPopupContent = memo(({bus, stopName, DirectionIcon}: {
    bus: BusItem;
    stopName: string;
    DirectionIcon: React.ElementType
}) => (
    <div
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
    </div>
));

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
        routeInfo,
        busList,
        getDirection,
        polylineMap,
        fallbackPolylines,
        activeRouteId
    } = useBusData(routeName);

    const [selectedBusKey, setSelectedBusKey] = useState<string | null>(null);

    const refreshKey = `${routeName}-${activeRouteId ?? "none"}`;

    const markers = useMemo(() => {
        if (!routeInfo || busList.length === 0) return [];

        return busList.map((bus) => {
            const targetRouteId = bus.routeid ?? activeRouteId ?? routeInfo.vehicleRouteIds[0] ?? null;
            const polylineSet = targetRouteId ? polylineMap.get(targetRouteId) : null;
            const {upPolyline, downPolyline, stopIndexMap, turnIndex, isSwapped} = polylineSet ?? fallbackPolylines;

            const snapped = getSnappedPosition(bus, getDirection, upPolyline, downPolyline, {
                stopIndexMap,
                turnIndex,
                isSwapped,
                snapIndexRange: SNAP_INDEX_RANGE,
            });
            const activePolyline = snapped.direction === 1 ? upPolyline : downPolyline;

            return {
                key: `${routeName}-${bus.vehicleno}`,
                bus,
                position: snapped.position,
                angle: snapped.angle,
                direction: snapped.direction,
                polyline: activePolyline,
                snapIndexHint: snapped.segmentIndex ?? null,
            };
        });
    }, [
        routeInfo,
        busList,
        getDirection,
        polylineMap,
        fallbackPolylines,
        activeRouteId,
        routeName
    ]);

    if (!routeInfo || markers.length === 0) return null;

    const selectedMarker = selectedBusKey ? markers.find(m => m.key === selectedBusKey) : null;

    return (
        <>
            {markers.map(({key, bus, position, angle, polyline, snapIndexHint}) => {
                return (
                    <BusAnimatedMarker
                        key={key}
                        position={position}
                        rotationAngle={(angle || 0) % 360}
                        polyline={polyline}
                        snapIndexHint={snapIndexHint}
                        snapIndexRange={SNAP_INDEX_RANGE}
                        animationDuration={MAP_SETTINGS.ANIMATION.BUS_MOVE_MS}
                        refreshKey={refreshKey}
                        onClick={() => {
                            setSelectedBusKey(key);
                            onPopupOpen?.(routeName);
                        }}
                    >
                        <BusIconDOM routeNumber={bus.routenm}/>
                    </BusAnimatedMarker>
                );
            })}

            {selectedMarker && (
                <Popup
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
                </Popup>
            )}
        </>
    );
}
