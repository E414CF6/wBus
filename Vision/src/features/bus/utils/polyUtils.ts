import type { GeoPolyline } from "@core/domain/geojson";

// ----------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------

export type Coordinate = [number, number]; // [Latitude, Longitude] for Leaflet
type GeoJSONCoordinate = [number, number]; // [Longitude, Latitude] for GeoJSON

export interface SplitResult {
    upPolyline: Coordinate[][];
    downPolyline: Coordinate[][];
}

export type StopIndexMap = {
    byId: Record<string, number>;
    byIdDir: Record<string, number>;
    byOrd: Record<string, number>;
    byOrdDir: Record<string, number>;
};

export interface PolylineMeta {
    turnIndex?: number;
    stopIndexMap?: StopIndexMap;
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

/**
 * Converts GeoJSON coordinates [Lng, Lat] to Leaflet coordinates [Lat, Lng].
 */
function toLatLngCoords(coords: GeoJSONCoordinate[]): Coordinate[] {
    return coords.map(([lng, lat]) => [lat, lng]);
}

function clampIndex(value: number, max: number): number {
    return Math.max(0, Math.min(value, max));
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function buildStopIndexMap(data: GeoPolyline): StopIndexMap | undefined {
    const feature = data.features?.[0];
    const stops = feature?.properties?.stops ?? [];
    const stopToCoord = feature?.properties?.stop_to_coord ?? [];

    if (stops.length === 0 || stopToCoord.length === 0) return undefined;

    const map: StopIndexMap = {
        byId: {},
        byIdDir: {},
        byOrd: {},
        byOrdDir: {},
    };

    stops.forEach((stop, idx) => {
        const coordIndex = stopToCoord[idx];
        if (!isFiniteNumber(coordIndex)) return;

        const rawId = typeof stop.id === "string" ? stop.id.trim() : "";
        const ord = Number(stop.ord);
        const dir = Number(stop.ud);

        if (rawId) {
            map.byId[rawId] = coordIndex;
            if (Number.isFinite(dir)) {
                map.byIdDir[`${rawId}-${dir}`] = coordIndex;
            }
        }

        if (Number.isFinite(ord)) {
            map.byOrd[String(ord)] = coordIndex;
            if (Number.isFinite(dir)) {
                map.byOrdDir[`${ord}-${dir}`] = coordIndex;
            }
        }
    });

    return map;
}

/**
 * Splits the array at a specific index (Turning Point).
 * Logic: 0 -> TurnIndex is UP, TurnIndex -> End is DOWN.
 */
function splitByTurnIndex(coords: Coordinate[], turnIndex: number): SplitResult {
    if (coords.length < 2) return { upPolyline: [], downPolyline: [] };

    const idx = clampIndex(Math.round(turnIndex), coords.length - 1);

    // Slice coordinates based on the turn index
    const upCoords = coords.slice(0, idx + 1); // Include turning point
    const downCoords = coords.slice(idx);      // Start from turning point

    return {
        // Wrap in array because Leaflet Polyline often expects MultiPolyline format or consistency
        upPolyline: upCoords.length > 1 ? [upCoords] : [],
        downPolyline: downCoords.length > 1 ? [downCoords] : [],
    };
}

// ----------------------------------------------------------------------
// Main Transformation Logic
// ----------------------------------------------------------------------

/**
 * Main entry point to transform GeoJSON data into renderable Up/Down polylines.
 * Strictly adheres to the new GeoPolyline schema using `turn_idx`.
 */
export function transformPolyline(data: GeoPolyline): SplitResult {
    // Validate Feature Existence
    if (!data.features || data.features.length === 0) {
        return { upPolyline: [], downPolyline: [] };
    }

    // Extract the main feature (Assume 1 Feature per route in new schema)
    const feature = data.features[0];
    const { geometry, properties } = feature;

    // Convert Coordinates (GeoJSON [Lng,Lat] -> Leaflet [Lat,Lng])
    const coords = toLatLngCoords(geometry.coordinates);

    // Split based on Turn Index if available
    if (properties.turn_idx !== undefined) {
        return splitByTurnIndex(coords, properties.turn_idx);
    }

    // Fallback: If no turn_idx, treat entire line as Up direction (One-way or Loop)
    // This is the safest default for the new schema if metadata is missing.
    return {
        upPolyline: coords.length > 1 ? [coords] : [],
        downPolyline: []
    };
}

/**
 * Extracts turn index and stop-to-coordinate lookups for stop-based snapping.
 */
export function getPolylineMeta(data: GeoPolyline): PolylineMeta {
    if (!data.features || data.features.length === 0) {
        return {};
    }

    const feature = data.features[0];
    const turnIndex = isFiniteNumber(feature.properties?.turn_idx)
        ? feature.properties.turn_idx
        : undefined;

    return {
        turnIndex,
        stopIndexMap: buildStopIndexMap(data),
    };
}

// ----------------------------------------------------------------------
// Re-export unified snapping from geoUtils
// ----------------------------------------------------------------------
// The snapping logic has been moved to @map/utils/geoUtils for reuse.
// Re-export here for backward compatibility with existing imports.

export { snapPointToPolyline as snapToPolyline } from "@map/utils/geoUtils";
export type { SnapResult, SnapOptions } from "@map/utils/geoUtils";
