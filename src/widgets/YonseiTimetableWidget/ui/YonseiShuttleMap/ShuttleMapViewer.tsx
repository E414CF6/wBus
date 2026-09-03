"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import * as maplibregl from "maplibre-gl";
import {setWorkerUrl} from "maplibre-gl";

import {useTheme} from "next-themes";
import {Bus, MapPin} from "lucide-react";
import React, {useCallback, useEffect, useMemo, useRef} from "react";
import MapGL, {MapRef, Marker, NavigationControl} from "react-map-gl/maplibre";

import {getMapStyleUrl} from "@features/map-view/getMapData";
import {getKakaoRoadviewUrl, YonseiShuttleStop} from "@/data/yonseiShuttleStops";

if (typeof window !== "undefined") {
    setWorkerUrl("https://unpkg.com/maplibre-gl@6.6.0/dist/maplibre-gl-worker.mjs");
}

interface ShuttleMapViewerProps {
    stops: YonseiShuttleStop[];
    selectedStop: YonseiShuttleStop;
    onSelectStop: (stop: YonseiShuttleStop) => void;
}

export const ShuttleMapViewer: React.FC<ShuttleMapViewerProps> = ({
                                                                      stops,
                                                                      selectedStop,
                                                                      onSelectStop,
                                                                  }) => {
    const mapRef = useRef<MapRef>(null);
    const {resolvedTheme} = useTheme();
    const mapStyleUrl = useMemo(() => getMapStyleUrl(resolvedTheme), [resolvedTheme]);

    // Fly to selected stop smoothly
    const flyToStop = useCallback((stop: YonseiShuttleStop) => {
        if (!mapRef.current) return;
        try {
            mapRef.current.flyTo({
                center: [stop.lng, stop.lat],
                zoom: 16.5,
                duration: 800,
                essential: true,
            });
        } catch (e) {
            console.warn("[ShuttleMapViewer] flyTo error:", e);
        }
    }, []);

    useEffect(() => {
        flyToStop(selectedStop);
    }, [selectedStop, flyToStop]);

    return (
        <div
            className="relative w-full h-full min-h-[300px] sm:min-h-[400px] rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/10 shadow-inner bg-slate-100 dark:bg-[#10141e]">
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
                style={{width: "100%", height: "100%"}}
                attributionControl={false}
            >
                <NavigationControl position="bottom-right" showCompass={false}/>

                {/* Shuttle Stop Markers */}
                {stops.map((stop) => {
                    const isSelected = stop.id === selectedStop.id;
                    const roadviewUrl = getKakaoRoadviewUrl(stop.lat, stop.lng);

                    return (
                        <Marker
                            key={stop.id}
                            longitude={stop.lng}
                            latitude={stop.lat}
                            anchor="bottom"
                            style={{pointerEvents: "auto", cursor: "pointer"}}
                            onClick={(e) => {
                                if (e.originalEvent) {
                                    e.originalEvent.stopPropagation();
                                }
                                onSelectStop(stop);
                                if (typeof window !== "undefined") {
                                    window.open(roadviewUrl, "_blank", "noopener,noreferrer");
                                }
                            }}
                        >
                            <div
                                className="group/marker cursor-pointer flex flex-col items-center transition-transform duration-200 hover:scale-105 active:scale-95 select-none"
                                style={{zIndex: isSelected ? 40 : 10}}
                                title={`${stop.name} - 클릭 시 로드뷰가 열립니다`}
                            >
                                {/* Marker Badge & Roadview Button Row */}
                                <div className="flex items-center gap-1 mb-1 whitespace-nowrap shadow-lg">
                                    <div
                                        className={`px-2 py-0.5 rounded-lg text-[11px] font-black border transition-all ${
                                            isSelected
                                                ? "bg-blue-600 text-white border-white dark:border-slate-900 shadow-blue-600/30 scale-105"
                                                : "bg-white/95 dark:bg-[#182030]/95 text-slate-800 dark:text-white border-slate-200 dark:border-white/15 hover:bg-blue-50"
                                        }`}
                                    >
                                        <span>{stop.shortName}</span>
                                    </div>
                                </div>

                                {/* Pin Icon */}
                                <div
                                    className={`relative flex items-center justify-center rounded-2xl p-1.5 transition-all ${
                                        isSelected
                                            ? "w-9 h-9 bg-gradient-to-tr from-blue-700 to-indigo-500 text-white shadow-lg shadow-blue-600/40 ring-4 ring-blue-500/20"
                                            : "w-7 h-7 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-md opacity-90 group-hover/marker:opacity-100"
                                    }`}
                                >
                                    {isSelected ? (
                                        <Bus className="w-5 h-5 animate-pulse"/>
                                    ) : (
                                        <span className="text-[11px] font-black">{stop.number}</span>
                                    )}
                                    <div
                                        className={`absolute -bottom-1 w-2 h-2 rotate-45 ${
                                            isSelected ? "bg-blue-700" : "bg-slate-800 dark:bg-slate-200"
                                        }`}
                                    />
                                </div>
                            </div>
                        </Marker>
                    );
                })}
            </MapGL>

            {/* Float Overlay Indicator */}
            <div
                className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-black/85 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-sm text-xs font-bold text-slate-700 dark:text-slate-300 pointer-events-none">
                <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"/>
                <span>마커를 누르면 <span
                    className="text-teal-600 dark:text-teal-400 font-black">로드뷰</span>가 새 창으로 열립니다</span>
            </div>
        </div>
    );
};
