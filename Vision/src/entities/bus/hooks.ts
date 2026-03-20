import {getRouteMap} from "@entities/route/api";
import {APP_CONFIG} from "@shared/config/env";
import useSWR from "swr";

/**
 * Get (routeName) -> routeIds[] mapping for bus routes.
 * Example: { "30": ["30100123", "30100124"] }
 *
 * Uses SWR for caching and revalidation.
 */
export function useBusRouteMap(): Record<string, string[]> | null {
    const {data, error} = useSWR(
        "busRouteMap", // specific key for this resource
        getRouteMap,
        {
            revalidateOnFocus: false, // Static data rarely changes
            revalidateOnReconnect: false,
            dedupingInterval: 60000, // Dedup for 1 minute
            errorRetryCount: 3,
        }
    );

    if (error && APP_CONFIG.IS_DEV) {
        console.error("[useBusRouteMap] Error fetching route map", error);
    }

    return data ?? null;
}
