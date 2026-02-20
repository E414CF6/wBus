"use client";

import L from "leaflet";

import { memo, useEffect, useMemo, useRef } from "react";
import { Popup } from "react-leaflet";

import { MAP_SETTINGS } from "@core/config/env";
import { UI_TEXT } from "@core/config/locale";

import { useIcons } from "@bus/hooks/useBusIcons";
import { useBusData } from "@bus/hooks/useBusData";

import { getSnappedPosition } from "@bus/utils/getSnappedPos";
import { getDirectionIcon } from "@bus/utils/directionIcons";

import BusAnimatedMarker from "@bus/components/BusAnimatedMarker";

import PopupMarquee from "@shared/ui/MarqueeText";

import type { BusItem } from "@core/domain";

// ----------------------------------------------------------------------
// Constants & Styles
// ----------------------------------------------------------------------

const SETTINGS = MAP_SETTINGS.MARKERS.BUS;
const SNAP_INDEX_RANGE = 80;

const CSS_STYLES = `
@keyframes busRouteMarquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.bus-marker-with-label .bus-route-text-animate {
  display: inline-block;
  width: max-content; 
  min-width: 100%;
  animation: busRouteMarquee 3s linear infinite;
  padding-right: 4px;
}
.bus-marker-with-label .bus-route-text-container:hover .bus-route-text-animate {
  animation-play-state: paused;
}
`;

// ----------------------------------------------------------------------
// Hook: Styles Injection
// ----------------------------------------------------------------------

function useBusMarkerStyles() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (document.getElementById(SETTINGS.LABEL_STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = SETTINGS.LABEL_STYLE_ID;
        style.textContent = CSS_STYLES;

        document.head.appendChild(style);
    }, []);
}

// ----------------------------------------------------------------------
// Hook: Icon Generation
// ----------------------------------------------------------------------

function useBusMarkerIcon(refreshKey?: string | number) {
    const { busIcon } = useIcons();
    const iconCache = useRef(new Map<string, L.DivIcon>());

    // Clear cache on refreshKey change
    useEffect(() => {
        iconCache.current.clear();
    }, [refreshKey]);

    return useMemo(() => {
        return (routeNumber: string) => {
            if (!busIcon || typeof window === "undefined") return null;

            if (iconCache.current.has(routeNumber)) {
                return iconCache.current.get(routeNumber)!;
            }

            const escapedNum = String(routeNumber)
                .replace(/&/g, "&amp;").replace(/</g, "&lt;")
                .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");

            const needsMarquee = routeNumber.length > SETTINGS.MARQUEE_THRESHOLD - 1;
            const displayText = needsMarquee
                ? `${escapedNum}&nbsp;${escapedNum}&nbsp;`
                : escapedNum;

            const [w, h] = SETTINGS.ICON_SIZE;

            const icon = L.divIcon({
                className: "bus-marker-with-label",
                iconSize: SETTINGS.ICON_SIZE,
                iconAnchor: SETTINGS.ICON_ANCHOR,
                popupAnchor: SETTINGS.POPUP_ANCHOR,
                html: `
          <div style="position: relative; width: ${w}px; height: ${h}px; filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15));">
            <img src="/icons/bus-icon.png" style="width: ${w}px; height: ${h}px; transition: transform 0.3s ease;" />
            <div class="bus-route-text-container" style="
              position: absolute; top: 7px; left: 50%; transform: translateX(-50%);
              background: #4f46e5;
              color: white; font-size: 11px; font-weight: 800;
              padding: 2px 6px; border-radius: 8px; border: 1.5px solid white;
              box-shadow: 0 2px 8px rgba(79,70,229,0.3); letter-spacing: 0.3px;
              max-width: 26px; overflow: hidden; white-space: nowrap;
            ">
              <span class="${needsMarquee ? "bus-route-text-animate" : ""}">${displayText}</span>
            </div>
          </div>
        `,
            });

            iconCache.current.set(routeNumber, icon);
            return icon;
        };
    }, [busIcon]);
}

// ----------------------------------------------------------------------
// Sub-Component: Popup Content
// ----------------------------------------------------------------------

const BusPopupContent = memo(({ bus, stopName, DirectionIcon }: {
    bus: BusItem;
    stopName: string;
    DirectionIcon: React.ElementType
}) => (
    <div className="min-w-[240px] sm:min-w-[280px] flex flex-col bg-white/95 dark:bg-[#111111]/95 backdrop-blur-3xl rounded-[24px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-black/[0.04] dark:border-white/[0.06]">
        {/* Header */}
        <div className="bg-transparent px-4 py-4 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2.5 text-black dark:text-white">
                <div className="p-1.5 bg-indigo-100/50 dark:bg-indigo-500/20 rounded-[10px] text-indigo-600 dark:text-indigo-400">
                    <DirectionIcon className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
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
                <div className="font-mono font-bold text-sm text-gray-800 dark:text-gray-200 bg-black/[0.03] dark:bg-white/[0.05] px-2.5 py-1 rounded-[8px]">
                    {bus.vehicleno}
                </div>
            </div>

            <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest shrink-0">
                    {UI_TEXT.BUS_ITEM.CURRENT_LOC}
                </span>
                <div className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 min-w-0">
                    <PopupMarquee text={stopName} maxWidthClass="max-w-[150px]" />
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

export default function BusMarker({ routeName, onPopupOpen, onPopupClose }: BusMarkerProps) {
    // Initialize styles and data
    useBusMarkerStyles();

    // Data Fetching and Icon Generation
    const {
        routeInfo,
        busList,
        getDirection,
        polylineMap,
        fallbackPolylines,
        activeRouteId
    } = useBusData(routeName);

    const refreshKey = `${routeName}-${activeRouteId ?? "none"}`;
    const createIcon = useBusMarkerIcon(refreshKey);

    const markers = useMemo(() => {
        if (!routeInfo || busList.length === 0) return [];

        return busList.map((bus) => {
            const targetRouteId = bus.routeid ?? activeRouteId ?? routeInfo.vehicleRouteIds[0] ?? null;
            const polylineSet = targetRouteId ? polylineMap.get(targetRouteId) : null;
            const { upPolyline, downPolyline, stopIndexMap, turnIndex, isSwapped } = polylineSet ?? fallbackPolylines;

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

    return (
        <>
            {markers.map(({ key, bus, position, angle, direction, polyline, snapIndexHint }) => {
                const icon = createIcon(bus.routenm);
                if (!icon) return null;

                return (
                    <BusAnimatedMarker
                        key={key}
                        position={position}
                        rotationAngle={(angle || 0) % 360}
                        icon={icon}
                        polyline={polyline}
                        snapIndexHint={snapIndexHint}
                        snapIndexRange={SNAP_INDEX_RANGE}
                        animationDuration={MAP_SETTINGS.ANIMATION.BUS_MOVE_MS}
                        refreshKey={refreshKey}
                        eventHandlers={{
                            popupopen: () => onPopupOpen?.(routeName),
                            popupclose: () => onPopupClose?.(),
                        }}
                    >
                        <Popup autoPan={false} className="custom-bus-popup bg-transparent border-none shadow-none">
                            <BusPopupContent
                                bus={bus}
                                stopName={bus.nodenm || ""}
                                DirectionIcon={getDirectionIcon(direction)}
                            />
                        </Popup>
                    </BusAnimatedMarker>
                );
            })}
        </>
    );
}
