import { APP_CONFIG, MAP_SETTINGS, STORAGE_KEYS } from "@shared/config/env";
import type { MapRef } from "react-map-gl/maplibre";

// ----------------------------------------------------------------------
// Types & Constants
// ----------------------------------------------------------------------

export type StoredMapView = {
    latitude: number;
    longitude: number;
    zoom: number;
    bearing: number;
};

const DEFAULT_MAP_VIEW: StoredMapView = {
    latitude: MAP_SETTINGS.BOUNDS.DEFAULT_CENTER[0],
    longitude: MAP_SETTINGS.BOUNDS.DEFAULT_CENTER[1],
    zoom: MAP_SETTINGS.ZOOM.DEFAULT,
    bearing: 0,
};

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

/**
 * Clamps the zoom level to the allowed min/max range.
 */
function clampZoom(zoom: number): number {
    return Math.min(MAP_SETTINGS.ZOOM.MAX, Math.max(MAP_SETTINGS.ZOOM.MIN, zoom));
}

/**
 * Validates if a coordinate value is a finite number.
 */
function isValidCoordinate(val: unknown): val is number {
    return typeof val === 'number' && Number.isFinite(val);
}

// ----------------------------------------------------------------------
// Public Functions
// ----------------------------------------------------------------------

/**
 * Gets the initial map view state.
 * Priority: 1. Local Storage (User Preference) -> 2. Default Config
 */
export function getInitialMapView(): StoredMapView {
    return loadStoredMapView() ?? DEFAULT_MAP_VIEW;
}

/**
 * Loads and validates the map view from Local Storage.
 * Returns null if no data exists, or if data is corrupted/out-of-bounds.
 */
export function loadStoredMapView(): StoredMapView | null {
    if (typeof window === "undefined") return null;

    try {
        const raw = localStorage.getItem(STORAGE_KEYS.MAP_VIEW);
        if (!raw) return null;

        const parsed = JSON.parse(raw);

        // Structure Check
        if (!parsed || parsed.latitude === undefined || parsed.longitude === undefined) {
            return null;
        }

        const lat = Number(parsed.latitude);
        const lng = Number(parsed.longitude);
        const zoom = Number(parsed.zoom);

        // Type Validity Check
        if (!isValidCoordinate(lat) || !isValidCoordinate(lng) || !isValidCoordinate(zoom)) {
            return null;
        }

        // Logic Validity Check (Is it within the allowed map area?)
        const [[minLng, minLat], [maxLng, maxLat]] = MAP_SETTINGS.BOUNDS.MAX;
        if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) {
            if (APP_CONFIG.IS_DEV) {
                console.warn("[MapViewStorage] Stored view is outside allowed bounds. Resetting to default.");
            }
            return null;
        }

        const bearing = Number(parsed.bearing ?? 0);

        return {
            latitude: lat,
            longitude: lng,
            zoom: clampZoom(zoom),
            bearing: isValidCoordinate(bearing) ? bearing : 0,
        };

    } catch (error) {
        if (APP_CONFIG.IS_DEV) {
            console.error("[MapViewStorage] Failed to parse stored map view:", error);
        }
        return null;
    }
}

/**
 * Creates a clean StoredMapView object from a MapLibre MapRef instance.
 * Precision is reduced (toFixed) to save storage space.
 */
export function createMapViewFromMap(map: MapRef): StoredMapView {
    const center = map.getCenter();
    const zoom = map.getZoom();

    return {
        // Keep 6 decimal places for coordinates (~10cm precision)
        latitude: Number(center.lat.toFixed(6)),
        longitude: Number(center.lng.toFixed(6)),
        // Keep 2 decimal places for zoom
        zoom: Number(clampZoom(zoom).toFixed(2)),
        bearing: Number(map.getBearing().toFixed(2)),
    };
}

/**
 * Persists the map view state to Local Storage.
 */
export function saveMapView(view: StoredMapView): void {
    if (typeof window === "undefined") return;

    try {
        localStorage.setItem(STORAGE_KEYS.MAP_VIEW, JSON.stringify(view));
    } catch (error) {
        if (APP_CONFIG.IS_DEV) {
            console.error("[MapViewStorage] Failed to write map view to storage:", error);
        }
    }
}
