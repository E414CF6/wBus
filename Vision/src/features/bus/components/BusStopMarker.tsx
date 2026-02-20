"use client";

import BusStopPopup from "@bus/components/BusStopPopup";

import { memo, useCallback, useMemo, useState } from "react";
import { Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import { BusFront, Info, MapPinned } from "lucide-react";

import { MAP_SETTINGS } from "@core/config/env";
import { UI_TEXT } from "@core/config/locale";

import { useIcons } from "@bus/hooks/useBusIcons";
import { useBusStop } from "@bus/hooks/useBusStop";
import { filterStopsByViewport } from "@bus/utils/stopFiltering";

import type { BusStop } from "@core/domain";
import type { Icon } from "leaflet";

type BusStopMarkerItemProps = {
    stop: BusStop;
    icon: Icon;
    onRouteChange?: (routeName: string) => void;
};

const BusStopMarkerItem = memo(({ stop, icon, onRouteChange }: BusStopMarkerItemProps) => {
    const [isPopupOpen, setIsPopupOpen] = useState(false);

    const handlePopupOpen = useCallback(() => setIsPopupOpen(true), []);
    const handlePopupClose = useCallback(() => setIsPopupOpen(false), []);

    return (
        <Marker
            position={[stop.gpslati, stop.gpslong]}
            icon={icon}
            eventHandlers={{
                popupopen: handlePopupOpen,
                popupclose: handlePopupClose,
            }}
        >
            <Popup
                className="custom-bus-stop-popup"
                minWidth={300}
                maxWidth={360}
                autoPanPadding={[50, 50]}
            >
                <div className="flex flex-col bg-white/95 dark:bg-[#111111]/95 backdrop-blur-3xl overflow-hidden rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-black/[0.04] dark:border-white/[0.06]">
                    {/* Header Section */}
                    <div className="relative overflow-hidden bg-transparent px-5 py-5 text-black dark:text-white border-b border-black/5 dark:border-white/5">
                        <div className="absolute -right-4 -top-4 opacity-5">
                            <BusFront size={100} strokeWidth={1} />
                        </div>

                        <div className="relative z-10 flex flex-col gap-2">
                            <div className="flex items-start gap-3">
                                <div
                                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100/50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                                    <MapPinned size={18} strokeWidth={2.5} />
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <h3 className="truncate text-lg font-extrabold leading-tight tracking-tight">
                                        {stop.nodenm}
                                    </h3>
                                    <div className="flex items-center gap-1.5 mt-1 text-gray-500">
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Station ID</span>
                                        <span className="text-[11px] font-mono font-semibold">{stop.nodeno || "N/A"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Body Section */}
                    <div className="relative min-h-[120px] bg-transparent">
                        {isPopupOpen ? (
                            <BusStopPopup
                                stopId={stop.nodeid}
                                onRouteChange={onRouteChange}
                            />
                        ) : (
                            <div className="flex h-32 items-center justify-center">
                                <div className="flex flex-col items-center gap-3">
                                    <div
                                        className="h-6 w-6 animate-spin rounded-full border-3 border-gray-200 dark:border-gray-800 border-t-black dark:border-t-white" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Section */}
                    <div className="flex items-center justify-center border-t border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 py-3 px-4">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
                            <Info size={14} />
                            <span>{UI_TEXT.BUS_ITEM.CLICK_ROUTE_FOR_INFO}</span>
                        </div>
                    </div>
                </div>
            </Popup>
        </Marker>
    );
});

BusStopMarkerItem.displayName = "BusStopMarkerItem";

export default function BusStopMarker({
    routeName,
    onRouteChange
}: {
    routeName: string;
    onRouteChange?: (routeName: string) => void;
}) {
    const stops = useBusStop(routeName);
    const { busStopIcon } = useIcons();

    const map = useMap();
    const [zoom, setZoom] = useState(map.getZoom());
    const [bounds, setBounds] = useState(map.getBounds());

    useMapEvents({
        zoomend: () => {
            setZoom(map.getZoom());
            setBounds(map.getBounds());
        },
        moveend: () => {
            setBounds(map.getBounds());
        },
    });

    const visibleStops = useMemo(() => {
        if (zoom < MAP_SETTINGS.ZOOM.BUS_STOP_VISIBLE) return [];
        return filterStopsByViewport(stops, bounds, zoom);
    }, [stops, bounds, zoom]);

    if (!busStopIcon) return null;

    return (
        <>
            {visibleStops.map((stop, index) => {
                const key = stop.nodeid
                    ? `${stop.nodeid}-${stop.updowncd ?? "na"}`
                    : `stop-${index}`;
                return (
                    <BusStopMarkerItem
                        key={key}
                        stop={stop}
                        icon={busStopIcon}
                        onRouteChange={onRouteChange}
                    />
                );
            })}
        </>
    );
}
