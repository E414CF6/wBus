"use client";

import {useAllStations, useBusStop} from "@entities/station/hooks";
import type {BusStop} from "@entities/station/types";

import {MAP_SETTINGS} from "@shared/config/env";
import {UI_TEXT} from "@shared/config/locale";
import {useAppMapContext} from "@shared/context/AppMapContext";

import {BusStopPopup} from "@entities/station";
import {useRoutePolylineData} from "@features/live-tracking";
import {buildSegmentedRouteGeoJson, SHARED_BLUE_COLOR} from "@entities/route/polylineService";
import type {Feature} from "geojson";

import {BusFront, Info, MapPin, MapPinned} from "lucide-react";
import {memo, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Marker, Popup} from "react-map-gl/maplibre";

type BusStopMarkerItemProps = {
    stop: BusStop;
    isRouteStop?: boolean;
    onRouteChange?: (routeName: string) => void;
    showLabel?: boolean;
    color?: string;
};

function getDistanceToSegmentMeters(
    point: [number, number],
    segA: [number, number],
    segB: [number, number]
): number {
    const [pLat, pLng] = point;
    const [aLat, aLng] = segA;
    const [bLat, bLng] = segB;

    const cosLat = Math.cos((pLat * Math.PI) / 180);
    const dLat = (bLat - aLat) * 111000;
    const dLng = (bLng - aLng) * 111000 * cosLat;
    const lenSq = dLat * dLat + dLng * dLng;

    if (lenSq === 0) {
        const dy = (pLat - aLat) * 111000;
        const dx = (pLng - aLng) * 111000 * cosLat;
        return Math.sqrt(dx * dx + dy * dy);
    }

    const apLat = (pLat - aLat) * 111000;
    const apLng = (pLng - aLng) * 111000 * cosLat;
    const t = Math.max(0, Math.min(1, (apLat * dLat + apLng * dLng) / lenSq));

    const projLat = aLat + t * (bLat - aLat);
    const projLng = aLng + t * (bLng - aLng);

    const dy = (pLat - projLat) * 111000;
    const dx = (pLng - projLng) * 111000 * cosLat;
    return Math.sqrt(dx * dx + dy * dy);
}

function findNearestFeatureColor(
    stopLat: number,
    stopLng: number,
    features: Feature[]
): string {
    let minDistance = Infinity;
    let matchedColor = SHARED_BLUE_COLOR;

    for (const feat of features) {
        if (feat.geometry.type !== "LineString") continue;
        const color = feat.properties?.color;
        if (!color) continue;

        const coords = feat.geometry.coordinates as [number, number][];
        for (let i = 0; i < coords.length - 1; i++) {
            const segA: [number, number] = [coords[i][1], coords[i][0]];
            const segB: [number, number] = [coords[i + 1][1], coords[i + 1][0]];
            const dist = getDistanceToSegmentMeters([stopLat, stopLng], segA, segB);
            if (dist < minDistance) {
                minDistance = dist;
                matchedColor = color;
            }
        }
    }

    return matchedColor;
}

