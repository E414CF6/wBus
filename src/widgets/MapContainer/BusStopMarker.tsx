"use client";

import {useAllStations, useBusStop} from "@entities/station/hooks";
import type {BusStop} from "@entities/station/types";

import {MAP_SETTINGS} from "@shared/config/env";
import {UI_TEXT} from "@shared/config/locale";
import {useAppMapContext} from "@shared/context/AppMapContext";

import BusStopPopup from "@widgets/BusListSheet/BusStopPopup";

import {BusFront, Info, MapPin, MapPinned} from "lucide-react";
import {memo, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Marker, Popup} from "react-map-gl/maplibre";

type BusStopMarkerItemProps = {
    stop: BusStop;
    isRouteStop?: boolean;
    onRouteChange?: (routeName: string) => void;
};

const BusStopMarkerItem = memo(({stop, isRouteStop = true, onRouteChange}: BusStopMarkerItemProps) => {
    const [isPopupOpen, setIsPopupOpen] = useState(false);

    const handleMarkerClick = useCallback((e: { originalEvent?: Event }) => {
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
                style={{pointerEvents: "auto", cursor: "pointer"}}
            >
                {/* Bus Stop Marker Icon DOM */}
                {isRouteStop ? (
                    <div
                        title={`${stop.nodenm} (현재 노선 정류장)`}
                        className="group relative flex items-center justify-center w-6 h-6 rounded-full bg-white dark:bg-[#0f172a] border-2 border-blue-600 dark:border-blue-400 shadow-md transition-transform duration-150 hover:scale-125 cursor-pointer"
                    >
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400 shadow-xs"/>
                    </div>
                ) : (
                    <div
                        title={`${stop.nodenm} (주변 정류장)`}
                        className="group relative flex items-center justify-center w-5 h-5 rounded-full bg-white dark:bg-[#1e293b] border-2 border-slate-400 dark:border-slate-500 shadow-sm opacity-85 hover:opacity-100 hover:border-slate-700 dark:hover:border-slate-300 transition-all duration-150 hover:scale-125 cursor-pointer"
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-500 dark:bg-slate-400"/>
                    </div>
                )}
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
                        className="flex flex-col bg-white/95 dark:bg-[#111111]/95 backdrop-blur-3xl overflow-hidden rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.6)] border border-black/5 dark:border-white/10 w-75 sm:w-90">
                        {/* Header Section */}
                        <div
                            className="relative overflow-hidden bg-transparent px-5 py-5 text-black dark:text-white border-b border-black/5 dark:border-white/5">
                            <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
                                <BusFront size={100} strokeWidth={1}/>
                            </div>

                            <div className="relative z-10 flex flex-col gap-2">
                                <div className="flex items-start gap-3">
                                    <div
                                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                            isRouteStop
                                                ? "bg-blue-100/60 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
                                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                        }`}
                                    >
                                        {isRouteStop ? (
                                            <MapPinned size={18} strokeWidth={2.5}/>
                                        ) : (
                                            <MapPin size={18} strokeWidth={2.5}/>
                                        )}
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <h3 className="truncate text-base sm:text-lg font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
                                                {stop.nodenm}
                                            </h3>
                                            <span
                                                className={`px-1.5 py-0.2 rounded-md text-[9px] font-black ${
                                                    isRouteStop
                                                        ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                                                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                                }`}
                                            >
                                                {isRouteStop ? "현재 노선" : "주변 정류장"}
                                            </span>
                                        </div>
                                        <div
                                            className="flex items-center gap-1.5 mt-1 text-gray-500 dark:text-gray-400">
                                            <span className="text-[10px] font-bold uppercase tracking-widest">
                                                {UI_TEXT.STOP_POPUP.STATION_ID_LABEL}
                                            </span>
                                            <span className="text-[11px] font-mono font-semibold">
                                                {stop.nodeno || UI_TEXT.STOP_POPUP.STATION_ID_FALLBACK}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Body Section: Real-time Bus Arrivals at this Stop */}
                        <div className="relative min-h-30 bg-transparent">
                            <BusStopPopup stopId={stop.nodeid} onRouteChange={onRouteChange}/>
                        </div>

                        {/* Footer Section */}
                        <div
                            className="flex items-center justify-center border-t border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 py-2.5 px-4">
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
                    onRouteChange,
                }: {
    routeName: string;
    onRouteChange?: (routeName: string) => void;
}) => {
    const routeStops = useBusStop(routeName);
    const allStations = useAllStations();
    const {map} = useAppMapContext();

    const [zoom, setZoom] = useState(map?.getZoom() ?? MAP_SETTINGS.ZOOM.DEFAULT);
    const [bounds, setBounds] = useState(map?.getBounds() ?? null);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        if (!map) return;

        const updateViewState = () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                setZoom(map.getZoom());
                setBounds(map.getBounds());
            });
        };

        // Initialize state
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

    // Zoom threshold for displaying stops in viewport (zoom >= 14.5)
    const visibleStops = useMemo(() => {
        if (!bounds || zoom < 14.5) return [];

        const seenNodeIds = new Set<string>();
        const stopsInView: Array<BusStop & { isRouteStop: boolean }> = [];

        // 1. Include route stops that are inside current viewport bounds
        for (const rStop of routeStops) {
            if (bounds.contains([rStop.gpslong, rStop.gpslati])) {
                stopsInView.push({
                    ...rStop,
                    isRouteStop: true,
                });
                if (rStop.nodeid) seenNodeIds.add(rStop.nodeid);
            }
        }

        // 2. Include all other surrounding stations from stationMap.json inside viewport bounds
        for (const station of allStations) {
            if (seenNodeIds.has(station.nodeid)) continue;
            if (bounds.contains([station.gpslong, station.gpslati])) {
                stopsInView.push({
                    ...station,
                    isRouteStop: false,
                });
                seenNodeIds.add(station.nodeid);
            }
        }

        return stopsInView;
    }, [routeStops, allStations, bounds, zoom]);

    return (
        <>
            {visibleStops.map((stop, index) => {
                const key = stop.nodeid ? `${stop.nodeid}-${stop.updowncd ?? "na"}` : `stop-${index}`;
                return (
                    <BusStopMarkerItem
                        key={key}
                        stop={stop}
                        isRouteStop={stop.isRouteStop}
                        onRouteChange={onRouteChange}
                    />
                );
            })}
        </>
    );
};
