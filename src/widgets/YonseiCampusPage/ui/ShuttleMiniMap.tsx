"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import * as maplibregl from "maplibre-gl";
import {setWorkerUrl} from "maplibre-gl";
import {useTheme} from "next-themes";
import {Bus, MapPin} from "lucide-react";
import React, {useCallback, useEffect, useMemo, useRef} from "react";
import MapGL, {type MapRef, Marker, NavigationControl} from "react-map-gl/maplibre";

import {getMapStyleUrl, getMaxCanvasSize} from "@features/map-view/getMapData";
import type {YonseiShuttleStop} from "@entities/station";

// Use local MapLibre GL JS v6 worker bundle
if (typeof window !== "undefined") {
    setWorkerUrl("/workers/maplibre-gl-worker.mjs");
}

export interface ShuttleMiniMapProps {
    stops: YonseiShuttleStop[];
    selectedStop: YonseiShuttleStop;
    onSelectStop: (stop: YonseiShuttleStop) => void;
}

export const ShuttleMiniMap: React.FC<ShuttleMiniMapProps> = ({
    stops,
    selectedStop,
    onSelectStop,
}) => {
    const mapRef = useRef<MapRef>(null);
    const {resolvedTheme} = useTheme();
    const mapStyleUrl = useMemo(() => getMapStyleUrl(resolvedTheme), [resolvedTheme]);
    const maxCanvasSize = useMemo(() => getMaxCanvasSize(), []);

    const flyToStop = useCallback((stop: YonseiShuttleStop) => {
        if (!mapRef.current) return;
        try {
            mapRef.current.flyTo({
                center: [stop.lng, stop.lat],
                zoom: 16.5,
                duration: 750,
                essential: true,
            });
        } catch {
            // Ignore flyTo errors before map init
        }
    }, []);

    useEffect(() => {
        flyToStop(selectedStop);
    }, [selectedStop, flyToStop]);

    return (
        <div className="relative w-full h-[300px] sm:h-[360px] rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/10 shadow-inner bg-slate-100 dark:bg-[#10141e]">
            <MapGL
                ref={mapRef}
                initialViewState={{
                    longitude: selectedStop.lng,
                    latitude: selectedStop.lat,
                    zoom: 16.5,
                }}
                mapStyle={mapStyleUrl}
                mapLib={maplibregl}
                minZoom={10}
                maxZoom={19}
                maxCanvasSize={maxCanvasSize}
                style={{width: "100%", height: "100%"}}
                attributionControl={false}
            >
                <NavigationControl position="bottom-right" showCompass={false} />

                {stops.map((stop) => {
                    const isSelected = stop.id === selectedStop.id;
                    return (
                        <Marker
                            key={stop.id}
                            longitude={stop.lng}
                            latitude={stop.lat}
                            anchor="bottom"
                            style={{pointerEvents: "auto", cursor: "pointer", zIndex: isSelected ? 40 : 10}}
                            onClick={(e) => {
                                if (e.originalEvent) {
                                    e.originalEvent.stopPropagation();
                                }
                                onSelectStop(stop);
                            }}
                        >
                            <div
                                className="group/marker cursor-pointer flex flex-col items-center transition-transform duration-200 hover:scale-105 active:scale-95 select-none"
                                title={`${stop.name} (${stop.directionTag})`}
                            >
                                <div
                                    className={`px-2 py-0.5 mb-1 rounded-lg text-[11px] font-black border whitespace-nowrap shadow-md transition-all ${
                                        isSelected
                                            ? "bg-[#003876] text-white border-white dark:border-slate-900 scale-105"
                                            : "bg-white/95 dark:bg-[#182030]/95 text-slate-800 dark:text-white border-slate-200 dark:border-white/15"
                                    }`}
                                >
                                    {stop.shortName}
                                </div>

                                <div
                                    className={`relative flex items-center justify-center rounded-2xl p-1.5 transition-all ${
                                        isSelected
                                            ? "w-9 h-9 bg-gradient-to-tr from-[#003876] to-blue-500 text-white shadow-lg shadow-blue-600/40 ring-4 ring-blue-500/20"
                                            : "w-7 h-7 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-md opacity-90"
                                    }`}
                                >
                                    {isSelected ? (
                                        <Bus className="w-4 h-4" />
                                    ) : (
                                        <span className="text-[11px] font-black">{stop.number}</span>
                                    )}
                                    <div
                                        className={`absolute -bottom-1 w-2 h-2 rotate-45 ${
                                            isSelected ? "bg-[#003876]" : "bg-slate-800 dark:bg-slate-200"
                                        }`}
                                    />
                                </div>
                            </div>
                        </Marker>
                    );
                })}
            </MapGL>

            <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-black/85 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-sm text-xs font-bold text-slate-700 dark:text-slate-300 pointer-events-none">
                <MapPin className="w-3.5 h-3.5 text-[#003876] dark:text-blue-400" />
                <span>정류장 핀을 선택해 상세 승차 위치를 확인하세요</span>
            </div>
        </div>
    );
};

export default ShuttleMiniMap;
