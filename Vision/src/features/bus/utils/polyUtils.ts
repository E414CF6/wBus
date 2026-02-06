/**
 * @fileoverview Legacy polyline utilities.
 * Most functionality has been moved to PolylineService and core/utils/geo.
 * This file provides backward compatibility for existing imports.
 */

import type { GeoPolyline, Coordinate } from "@core/domain";
import { isFiniteNumber } from "@core/utils/geo";

// Re-export from centralized locations
export type { Coordinate } from "@core/domain";
export { snapPointToPolyline as snapToPolyline, type SnapResult, type SnapOptions } from "@core/utils/geo";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

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

export interface SplitResult {
    upPolyline: Coordinate[][];
    downPolyline: Coordinate[][];
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

function toLatLngCoords(coords: Array<[number, number]>): Coordinate[] {
    return coords.map(([lng, lat]) => [lat, lng]);
}

function clampIndex(value: number, max: number): number {
    return Math.max(0, Math.min(value, max));
}

function buildStopIndexMap(data: GeoPolyline): StopIndexMap | undefined {
    const feature = data.features?.[0];
    const stops = feature?.properties?.stops ?? [];
    const stopToCoord = feature?.properties?.stop_to_coord ?? [];

    if (stops.length === 0 || stopToCoord.length === 0) return undefined;

    const map: StopIndexMap = { byId: {}, byIdDir: {}, byOrd: {}, byOrdDir: {} };

    stops.forEach((stop, idx) => {
        const coordIndex = stopToCoord[idx];
        if (!isFiniteNumber(coordIndex)) return;

        const rawId = typeof stop.id === "string" ? stop.id.trim() : "";
        const ord = Number(stop.ord);
        const dir = Number(stop.ud);

        if (rawId) {
            map.byId[rawId] = coordIndex;
            if (Number.isFinite(dir)) map.byIdDir[`${rawId}-${dir}`] = coordIndex;
        }

        if (Number.isFinite(ord)) {
            map.byOrd[String(ord)] = coordIndex;
            if (Number.isFinite(dir)) map.byOrdDir[`${ord}-${dir}`] = coordIndex;
        }
    });

    return map;
}

function splitByTurnIndex(coords: Coordinate[], turnIndex: number): SplitResult {
    if (coords.length < 2) return { upPolyline: [], downPolyline: [] };

    const idx = clampIndex(Math.round(turnIndex), coords.length - 1);
    const upCoords = coords.slice(0, idx + 1);
    const downCoords = coords.slice(idx);

    return {
        upPolyline: upCoords.length > 1 ? [upCoords] : [],
        downPolyline: downCoords.length > 1 ? [downCoords] : [],
    };
}

// ----------------------------------------------------------------------
// Exported Functions
// ----------------------------------------------------------------------

/**
 * Transforms GeoJSON data into renderable Up/Down polylines.
 * @deprecated Consider using PolylineService.fetchRoutePolyline instead
 */
export function transformPolyline(data: GeoPolyline): SplitResult {
    if (!data.features || data.features.length === 0) {
        return { upPolyline: [], downPolyline: [] };
    }

    const feature = data.features[0];
    const coords = toLatLngCoords(feature.geometry.coordinates);

    if (feature.properties.turn_idx !== undefined) {
        return splitByTurnIndex(coords, feature.properties.turn_idx);
    }

    return {
        upPolyline: coords.length > 1 ? [coords] : [],
        downPolyline: []
    };
}

/**
 * Extracts turn index and stop-to-coordinate lookups.
 * @deprecated Consider using PolylineService instead
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
