"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import {getMapStyleUrl} from "@features/map-view/getMapData";
import {createMapViewFromMap, getInitialMapView, saveMapView} from "@features/map-view/MapViewStorage";

import {MAP_SETTINGS} from "@shared/config/env";
import {UI_TEXT} from "@shared/config/locale";
import {useAppMapContext} from "@shared/context/AppMapContext";

import * as maplibregl from "maplibre-gl";
import {setWorkerUrl} from "maplibre-gl";
import {AlertCircle, AlertTriangle, Navigation} from "lucide-react";
import {useTheme} from "next-themes";
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import MapGL, {GeolocateControl, MapRef, NavigationControl} from "react-map-gl/maplibre";

// Set MapLibre GL JS v6 Web Worker path via CDN
if (typeof window !== "undefined") {
    setWorkerUrl("https://unpkg.com/maplibre-gl@^6.7.0/dist/maplibre-gl-worker.mjs");
}

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface MapProps {
    /** Callback fired once when the map base layer is fully loaded */
    onReady?: () => void;
    /** Content to render inside the map (route layers, markers, etc.) */
    children?: React.ReactNode;
}

interface LocationToastState {
    message: string;
    type: "warning" | "error" | "info";
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

export default function Map({onReady, children}: MapProps) {
    const mapRef = useRef<MapRef>(null);
    const {setMap} = useAppMapContext();
    const readyOnceRef = useRef(false);
    const {resolvedTheme} = useTheme();

    const [locationToast, setLocationToast] = useState<LocationToastState | null>(null);
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Load saved view state (center/zoom) or default from config
    const initialView = useMemo(() => getInitialMapView(), []);
    const mapStyleUrl = useMemo(() => getMapStyleUrl(resolvedTheme), [resolvedTheme]);

    const showLocationToast = useCallback((message: string, type: "warning" | "error" | "info" = "info") => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
        setLocationToast({message, type});
        toastTimerRef.current = setTimeout(() => {
            setLocationToast(null);
        }, 4000);
    }, []);

    const handleLoad = useCallback(() => {
        if (readyOnceRef.current) return;
        readyOnceRef.current = true;

        if (mapRef.current) {
            setMap(mapRef.current);
        }

        onReady?.();
    }, [onReady, setMap]);

    const handleError = useCallback((e: unknown) => {
        const errDetail = (e as { error?: Error })?.error?.message || (e as { error?: Error })?.error || e;
        console.warn("[MapGL] Map error encountered, falling back to ready state:", errDetail);
        handleLoad();
    }, [handleLoad]);

    const handleMoveEnd = useCallback(() => {
        if (mapRef.current) {
            saveMapView(createMapViewFromMap(mapRef.current));
        }
    }, []);

    const handleGeolocateError = useCallback(
        (e: { code?: number; message?: string }) => {
            if (e?.code === 1) {
                // PERMISSION_DENIED
                showLocationToast(UI_TEXT.MAP.GEOLOCATE_PERMISSION_DENIED, "error");
            } else {
                showLocationToast(UI_TEXT.MAP.GEOLOCATE_UNAVAILABLE, "warning");
            }
        },
        [showLocationToast]
    );

    const handleOutOfMaxBounds = useCallback(() => {
        showLocationToast(UI_TEXT.MAP.GEOLOCATE_OUT_OF_BOUNDS, "warning");
    }, [showLocationToast]);

    // Safety timeout in case onLoad is delayed or interrupted
    useEffect(() => {
        const timer = setTimeout(() => {
            handleLoad();
        }, 3000);
        return () => clearTimeout(timer);
    }, [handleLoad]);

    // Cleanup map context and toast timer on unmounting
    useEffect(() => {
        return () => {
            setMap(null);
            if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
            }
        };
    }, [setMap]);

    // Set Korean title / aria-label on the GeolocateControl button
    useEffect(() => {
        const updateGeolocateAria = () => {
            const btn = document.querySelector<HTMLButtonElement>(".maplibregl-ctrl-geolocate");
            if (btn) {
                btn.setAttribute("title", UI_TEXT.MAP.GEOLOCATE_TITLE);
                btn.setAttribute("aria-label", UI_TEXT.MAP.GEOLOCATE_TITLE);
            }
        };
        updateGeolocateAria();
        const timer = setTimeout(updateGeolocateAria, 600);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="relative w-full h-full overflow-hidden">
            <MapGL
                ref={mapRef}
                initialViewState={{
                    longitude: initialView.longitude,
                    latitude: initialView.latitude,
                    zoom: initialView.zoom,
                    bearing: initialView.bearing,
                }}
                onMoveEnd={handleMoveEnd}
                onLoad={handleLoad}
                onError={handleError}
                mapStyle={mapStyleUrl}
                mapLib={maplibregl}
                minZoom={MAP_SETTINGS.ZOOM.MIN}
                maxZoom={MAP_SETTINGS.ZOOM.MAX}
                maxBounds={[
                    MAP_SETTINGS.BOUNDS.MAX[0][0],
                    MAP_SETTINGS.BOUNDS.MAX[0][1],
                    MAP_SETTINGS.BOUNDS.MAX[1][0],
                    MAP_SETTINGS.BOUNDS.MAX[1][1],
                ]}
                style={{width: "100%", height: "100%", position: "relative", zIndex: 0}}
                touchPitch={false}
            >
                <GeolocateControl
                    position="top-right"
                    positionOptions={{
                        enableHighAccuracy: true,
                        timeout: 8000,
                    }}
                    fitBoundsOptions={{
                        maxZoom: 16,
                    }}
                    trackUserLocation={true}
                    showUserLocation={true}
                    showAccuracyCircle={true}
                    onError={handleGeolocateError}
                    onOutOfMaxBounds={handleOutOfMaxBounds}
                />
                <NavigationControl position="top-right" showCompass={true}/>
                {children}
            </MapGL>

            {/* Location Toast Notification */}
            {locationToast && (
                <aside
                    role="status"
                    aria-live="polite"
                    className={`absolute bottom-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg border backdrop-blur-2xl text-xs sm:text-sm font-bold tracking-tight animate-fadeIn select-none pointer-events-auto transition-all ${
                        locationToast.type === "error"
                            ? "bg-rose-500/95 dark:bg-rose-600/95 text-white border-rose-400/30 shadow-rose-500/25"
                            : locationToast.type === "warning"
                                ? "bg-amber-500/95 dark:bg-amber-600/95 text-white border-amber-400/30 shadow-amber-500/25"
                                : "bg-slate-900/90 dark:bg-white/90 text-white dark:text-slate-900 border-black/10 dark:border-white/20 shadow-black/20"
                    }`}
                >
                    {locationToast.type === "error" && <AlertCircle className="w-4 h-4 shrink-0"/>}
                    {locationToast.type === "warning" && <AlertTriangle className="w-4 h-4 shrink-0"/>}
                    {locationToast.type === "info" && <Navigation className="w-4 h-4 shrink-0"/>}
                    <span className="whitespace-nowrap">{locationToast.message}</span>
                </aside>
            )}
        </div>
    );
}
