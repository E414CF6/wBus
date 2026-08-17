import {useMemo} from "react";
import useSWR from "swr";

import type {BusStopArrival} from "@entities/station/types";
import type {CachedData} from "@shared/redis/types";

// Fetcher for the new API
const apiFetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch stops");
    const data = await res.json();
    return data.data; // Redis cached response wrapper has .data
};

// useBusStop
export function useBusStop(routeName: string) {
    const {data: stops} = useSWR(routeName ? `/api/route-stops/${routeName}` : null, apiFetcher, {
        revalidateOnFocus: false, // Stops are static
        dedupingInterval: 60000, fallbackData: [],
    });

    return stops ?? [];
}

// useBusArrivalInfo
const arrivalFetcher = async (url: string): Promise<CachedData<BusStopArrival[]>> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};

const EMPTY_ARRIVAL_LIST: BusStopArrival[] = [];

export function useBusArrivalInfo(busStopId: string | null) {
    const {
        data, error, isLoading, mutate
    } = useSWR<CachedData<BusStopArrival[]>>(busStopId && busStopId.trim() !== "" ? `/api/bus-arrival/${busStopId}` : null, arrivalFetcher, {
        refreshInterval: 10000, revalidateOnFocus: true, dedupingInterval: 4000,
    });

    return useMemo(() => ({
        data: data?.data ?? EMPTY_ARRIVAL_LIST,
        loading: isLoading,
        error: error ? "도착 정보를 불러올 수 없습니다." : null,
        isDegraded: Boolean(data?.meta?.degraded || error),
        lastUpdated: data?.timestamp ?? null,
        ageMs: data?.meta?.ageMs ?? 0,
        refresh: () => void mutate(),
    }), [data, isLoading, error, mutate]);
}
