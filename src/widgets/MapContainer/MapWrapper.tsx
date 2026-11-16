"use client";

import React from "react";
import Map from "./Map";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

type MapWrapperProps = {
    /** Callback fired when the map is fully initialized */
    onReady?: () => void;
    /** When true, map clicks place a wiki pin instead of closing popups */
    isPinPlacementMode?: boolean;
    /** Callback fired when clicking the map in pin placement mode */
    onPinPlacementClick?: (coords: { lat: number; lng: number }) => void;
    /** Feature-specific layers passed as children (e.g., RouteLayer) */
    children?: React.ReactNode;
};

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------

/**
 * Composition layer: wraps the generic Map shell.
 * Feature-specific layers (bus routes, etc.) are passed as children
 * to avoid cross-feature imports.
 */
const MapWrapper: React.FC<MapWrapperProps> = ({
                                                   onReady,
                                                   isPinPlacementMode,
                                                   onPinPlacementClick,
                                                   children,
                                               }) => {
    return (
        <Map
            onReady={onReady}
            isPinPlacementMode={isPinPlacementMode}
            onPinPlacementClick={onPinPlacementClick}
        >
            {children}
        </Map>
    );
};

export default MapWrapper;
