/**
 * @fileoverview Unified polyline hook that replaces useBusPolyline, useBusPolylineMap, and useBusMultiPolyline.
 * Uses the centralized PolylineService for all data operations.
 */

"use client";

import {
    createMultiPolylineData, fetchRoutePolylines, type MultiPolylineData, type PolylineData, type PolylineSegment,
} from "@entities/route/polylineService";

import type {Coordinate} from "@entities/route/types";
import {buildRouteIdsKey} from "@shared/utils/routeIds";
import {useEffect, useMemo, useState} from "react";

// ============================================================================
// Types (Re-exported for convenience)
// ============================================================================

export type {PolylineData, PolylineSegment};

export interface BusPolylineSet {
    upPolyline: Coordinate[];
    downPolyline: Coordinate[];
    stopIndexMap?: PolylineData["stopIndexMap"];
    turnIndex?: number;
    isSwapped?: boolean;
}

const EMPTY_POLYLINE_MAP = new Map<string, PolylineData>();

function usePolylineSnapshot(routeIds: string[]): Map<string, PolylineData> {
    const [snapshot, setSnapshot] = useState<{
        key: string; map: Map<string, PolylineData>;
    }>({key: "", map: EMPTY_POLYLINE_MAP});
    const routeKey = useMemo(() => buildRouteIdsKey(routeIds, "|"), [routeIds]);

    useEffect(() => {
        if (!routeKey) {
            setSnapshot({key: "", map: EMPTY_POLYLINE_MAP});
            return;
        }

        let mounted = true;
        const ids = routeKey.split("|").filter(Boolean);

        fetchRoutePolylines(ids).then((map) => {
            if (mounted) setSnapshot({key: routeKey, map});
        });

        return () => {
            mounted = false;
        };
    }, [routeKey]);

    return useMemo(() => (snapshot.key === routeKey ? snapshot.map : EMPTY_POLYLINE_MAP), [snapshot, routeKey]);
}

/**
 * Fetches polyline data for multiple routes.
 * Returns a Map<routeId, PolylineData> for O(1) lookups.
 * Replaces the old useBusPolylineMap hook.
 */
export function useBusPolylineMap(routeIds: string[]): Map<string, BusPolylineSet> {
    const polylineMap = usePolylineSnapshot(routeIds);

    // Return typed map compatible with existing code
    return useMemo(() => {
        const result = new Map<string, BusPolylineSet>();
        for (const [id, data] of polylineMap) {
            result.set(id, {
                upPolyline: data.upPolyline,
                downPolyline: data.downPolyline,
                stopIndexMap: data.stopIndexMap,
                turnIndex: data.turnIndex,
                isSwapped: data.isSwapped,
            });
        }
        return result;
    }, [polylineMap]);
}

// ============================================================================
// Hook: useMultiPolyline (Deduplicated Segments)
// ============================================================================

const EMPTY_MULTI: MultiPolylineData = {
    activeUpSegments: [], activeDownSegments: [], inactiveUpSegments: [], inactiveDownSegments: [], bounds: null,
};

/**
 * Fetches and processes multiple route polylines into deduplicated segments.
 * Useful for rendering overlapping routes with different colors.
 * Replaces the old useMultiPolyline hook.
 */
export function useMultiPolyline(routeIds: string[], activeRouteIds?: string[]): MultiPolylineData {
    const polylineMap = usePolylineSnapshot(routeIds);

    return useMemo(() => {
        if (polylineMap.size === 0) {
            return EMPTY_MULTI;
        }
        return createMultiPolylineData(polylineMap, activeRouteIds);
    }, [polylineMap, activeRouteIds]);
}

// ============================================================================
// Utility: Get Fallback Polylines
// ============================================================================

/**
 * Selects the best available polyline set from a map.
 * Prioritizes activeRouteId, then falls back to the first available.
 */
export function getFallbackPolylines(polylineMap: Map<string, BusPolylineSet>, activeRouteId?: string | null): BusPolylineSet {
    if (activeRouteId && polylineMap.has(activeRouteId)) {
        return polylineMap.get(activeRouteId)!;
    }

    return {upPolyline: [], downPolyline: []};
}
