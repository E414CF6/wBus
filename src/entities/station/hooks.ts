import {useMemo} from "react";
import useSWR from "swr";

import {getCachedPolylineSync, getCachedRouteInfoSync} from "@entities/route/api";
import type {BusStop, BusStopArrival} from "@entities/station/types";
import type {CachedData} from "@shared/cache";
import {CacheManager} from "@shared/cache/CacheManager";
import {STORAGE_KEYS} from "@shared/config/env";

import {UI_TEXT} from "@shared/config/locale";

const routeStopsCache = new CacheManager<BusStop[]>({
    maxSize: 150,
    ttlMs: 24 * 60 * 60 * 1000,
    storagePrefix: STORAGE_KEYS.ROUTE_STOPS_PREFIX,
    maxStorageEntries: 80,
});

function deriveStopsFromCachedPolylines(routeName: string, cityCode: string): BusStop[] | null {
    const routeInfo = getCachedRouteInfoSync(routeName, cityCode);
    if (!routeInfo || !routeInfo.vehicleRouteIds?.length) return null;

    const allStops: BusStop[] = [];
    for (const rId of routeInfo.vehicleRouteIds) {
        const poly = getCachedPolylineSync(rId, cityCode);
        if (poly && Array.isArray(poly.stops) && poly.stops.length > 0) {
            for (const s of poly.stops) {
                allStops.push({
                    nodeid: s.id,
                    nodenm: s.name,
                    nodeno: s.nodeno ?? 0,
                    nodeord: s.ord,
                    gpslati: s.lat ?? 0,
                    gpslong: s.lon ?? 0,
                    updowncd: s.ud,
                });
            }
        }
    }

    if (allStops.length === 0) return null;
    allStops.sort((a, b) => Number(a.nodeord || 0) - Number(b.nodeord || 0));
    return allStops;
}

// Fetcher for the new API
const fetchRouteStops = async (routeName: string, cityCode: string): Promise<BusStop[]> => {
    const cacheKey = `${cityCode}:${routeName}`;
    return routeStopsCache.getOrFetch(cacheKey, async () => {
        const url =
            cityCode === "32020"
                ? `/api/route-stops/${encodeURIComponent(routeName)}`
                : `/api/route-stops/${encodeURIComponent(routeName)}?cityCode=${cityCode}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch stops");
        const data = await res.json();
        return (data.data ?? []) as BusStop[];
    });
};

// useBusStop (stops for a specific route)
export function useBusStop(routeName: string, cityCode = "32020"): BusStop[] {
    const swrKey = routeName ? `route-stops:${cityCode}:${routeName}` : null;
    const syncCached = useMemo(() => {
        if (!routeName) return [];
        const cached = routeStopsCache.get(`${cityCode}:${routeName}`);
        if (cached && cached.length > 0) return cached;
        return deriveStopsFromCachedPolylines(routeName, cityCode) ?? [];
    }, [routeName, cityCode]);

    const {data: stops} = useSWR<BusStop[]>(
        swrKey,
        () => fetchRouteStops(routeName, cityCode),
        {
            revalidateOnFocus: false, // Stops are static
            dedupingInterval: 300000,
            fallbackData: syncCached,
        }
    );

    return stops ?? syncCached;
}

// useBusArrivalInfo
const arrivalFetcher = async (url: string): Promise<CachedData<BusStopArrival[]>> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};

const EMPTY_ARRIVAL_LIST: BusStopArrival[] = [];

export function useBusArrivalInfo(busStopId: string | null, cityCode: string = "32020") {
    const trimmedId = busStopId?.trim() ?? "";
    const swrUrl = trimmedId
        ? `/api/bus-arrival/${encodeURIComponent(trimmedId)}?cityCode=${encodeURIComponent(cityCode)}`
        : null;

    const {
        data, error, isLoading, isValidating, mutate
    } = useSWR<CachedData<BusStopArrival[]>>(swrUrl, arrivalFetcher, {
        refreshInterval: 10000, revalidateOnFocus: true, dedupingInterval: 4000,
    });

    return useMemo(() => ({
        data: data?.data ?? EMPTY_ARRIVAL_LIST,
        loading: isLoading,
        isValidating,
        error: error ? UI_TEXT.ERROR.NO_ARRIVAL_INFO : null,
        isDegraded: Boolean(data?.meta?.degraded || error),
        lastUpdated: data?.timestamp ?? null,
        ageMs: data?.meta?.ageMs ?? 0,
        refresh: () => void mutate(),
    }), [data, isLoading, isValidating, error, mutate]);
}
