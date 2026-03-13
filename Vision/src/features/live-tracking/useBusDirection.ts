import { getRouteDetails, getRouteInfo } from "@entities/route/api";

import {
    buildDirectionLookup,
    type DirectionResolverState,
    resolveDirection,
    type RouteSequenceData,
} from "@entities/route/directionService";
import type { DirectionCode } from "@entities/route/types";

import { APP_CONFIG } from "@shared/config/env";
import { useCallback, useEffect, useMemo, useState } from "react";

// ----------------------------------------------------------------------
// Main Hook: useBusDirection
// ----------------------------------------------------------------------

/**
 * Determines the direction (Up/Down) of a bus based on its current Stop ID and Order.
 * Loads route data, builds lookup indexes, and returns a resolver function.
 *
 * Business logic is delegated to DirectionService (pure, testable).
 */
export function useBusDirection(routeName: string) {
    const [isReady, setIsReady] = useState(false);
    const [routeState, setRouteState] = useState<DirectionResolverState>({
        sequences: [],
        routeIdOrder: [],
    });

    // Load Route Data
    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            setIsReady(false);
            setRouteState({sequences: [], routeIdOrder: []});

            try {
                const info = await getRouteInfo(routeName);
                if (!info) {
                    if (isMounted) setRouteState({sequences: [], routeIdOrder: []});
                    return;
                }

                const details = await Promise.all(
                    info.vehicleRouteIds.map(async (id) => {
                        const d = await getRouteDetails(id);
                        return d ? {routeid: id, sequence: d.sequence} : null;
                    })
                );

                if (isMounted) {
                    const validDetails = details.filter(Boolean) as RouteSequenceData[];
                    setRouteState({
                        sequences: validDetails,
                        routeIdOrder: validDetails.map((d) => d.routeid),
                    });
                    setIsReady(true);
                }
            } catch (err) {
                if (APP_CONFIG.IS_DEV) {
                    console.error(`[useBusDirection] Failed to load route: ${routeName}`, err);
                }
                if (isMounted) setRouteState({sequences: [], routeIdOrder: []});
            }
        };

        loadData();
        return () => {
            isMounted = false;
        };
    }, [routeName]);

    // Build lookup indexes (pure computation, memoized)
    const lookup = useMemo(
        () => (isReady ? buildDirectionLookup(routeState) : null),
        [routeState, isReady]
    );

    // Stable resolver callback
    return useCallback(
        (nodeid: string | null | undefined, nodeord: number, routeid?: string | null): DirectionCode => {
            if (!lookup) return null;
            return resolveDirection(lookup, nodeid, nodeord, routeid);
        },
        [lookup]
    );
}

