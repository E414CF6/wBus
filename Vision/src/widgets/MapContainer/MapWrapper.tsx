"use client";

import React from "react";
import Map from "./Map";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

type MapWrapperProps = {
    /** Callback fired when the map is fully initialized */
    onReady?: () => void;
    /** Feature-specific layers passed as children (e.g. RouteLayer) */
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
const MapWrapper: React.FC<MapWrapperProps> = ({onReady, children}) => {
    return (
        <Map onReady={onReady}>
            {children}
        </Map>
    );
};

export default MapWrapper;
