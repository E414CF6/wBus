"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { MAP_SETTINGS } from "@core/constants/env";

// Map Sub-components
import MapContextBridge from "@features/map-view/MapContextBridge";
import MapLibreBaseLayer from "@features/map-view/MapLibreBaseLayer";
import MapViewPersistence from "@features/map-view/MapViewPersistence";

import { getInitialMapView } from "@features/map-view/MapViewStorage";

import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";

import React, { useCallback, useMemo, useRef } from "react";
import { MapContainer, ZoomControl } from "react-leaflet";

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

/**
 * Generic map shell component.
 * Responsible only for initializing the Leaflet map container, base layer,
 * and context bridge. Feature-specific layers (bus markers, polylines)
 * are passed in via `children` — keeping the map module decoupled from
 * feature modules.
 */
export default function Map({onReady, children}: MapProps) {
    // Ref to ensure the ready callback is fired exactly once
    const readyOnceRef = useRef(false);

    // Handler to signal parent that map is interactive
    const handleReadyOnce = useCallback(() => {
        if (readyOnceRef.current) return;
        readyOnceRef.current = true;
        onReady?.();
    }, [onReady]);

    // Load saved view state (center/zoom) or default from config
    const initialView = useMemo(() => getInitialMapView(), []);

    // Static Map Options (Memoized to prevent MapContainer re-initialization)
    const mapOptions = useMemo(() => ({
        center: initialView.center as LatLngExpression,
        zoom: initialView.zoom,
        minZoom: MAP_SETTINGS.ZOOM.MIN,
        maxZoom: MAP_SETTINGS.ZOOM.MAX,
        maxBounds: MAP_SETTINGS.BOUNDS.MAX as LatLngBoundsExpression,
        maxBoundsViscosity: 1.0,
        scrollWheelZoom: true,
        preferCanvas: true,
        zoomControl: false,
    }), [initialView]);

    return (
        <MapContainer
            {...mapOptions}
            className="w-full h-full relative z-0"
        >
            {/* 1. UI Controls */}
            <ZoomControl position="topright"/>

            {/* 2. Logic & Base Layers */}
            <MapContextBridge>
                {/* Base Vector Tile Layer (MapLibre integration) */}
                <MapLibreBaseLayer onReady={handleReadyOnce}/>

                {/* Persist user's zoom/pan state */}
                <MapViewPersistence/>

                {/* 3. Feature Layers (injected via children) */}
                {children}
            </MapContextBridge>
        </MapContainer>
    );
}
