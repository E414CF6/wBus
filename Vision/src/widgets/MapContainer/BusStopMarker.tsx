"use client";

import { MAP_SETTINGS } from "@core/constants/env";
import { UI_TEXT } from "@core/constants/locale";
import { useBusStop } from "@entities/station/hooks";
import { filterStopsByViewport } from "@entities/station/stopFiltering";

import type { BusStop } from "@entities/station/types";
import { useAppMapContext } from "@shared/context/AppMapContext";

import BusStopPopup from "@widgets/BusListSheet/BusStopPopup";
import { BusFront, Info, MapPinned } from "lucide-react";
import mapboxgl from "mapbox-gl";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Marker, Popup } from "react-map-gl/maplibre";

type BusStopMarkerItemProps = {
    stop: BusStop;
    onRouteChange?: (routeName: string) => void;
};

const BusStopMarkerItem = memo(({stop, onRouteChange}: BusStopMarkerItemProps) => {
    const [isPopupOpen, setIsPopupOpen] = useState(false);

    const handleMarkerClick = useCallback((e: mapboxgl.MapLayerMouseEvent | any) => {
        if (e.originalEvent) {
            e.originalEvent.stopPropagation();
        }
        setIsPopupOpen(true);
    }, []);

    const handlePopupClose = useCallback(() => setIsPopupOpen(false), []);

    return (
        <>
            <Marker
                longitude={stop.gpslong}
                latitude={stop.gpslati}
                onClick={handleMarkerClick}
                anchor="center"
                style={{pointerEvents: 'auto'}}
            >
                {/* Bus Stop Icon DOM */}
                <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'white', border: '2px solid #3b82f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                    <div style={{width: 8, height: 8, borderRadius: '50%', background: '#3b82f6'}}/>
                </div>
            </Marker>

            {isPopupOpen && (
                <Popup
                    longitude={stop.gpslong}
                    latitude={stop.gpslati}
                    closeButton={false}
                    closeOnClick={true}
                    onClose={handlePopupClose}
                    className="custom-bus-stop-popup"
                    maxWidth="none"
                    offset={[0, -10]}
                >
                    <div
                        className="flex flex-col bg-white/95 dark:bg-[#111111]/95 backdrop-blur-3xl overflow-hidden rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-black/[0.04] dark:border-white/[0.06] w-[300px] sm:w-[360px]">
                        {/* Header Section */}
                        <div
                            className="relative overflow-hidden bg-transparent px-5 py-5 text-black dark:text-white border-b border-black/5 dark:border-white/5">
                            <div className="absolute -right-4 -top-4 opacity-5">
                                <BusFront size={100} strokeWidth={1}/>
                            </div>

                            <div className="relative z-10 flex flex-col gap-2">
                                <div className="flex items-start gap-3">
                                    <div
                                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100/50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                                        <MapPinned size={18} strokeWidth={2.5}/>
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <h3 className="truncate text-lg font-extrabold leading-tight tracking-tight">
                                            {stop.nodenm}
                                        </h3>
                                        <div className="flex items-center gap-1.5 mt-1 text-gray-500">
                                            <span
                                                className="text-[10px] font-bold uppercase tracking-widest">Station ID</span>
                                            <span
                                                className="text-[11px] font-mono font-semibold">{stop.nodeno || "N/A"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Body Section */}
                        <div className="relative min-h-[120px] bg-transparent">
                            <BusStopPopup
                                stopId={stop.nodeid}
                                onRouteChange={onRouteChange}
                            />
                        </div>

                        {/* Footer Section */}
                        <div
                            className="flex items-center justify-center border-t border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 py-3 px-4">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
                                <Info size={14}/>
                                <span>{UI_TEXT.BUS_ITEM.CLICK_ROUTE_FOR_INFO}</span>
                            </div>
                        </div>
                    </div>
                </Popup>
            )}
        </>
    );
});

BusStopMarkerItem.displayName = "BusStopMarkerItem";

export default ({
                    routeName,
                    onRouteChange
                }: {
    routeName: string;
    onRouteChange?: (routeName: string) => void;
}) => {
    const stops = useBusStop(routeName);
    const {map} = useAppMapContext();

    const [zoom, setZoom] = useState(map?.getZoom() ?? MAP_SETTINGS.ZOOM.DEFAULT);
    const [bounds, setBounds] = useState(map?.getBounds() ?? null);

    useEffect(() => {
        if (!map) return;

        const updateViewState = () => {
            setZoom(map.getZoom());
            setBounds(map.getBounds());
        };

        // Initialize state
        updateViewState();

        map.on("zoomend", updateViewState);
        map.on("moveend", updateViewState);

        return () => {
            map.off("zoomend", updateViewState);
            map.off("moveend", updateViewState);
        };
    }, [map]);

    const visibleStops = useMemo(() => {
        if (!bounds || zoom < MAP_SETTINGS.ZOOM.BUS_STOP_VISIBLE) return [];
        return filterStopsByViewport(stops, bounds, zoom);
    }, [stops, bounds, zoom]);

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
                        onRouteChange={onRouteChange}
                    />
                );
            })}
        </>
    );
}
