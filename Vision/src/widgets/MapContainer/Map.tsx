"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import {getMapStyleUrl} from "@features/map-view/getMapData";
import {createMapViewFromMap, getInitialMapView, saveMapView} from "@features/map-view/MapViewStorage";

import {MAP_SETTINGS} from "@shared/config/env";
import {useAppMapContext} from "@shared/context/AppMapContext";

import maplibregl from "maplibre-gl";
import React, {useCallback, useEffect, useMemo, useRef} from "react";
import MapGL, {MapRef, NavigationControl} from "react-map-gl/maplibre";

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

    const handleLoad = useCallback(() => {
        if (readyOnceRef.current) return;
        readyOnceRef.current = true;

        if (mapRef.current) {
            setMap(mapRef.current);
        }

        onReady?.();
    }, [onReady, setMap]);

    const handleMoveEnd = useCallback(() => {
        if (mapRef.current) {
            saveMapView(createMapViewFromMap(mapRef.current));
        }
    }, []);

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
        mapStyle={mapStyleUrl}
        mapLib={maplibregl}
        minZoom={MAP_SETTINGS.ZOOM.MIN}
        maxZoom={MAP_SETTINGS.ZOOM.MAX}
        maxBounds={MAP_SETTINGS.BOUNDS.MAX as [maplibregl.LngLatLike, maplibregl.LngLatLike]}
        style={{width: "100%", height: "100%", position: "relative", zIndex: 0}}
        touchPitch={false}
    >
        <NavigationControl position="top-right" showCompass={true}/>
        {children}
    </MapGL>);
}
