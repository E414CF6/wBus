import type { BusDataError, BusItem } from "@entities/bus/types";
import { API_CONFIG } from "@shared/config/env";
import type { CachedData } from "@shared/redis/types";
import useSWR from "swr";

const fetcher = async (url: string): Promise<CachedData<BusItem[]>> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};

/**
 * React hook to fetch bus location data via SWR.
 * All users share the same Redis-cached data on the server.
 */
export function useBusLocationData(routeName: string): {
    data: BusItem[];
    error: BusDataError;
    hasFetched: boolean;
} {
    const {data, error, isLoading} = useSWR<CachedData<BusItem[]>>(
        routeName ? `/api/bus/${routeName}` : null,
        fetcher,
        {
            refreshInterval: API_CONFIG.LIVE.POLLING_INTERVAL_MS,
            revalidateOnFocus: true,
            dedupingInterval: 2000,
        }
    );

    if (error) {
        return {data: [], error: "ERR:NETWORK", hasFetched: true};
    }

    if (!data || isLoading) {
        return {data: [], error: null, hasFetched: false};
    }

    const buses = data.data;
    if (buses.length === 0) {
        return {data: [], error: "ERR:NONE_RUNNING", hasFetched: true};
    }

    return {data: buses, error: null, hasFetched: true};
}
