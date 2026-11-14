import {getCachedPolylineSync, getRouteDetails} from "@entities/route/api";
import {useRouteInfo} from "@entities/route/hooks";

import {
    buildDirectionLookup,
    type DirectionResolverState,
    resolveDirection,
    type RouteSequenceData,
} from "@entities/route/directionService";
import type {DirectionCode} from "@entities/route/types";

import {APP_CONFIG} from "@shared/config/env";

import {useCallback, useEffect, useMemo, useState} from "react";

// ----------------------------------------------------------------------
// Main Hook: useBusDirection
// ----------------------------------------------------------------------

/**
 * Determines the direction (Up/Down) of a bus based on its current Stop ID and Order.
 * Shares cached GeoPolyline payloads with polyline hooks and falls back to async fetching when needed.
 *
 * Business logic is delegated to DirectionService (pure, testable).
 */
export function useBusDirection(routeName: string, cityCode: string = "32020") {
    const routeInfo = useRouteInfo(routeName, true, cityCode);
    const routeKey = useMemo(
        () => (routeInfo ? `${cityCode}:${routeInfo.vehicleRouteIds.join("|")}` : ""),
        [cityCode, routeInfo]
    );

    const syncRouteState = useMemo<DirectionResolverState | null>(() => {
        if (!routeInfo || routeInfo.vehicleRouteIds.length === 0) return null;
        const sequences: RouteSequenceData[] = [];
        for (const id of routeInfo.vehicleRouteIds) {
            const poly = getCachedPolylineSync(id, cityCode);
            if (!poly?.stops) return null;
            sequences.push({
                routeid: id,
                sequence: poly.stops.map((s) => ({
                    nodeid: s.id,
                    nodeord: s.ord,
                    updowncd: s.ud,
                })),
            });
        }
        return {
            sequences,
            routeIdOrder: sequences.map((d) => d.routeid),
        };
    }, [routeInfo, cityCode]);

    const [asyncState, setAsyncState] = useState<{
        key: string; state: DirectionResolverState;
    } | null>(null);

    // Load route sequence data only when not already hydrated in L1 polyline cache
    useEffect(() => {
        if (!routeInfo || syncRouteState) return;
        let isMounted = true;

        const loadData = async () => {
            try {
                const details = await Promise.all(routeInfo.vehicleRouteIds.map(async (id) => {
                    const d = await getRouteDetails(id, cityCode);
                    return d ? {routeid: id, sequence: d.sequence} : null;
                }));

                if (isMounted) {
                    const validDetails = details.filter(Boolean) as RouteSequenceData[];
                    setAsyncState({
                        key: routeKey,
                        state: {
                            sequences: validDetails,
                            routeIdOrder: validDetails.map((d) => d.routeid),
                        },
                    });
                }
            } catch (err) {
                if (APP_CONFIG.IS_DEV) {
                    console.error(`[useBusDirection] Failed to load route: ${routeName}`, err);
                }
                if (isMounted) {
                    setAsyncState({key: routeKey, state: {sequences: [], routeIdOrder: []}});
                }
            }
        };

        void loadData();

        return () => {
            isMounted = false;
        };
    }, [routeName, routeInfo, routeKey, cityCode, syncRouteState]);

    const activeRouteState = useMemo<DirectionResolverState | null>(() => {
        if (syncRouteState) return syncRouteState;
        if (asyncState && asyncState.key === routeKey) return asyncState.state;
        return null;
    }, [syncRouteState, asyncState, routeKey]);

    // Build lookup indexes (pure computation, memoized)
    const lookup = useMemo(
        () => (activeRouteState ? buildDirectionLookup(activeRouteState) : null),
        [activeRouteState]
    );

    // Stable resolver callback
    return useCallback((nodeid: string | null | undefined, nodeord: number, routeid?: string | null): DirectionCode => {
        if (!lookup) return null;
        return resolveDirection(lookup, nodeid, nodeord, routeid);
    }, [lookup]);
}
