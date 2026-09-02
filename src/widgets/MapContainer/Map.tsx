"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import {getMapStyleUrl} from "@features/map-view/getMapData";
import {createMapViewFromMap, getInitialMapView, saveMapView} from "@features/map-view/MapViewStorage";

import {MAP_SETTINGS} from "@shared/config/env";
import {useAppMapContext} from "@shared/context/AppMapContext";

import * as maplibregl from "maplibre-gl";
import {setWorkerUrl} from "maplibre-gl";
import {useTheme} from "next-themes";
import React, {useCallback, useEffect, useMemo, useRef} from "react";
import MapGL, {MapRef, NavigationControl} from "react-map-gl/maplibre";

// Set MapLibre GL JS v6 Web Worker path via CDN
if (typeof window !== "undefined") {
    setWorkerUrl("https://unpkg.com/maplibre-gl@6.6.0/dist/maplibre-gl-worker.mjs");
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

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

export default function Map({onReady, children}: MapProps) {
    const mapRef = useRef<MapRef>(null);
    const {setMap} = useAppMapContext();
    const readyOnceRef = useRef(false);
    const {resolvedTheme} = useTheme();

    // Load saved view state (center/zoom) or default from config
    const initialView = useMemo(() => getInitialMapView(), []);
    const mapStyleUrl = useMemo(() => getMapStyleUrl(resolvedTheme), [resolvedTheme]);

    const handleLoad = useCallback(() => {
        if (readyOnceRef.current) return;
        readyOnceRef.current = true;

        if (mapRef.current) {
            setMap(mapRef.current);
        }

        onReady?.();
    }, [onReady, setMap]);

    const handleError = useCallback((e: unknown) => {
        console.warn("[MapGL] Map error encountered, falling back to ready state:", e);
        handleLoad();
    }, [handleLoad]);

    const handleMoveEnd = useCallback(() => {
        if (mapRef.current) {
            saveMapView(createMapViewFromMap(mapRef.current));
        }
    }, []);

    // Safety timeout in case onLoad is delayed or interrupted
    useEffect(() => {
        const timer = setTimeout(() => {
            handleLoad();
        }, 3000);
        return () => clearTimeout(timer);
    }, [handleLoad]);

    // Cleanup map context on unmounting
    useEffect(() => {
        return () => {
            setMap(null);
        };
    }, [setMap]);

    return (<MapGL
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
        <NavigationControl position="top-right" showCompass={true}/>
        {children}
    </MapGL>);
}
