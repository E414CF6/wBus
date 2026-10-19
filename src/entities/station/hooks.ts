import {useCallback, useEffect, useMemo, useState} from "react";
import useSWR from "swr";

import {getCachedPolylineSync, getCachedRouteInfoSync} from "@entities/route/api";
import type {BusStop, BusStopArrival, FavoriteStop, NearbyStop} from "@entities/station/types";
import type {CachedData} from "@shared/cache";
import {CacheManager} from "@shared/cache/CacheManager";
import {getFavoriteStopsStorageKey, STORAGE_KEYS} from "@shared/config/env";

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

// useNearbyStops (spatial proximity stops near map viewport center)
const nearbyStopsFetcher = async (url: string): Promise<NearbyStop[]> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return (json?.data ?? []) as NearbyStop[];
};

const EMPTY_NEARBY_STOPS: NearbyStop[] = [];

export function useNearbyStops(lat: number | null, lng: number | null, enabled: boolean = true, limit: number = 30) {
    // Round to ~100m grid to maximize cache hit rate and prevent excessive fetches while panning slightly
    const roundedLat = lat !== null ? Number(lat.toFixed(3)) : null;
    const roundedLng = lng !== null ? Number(lng.toFixed(3)) : null;

    const swrUrl =
        enabled && roundedLat !== null && roundedLng !== null
            ? `/api/stops/nearby?lat=${roundedLat}&lng=${roundedLng}&limit=${limit}`
            : null;

    const {data, isLoading, error} = useSWR<NearbyStop[]>(swrUrl, nearbyStopsFetcher, {
        revalidateOnFocus: false,
        revalidateIfStale: false,
        dedupingInterval: 60000,
        keepPreviousData: true,
    });

    return {
        nearbyStops: data ?? EMPTY_NEARBY_STOPS,
        isLoading,
        error,
    };
}

// Custom event name for syncing favorite stops across components in the same tab
const FAVORITE_STOPS_SYNC_EVENT = "wbus:favorite-stops-updated";

export function useFavoriteStops(cityCode: string = "32020") {
    const storageKey = getFavoriteStopsStorageKey(cityCode);
    const [favoriteStops, setFavoriteStops] = useState<FavoriteStop[]>([]);

    const loadFavorites = useCallback(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setFavoriteStops(parsed);
                    return;
                }
            }
            setFavoriteStops([]);
        } catch {
            setFavoriteStops([]);
        }
    }, [storageKey]);

    useEffect(() => {
        const frameId = requestAnimationFrame(() => {
            loadFavorites();
        });
        const handleSync = () => loadFavorites();
        window.addEventListener(FAVORITE_STOPS_SYNC_EVENT, handleSync);
        window.addEventListener("storage", handleSync);
        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener(FAVORITE_STOPS_SYNC_EVENT, handleSync);
            window.removeEventListener("storage", handleSync);
        };
    }, [loadFavorites]);

    const isFavoriteStop = useCallback(
        (nodeid: string) => favoriteStops.some((s) => s.nodeid === nodeid),
        [favoriteStops]
    );

    const toggleFavoriteStop = useCallback(
        (stop: BusStop) => {
            if (typeof window === "undefined") return;
            let current: FavoriteStop[] = favoriteStops;
            try {
                const raw = localStorage.getItem(storageKey);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                        current = parsed;
                    }
                }
            } catch {
                // Fallback to current state
            }

            const exists = current.some((s) => s.nodeid === stop.nodeid);
            const next: FavoriteStop[] = exists
                ? current.filter((s) => s.nodeid !== stop.nodeid)
                : [
                      {
                          nodeid: stop.nodeid,
                          nodenm: stop.nodenm,
                          nodeno: stop.nodeno ?? "",
                          gpslati: stop.gpslati,
                          gpslong: stop.gpslong,
                          cityCode,
                      },
                      ...current,
                  ].slice(0, 20);

            setFavoriteStops(next);
            try {
                localStorage.setItem(storageKey, JSON.stringify(next));
                window.dispatchEvent(new CustomEvent(FAVORITE_STOPS_SYNC_EVENT));
            } catch {
                // Ignore storage error
            }
        },
        [cityCode, favoriteStops, storageKey]
    );

    return {
        favoriteStops,
        isFavoriteStop,
        toggleFavoriteStop,
    };
}