const BusStopMarkerItem = memo(({
                                    stop,
                                    isRouteStop = true,
                                    onRouteChange,
                                    showLabel = true,
                                    color = "#059669",
                                }: BusStopMarkerItemProps) => {
    const [isPopupOpen, setIsPopupOpen] = useState(false);

    const handleMarkerClick = useCallback((e: { originalEvent?: Event }) => {
        if (e.originalEvent) {
            e.originalEvent.stopPropagation();
        }
        setIsPopupOpen(true);
    }, []);

    const handlePopupClose = useCallback(() => setIsPopupOpen(false), []);

    const borderColor = isRouteStop ? color : "#64748b";

    return (
        <>
            <Marker
                longitude={stop.gpslong}
                latitude={stop.gpslati}
                onClick={handleMarkerClick}
                anchor="center"
                style={{pointerEvents: "auto", cursor: "pointer"}}
            >
                {/* Bus Stop Marker Icon & Name Label */}
                <div className="relative flex items-center select-none group">
                    {/* Bus Stop Marker Icon with Dynamic Polyline Color */}
                    {isRouteStop ? (
                        <div
                            title={`${stop.nodenm} (현재 노선 정류장)`}
                            className="relative flex items-center justify-center w-6 h-6 rounded-lg text-white shadow-md border-2 border-white/90 group-hover:scale-110 transition-transform cursor-pointer shrink-0 z-10"
                            style={{backgroundColor: color}}
                        >
                            <BusFront className="w-3.5 h-3.5 fill-current"/>
                        </div>
                    ) : (
                        <div
                            title={`${stop.nodenm} (주변 정류장)`}
                            className="flex items-center justify-center w-5 h-5 rounded-lg bg-slate-600/90 text-white shadow-sm border border-white/70 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all cursor-pointer shrink-0 z-10"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-white"/>
                        </div>
                    )}

                    {/* Bus Stop Name Label Badge with Matching Border & Accent Color */}
                    {showLabel && (
                        <div
                            className="absolute left-full ml-1.5 px-2 py-0.5 rounded-md bg-[#18191c]/95 shadow-md backdrop-blur-md pointer-events-auto whitespace-nowrap group-hover:scale-105 transition-all z-20 flex items-center gap-1.5"
                            style={{
                                border: `1.2px solid ${borderColor}`,
                            }}
                        >
                            <span
                                className="text-white font-bold text-[11px] sm:text-[12px] tracking-tight leading-none">
                                {stop.nodenm}
                            </span>
                        </div>
                    )}
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
                                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                                        style={{
                                            backgroundColor: isRouteStop ? color : "#64748b"
                                        }}
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
                                                className="px-1.5 py-0.2 rounded-md text-[9px] font-black text-white"
                                                style={{
                                                    backgroundColor: isRouteStop ? color : "#64748b"
                                                }}
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
    const {map} = useAppMapContext();
    const [zoom, setZoom] = useState(map?.getZoom() ?? MAP_SETTINGS.ZOOM.DEFAULT);
    const [bounds, setBounds] = useState(map?.getBounds() ?? null);
    const allStations = useAllStations(zoom >= 15.0);
    const rafRef = useRef<number | null>(null);

    // Retrieve polyline data to synchronize stop marker & label colors with route segments
    const {routeInfo, polylineMap, activeRouteId} = useRoutePolylineData(routeName);
    const routeIds = useMemo(() => routeInfo?.vehicleRouteIds ?? [], [routeInfo?.vehicleRouteIds]);

    const validRouteIds = useMemo(() => {
        const available = routeIds.filter((id) => {
            const data = polylineMap.get(id);
            return data && (data.upPolyline.length > 0 || data.downPolyline.length > 0);
        });
        if (available.length > 0) return available;
        if (activeRouteId && polylineMap.has(activeRouteId)) {
            const data = polylineMap.get(activeRouteId);
            if (data && (data.upPolyline.length > 0 || data.downPolyline.length > 0)) {
                return [activeRouteId];
            }
        }
        return routeIds.slice(0, 1);
    }, [routeIds, polylineMap, activeRouteId]);

    const activeGeoJson = useMemo(() => {
        return buildSegmentedRouteGeoJson(validRouteIds, polylineMap);
    }, [validRouteIds, polylineMap]);

    // Map each stop ID to its corresponding polyline segment color
    const stopColorMap = useMemo(() => {
        const colorMap = new Map<string, string>();
        const features = activeGeoJson?.features || [];
        if (features.length === 0) return colorMap;

        for (const stop of routeStops) {
            const color = findNearestFeatureColor(stop.gpslati, stop.gpslong, features);
            const key = `${stop.nodeid}-${stop.updowncd ?? "na"}`;
            colorMap.set(key, color);
            colorMap.set(stop.nodeid, color);
        }

        return colorMap;
    }, [routeStops, activeGeoJson]);

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

    // Zoom threshold for displaying stops in viewport (zoom >= 13.5 for route stops, zoom >= 15.0 for surrounding)
    const visibleStops = useMemo(() => {
        if (!bounds || zoom < 13.5) return [];

        const seenNodeIds = new Set<string>();
        const stopsInView: Array<BusStop & { isRouteStop: boolean; showLabel: boolean; color: string }> = [];
        const isRouteLabelVisible = zoom >= 14.3;
        const isSurroundingLabelVisible = zoom >= 15.8;

        // 1. Include route stops that are inside current viewport bounds
        for (const rStop of routeStops) {
            if (bounds.contains([rStop.gpslong, rStop.gpslati])) {
                const stopKey = `${rStop.nodeid}-${rStop.updowncd ?? "na"}`;
                const color = stopColorMap.get(stopKey) || stopColorMap.get(rStop.nodeid) || "#059669";

                stopsInView.push({
                    ...rStop,
                    isRouteStop: true,
                    showLabel: isRouteLabelVisible,
                    color,
                });
                if (rStop.nodeid) seenNodeIds.add(rStop.nodeid);
            }
        }

        // 2. Include surrounding stations from stationMap.json inside viewport bounds (only at higher zoom >= 15.0)
        if (zoom >= 15.0) {
            for (const station of allStations) {
                if (seenNodeIds.has(station.nodeid)) continue;
                if (bounds.contains([station.gpslong, station.gpslati])) {
                    stopsInView.push({
                        ...station,
                        isRouteStop: false,
                        showLabel: isSurroundingLabelVisible,
                        color: "#64748b",
                    });
                    seenNodeIds.add(station.nodeid);
                }
            }
        }

        return stopsInView;
    }, [routeStops, allStations, bounds, zoom, stopColorMap]);

    return (
        <>
            {visibleStops.map((stop, index) => {
                const key = stop.nodeid ? `${stop.nodeid}-${stop.updowncd ?? "na"}` : `stop-${index}`;
                return (
                    <BusStopMarkerItem
                        key={key}
                        stop={stop}
                        isRouteStop={stop.isRouteStop}
                        showLabel={stop.showLabel}
                        color={stop.color}
                        onRouteChange={onRouteChange}
                    />
                );
            })}
        </>
    );
};
