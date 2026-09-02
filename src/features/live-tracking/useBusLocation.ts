import {buildRouteIdsKey} from "@shared/utils/routeIds";
import {useMemo, useSyncExternalStore} from "react";
import {getBusLocationStore} from "./lib/BusLocationStore";
import {type BusLocationState, EMPTY_STATE} from "./model/types";

export * from "./model/types";
export {getBusLocationStore, BusLocationStore} from "./lib/BusLocationStore";

/**
 * Fetch bus locations for multiple routeIds.
 * Primary transport: SSE stream (/api/bus/stream).
 * Fallback: periodic polling via /api/bus/[routeId].
 */
export function useBusLocationData(routeIds: string[]): BusLocationState {
    const routeIdsKey = useMemo(() => buildRouteIdsKey(routeIds), [routeIds]);
    const store = useMemo(() => (routeIdsKey ? getBusLocationStore(routeIdsKey) : null), [routeIdsKey]);
    const subscribe = useMemo(() => {
        if (!store) return () => () => undefined;
        return store.subscribe;
    }, [store]);
    const getSnapshot = useMemo(() => {
        if (!store) return () => EMPTY_STATE;
        return store.getSnapshot;
    }, [store]);

    return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_STATE);
}

export const useBusLocation = useBusLocationData;
