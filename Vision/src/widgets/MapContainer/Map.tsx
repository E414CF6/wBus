"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { MAP_SETTINGS } from "@core/constants/env";
import { getMapStyleUrl } from "@features/map-view/getMapData";
import { createMapViewFromMap, getInitialMapView, saveMapView } from "@features/map-view/MapViewStorage";
import { useAppMapContext } from "@shared/context/AppMapContext";
import maplibregl from "maplibre-gl";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapGL, { MapRef, NavigationControl } from "react-map-gl/maplibre";

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

    // Load saved view state (center/zoom) or default from config
    const initialView = useMemo(() => getInitialMapView(), []);
    const mapStyleUrl = useMemo(() => getMapStyleUrl(), []);

    const [viewState, setViewState] = useState({
        longitude: initialView.longitude,
        latitude: initialView.latitude,
        zoom: initialView.zoom,
    });

    const handleLoad = useCallback(() => {
        if (readyOnceRef.current) return;
        readyOnceRef.current = true;

        if (mapRef.current) {
            setMap(mapRef.current);
        }

        onReady?.();
    }, [onReady, setMap]);

    const handleMove = useCallback((evt: { viewState: typeof viewState }) => {
        setViewState(evt.viewState);
    }, []);

    const handleMoveEnd = useCallback(() => {
        if (mapRef.current) {
            saveMapView(createMapViewFromMap(mapRef.current));
        }
    }, []);

    // Cleanup map context on unmount
    useEffect(() => {
        return () => {
            setMap(null);
        };
    }, [setMap]);

    return (
        <MapGL
            ref={mapRef}
            {...viewState}
            onMove={handleMove}
            onMoveEnd={handleMoveEnd}
            onLoad={handleLoad}
            mapStyle={mapStyleUrl}
            mapLib={maplibregl}
            minZoom={MAP_SETTINGS.ZOOM.MIN}
            maxZoom={MAP_SETTINGS.ZOOM.MAX}
            maxBounds={MAP_SETTINGS.BOUNDS.MAX as [maplibregl.LngLatLike, maplibregl.LngLatLike]}
            style={{width: "100%", height: "100%", position: "relative", zIndex: 0}}
        >
            <NavigationControl position="top-right" showCompass={false}/>
            {children}
        </MapGL>
    );
}
