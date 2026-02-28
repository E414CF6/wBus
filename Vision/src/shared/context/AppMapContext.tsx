"use client";

import type { Map } from "leaflet";
import { createContext, ReactNode, useContext, useMemo, useState } from "react";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface AppMapContextType {
    /** The raw Leaflet Map instance. Null if not yet initialized. */
    map: Map | null;
    /** Setter for the Leaflet Map instance. */
    setMap: (map: Map | null) => void;
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
 * Custom hook to access the global Leaflet Map instance.
 *
 * Usage:
 * - Access the `map` instance to perform imperative actions (panTo, fitBounds).
 *
 * @throws Error if used outside of <AppMapContextProvider>
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
 * Provider component that maintains the Leaflet map instance globally.
 *
 * Architecture Note:
 * Leaflet is imperative, while React is declarative. This provider holds the
 * imperative `map` object in state so that sibling components (Sidebar, Overlays)
 * can control the map without direct parent-child prop drilling.
 */
export function AppMapContextProvider({children}: AppMapContextProviderProps) {
    const [map, setMap] = useState<Map | null>(null);

    const value = useMemo(() => ({
        map,
        setMap,
    }), [map]);

    return <AppMapContext.Provider value={value}>{children}</AppMapContext.Provider>;
}
