import {ApiValidators} from "@shared/api/validators";
import {buildRouteIdsKey, normalizeRouteIds} from "@shared/utils/routeIds";
import {useEffect, useMemo, useSyncExternalStore} from "react";
import {getBusLocationStore, getBusLocationStoreByRouteName} from "./lib/BusLocationStore";
import {type BusLocationState, EMPTY_STATE} from "./model/types";

export * from "./model/types";
export {getBusLocationStore, getBusLocationStoreByRouteName, BusLocationStore} from "./lib/BusLocationStore";

export interface UseBusLocationOptions {
    routeName?: string;
    enabled?: boolean;
}

/**
 * Fetch bus locations for a route name (preferred, via `/api/bus?routeName=...`)
 * or explicit routeIds (`/api/bus/[routeId]` or `/api/bus?routeIds=...`).
 * Backed by high-performance CDN micro-cached REST polling.
 */
export function useBusLocationData(
    routeIds: string[],
    cityCode = "32020",
    options?: UseBusLocationOptions
): BusLocationState {
    const enabled = options?.enabled ?? true;
    const normalizedRouteName = options?.routeName?.trim() || "";
    const canUseRouteName =
        enabled &&
        Boolean(normalizedRouteName) &&
        ApiValidators.isValidRouteName(normalizedRouteName);

    const normalizedRouteIds = useMemo(() => normalizeRouteIds(routeIds), [routeIds]);
    const routeIdsKey = useMemo(() => buildRouteIdsKey(normalizedRouteIds), [normalizedRouteIds]);
    const fallbackRouteIdsKey = canUseRouteName ? "" : routeIdsKey;

    const store = useMemo(() => {
        if (!enabled) return null;
        if (canUseRouteName) {
            return getBusLocationStoreByRouteName(normalizedRouteName, cityCode);
        }
        return fallbackRouteIdsKey ? getBusLocationStore(fallbackRouteIdsKey, cityCode) : null;
    }, [enabled, canUseRouteName, normalizedRouteName, cityCode, fallbackRouteIdsKey]);

    useEffect(() => {
        if (canUseRouteName && store && normalizedRouteIds.length > 0) {
            store.updateFallbackRouteIds(normalizedRouteIds);
        }
    }, [canUseRouteName, store, normalizedRouteIds]);

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
