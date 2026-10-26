/**
 * @fileoverview Unified polyline hook that replaces useBusPolyline, useBusPolylineMap, and useBusMultiPolyline.
 * Uses the centralized PolylineService for all data operations.
 */

"use client";

import {fetchRoutePolylines, getCachedRoutePolylinesSync, type PolylineData,} from "@entities/route/polylineService";

import type {Coordinate} from "@entities/route/types";
import {useRouteInfo} from "@entities/route/hooks";
import {buildRouteIdsKey} from "@shared/utils/routeIds";
import {useEffect, useMemo, useState} from "react";

// ============================================================================
// Types (Re-exported for convenience)
// ============================================================================

export type {PolylineData};

export interface BusPolylineSet {
    upPolyline: Coordinate[];
    downPolyline: Coordinate[];
    stopIndexMap?: PolylineData["stopIndexMap"];
    turnIndex?: number;
    bbox?: PolylineData["bbox"];
}

const EMPTY_POLYLINE_MAP = new Map<string, PolylineData>();

function usePolylineSnapshot(routeIds: string[], cityCode: string = "32020"): Map<string, PolylineData> {
    const ids = useMemo(() => buildRouteIdsKey(routeIds, "|").split("|").filter(Boolean), [routeIds]);
    const routeKey = useMemo(() => `${cityCode}:${ids.join("|")}`, [cityCode, ids]);
    const syncCached = useMemo(() => getCachedRoutePolylinesSync(ids, cityCode), [ids, cityCode]);

    const [snapshot, setSnapshot] = useState<{
        key: string; map: Map<string, PolylineData>;
    }>(() => ({
        key: syncCached ? routeKey : "",
        map: syncCached ?? EMPTY_POLYLINE_MAP,
    }));

    useEffect(() => {
        if (ids.length === 0 || syncCached) return;

        let mounted = true;
        fetchRoutePolylines(ids, cityCode)
            .then((map) => {
                if (mounted) setSnapshot({key: routeKey, map});
            })
            .catch((err) => {
                console.warn("[usePolyline] Failed to fetch route polylines:", err);
                if (mounted) setSnapshot({key: routeKey, map: EMPTY_POLYLINE_MAP});
            });

        return () => {
            mounted = false;
        };
    }, [routeKey, cityCode, ids, syncCached]);

    return useMemo(
        () => (snapshot.key === routeKey ? snapshot.map : syncCached ?? EMPTY_POLYLINE_MAP),
        [snapshot, routeKey, syncCached]
    );
}

/**
 * Fetches polyline data for multiple routes.
 * Returns a Map<routeId, PolylineData> for O(1) lookups.
 * Replaces the old useBusPolylineMap hook.
 */
export function useBusPolylineMap(routeIds: string[], cityCode: string = "32020"): Map<string, BusPolylineSet> {
    const polylineMap = usePolylineSnapshot(routeIds, cityCode);

    // Return typed map compatible with existing code
    return useMemo(() => {
        const result = new Map<string, BusPolylineSet>();
        for (const [id, data] of polylineMap) {
            result.set(id, {
                upPolyline: data.upPolyline,
                downPolyline: data.downPolyline,
                stopIndexMap: data.stopIndexMap,
                turnIndex: data.turnIndex,
                bbox: data.bbox,
            });
        }
        return result;
    }, [polylineMap]);
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

    return {upPolyline: [], downPolyline: [], turnIndex: 0};
}

/**
 * Hook to retrieve route polyline and geometry data without subscribing to live bus location telemetry.
 * Prevents unnecessary re-renders when live buses move.
 */
export function useRoutePolylineData(routeName: string, enabled: boolean = true, cityCode: string = "32020") {
    const routeInfo = useRouteInfo(routeName, enabled, cityCode);
    const routeIds = useMemo(() => {
        const ids = routeInfo?.vehicleRouteIds ?? [];
        if (cityCode === "32020") {
            return ids.filter((id) => !id.startsWith("WJB258"));
        }
        if (cityCode === "32320") {
            return ids.filter((id) => id.startsWith("WJB258"));
        }
        return ids;
    }, [routeInfo?.vehicleRouteIds, cityCode]);
    const polylineMap = useBusPolylineMap(routeIds, cityCode);
    const activeRouteId = routeIds[0] ?? null;

    return {
        routeInfo: routeInfo ?? null,
        routeIds,
        polylineMap,
        activeRouteId,
    };
}
