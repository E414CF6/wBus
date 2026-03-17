import type { BusDataError, BusItem } from "@entities/bus/types";
import { API_CONFIG } from "@shared/config/env";
import type { CachedData } from "@shared/redis/types";
import { useMemo } from "react";
import useSWR from "swr";

const fetchRouteData = async (url: string): Promise<CachedData<BusItem[]>> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};

const EMPTY_BUS_LIST: BusItem[] = [];

/**
 * Fetch bus location data for a single routeId.
 */
export function useBusLocationByRouteId(routeId: string | null): {
    data: BusItem[];
    error: BusDataError;
    hasFetched: boolean;
} {
    const {data, error, isLoading} = useSWR<CachedData<BusItem[]>>(
        routeId ? `/api/bus/${routeId}` : null,
        fetchRouteData,
        {
            refreshInterval: API_CONFIG.LIVE.POLLING_INTERVAL_MS,
            revalidateOnFocus: true,
            dedupingInterval: 2000,
        }
    );

    if (error) {
        return {data: EMPTY_BUS_LIST, error: "ERR:NETWORK", hasFetched: true};
    }

    if (!data || isLoading) {
        return {data: EMPTY_BUS_LIST, error: null, hasFetched: false};
    }

    const buses = data.data;
    if (buses.length === 0) {
        return {data: EMPTY_BUS_LIST, error: "ERR:NONE_RUNNING", hasFetched: true};
    }

    return {data: buses, error: null, hasFetched: true};
}

/**
 * Fetch bus locations for multiple routeIds and merge results.
 * Uses only /api/bus/[routeId] scheme.
 */
export function useBusLocationData(routeIds: string[]): {
    data: BusItem[];
    error: BusDataError;
    hasFetched: boolean;
} {
    const normalizedRouteIds = useMemo(
        () => Array.from(new Set(routeIds.filter((id) => id.trim() !== ""))).sort(),
        [routeIds]
    );
    const key = normalizedRouteIds.length > 0 ? `bus:${normalizedRouteIds.join(",")}` : null;

    const {data, error, isLoading} = useSWR<BusItem[]>(
        key,
        async () => {
            const results = await Promise.all(
                normalizedRouteIds.map((routeId) => fetchRouteData(`/api/bus/${routeId}`))
            );
            return results.flatMap((entry) => entry.data);
        },
        {
            refreshInterval: API_CONFIG.LIVE.POLLING_INTERVAL_MS,
            revalidateOnFocus: true,
            dedupingInterval: 2000,
        }
    );

    if (error) {
        return {data: EMPTY_BUS_LIST, error: "ERR:NETWORK", hasFetched: true};
    }

    if (!data || isLoading) {
        return {data: EMPTY_BUS_LIST, error: null, hasFetched: false};
    }

    if (data.length === 0) {
        return {data: EMPTY_BUS_LIST, error: "ERR:NONE_RUNNING", hasFetched: true};
    }

    return {data, error: null, hasFetched: true};
}
