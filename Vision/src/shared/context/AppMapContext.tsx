"use client";

import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface AppMapContextType {
    /** The raw MapLibre Map instance. Null if not yet initialized. */
    map: MapRef | null;
    /** Setter for the MapLibre Map instance. */
    setMap: (map: MapRef | null) => void;
}

interface AppMapContextProviderProps {
    children: ReactNode;
}

// ----------------------------------------------------------------------
// Context Creation
// ----------------------------------------------------------------------

const AppMapContext = createContext<AppMapContextType | undefined>(undefined);

// ----------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------

/**
 * Custom hook to access the global MapLibre Map instance.
 *
 * Usage:
 * - Access the `map` instance to perform imperative actions (panTo, fitBounds).
 *
 * @throws Error if used outside <AppMapContextProvider>
 */
export function useAppMapContext(): AppMapContextType {
    const context = useContext(AppMapContext);
    if (!context) {
        throw new Error(
            "[useAppMapContext] Context is missing. Ensure this component is wrapped within a <AppMapContextProvider>."
        );
    }
    return context;
}

// ----------------------------------------------------------------------
// Provider Component
// ----------------------------------------------------------------------

/**
 * Provider component that maintains the MapLibre map instance globally.
 *
 * Architecture Note:
 * This provider holds the imperative `map` object in state so that sibling
 * components (Sidebar, Overlays) can control the map without direct parent-child
 * prop drilling.
 */
export function AppMapContextProvider({children}: AppMapContextProviderProps) {
    const [map, setMap] = useState<MapRef | null>(null);

    const value = useMemo(() => ({
        map,
        setMap,
    }), [map]);

    return <AppMapContext.Provider value={value}>{children}</AppMapContext.Provider>;
}
