import { getBusStopLocationData, getRouteStopsByRouteName } from "@entities/station/api";
import type { BusStop, BusStopArrival } from "@entities/station/types";
import { CacheManager } from "@shared/cache/CacheManager";
import { API_CONFIG, APP_CONFIG } from "@shared/config/env";
import { useAppMapContext } from "@shared/context/AppMapContext";
import type { CachedData } from "@shared/redis/types";
import { getHaversineDistance } from "@shared/utils/geo";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

const MIN_VALID_STOPS = 4;

// Stop Cache

const stopCache = new CacheManager<BusStop[]>();
const routeStopsCache = new CacheManager<BusStop[]>();

function getSortValue(stop: BusStop, fallback: number): number {
    const nodeord = Number(stop.nodeord);
    if (Number.isFinite(nodeord)) return nodeord;

    const nodeno = Number(stop.nodeno);
    if (Number.isFinite(nodeno)) return nodeno;

    return fallback;
}

function sortStops(list: BusStop[]): BusStop[] {
    return list.map((stop, index) => ({stop, index}))
        .sort((a, b) => getSortValue(a.stop, a.index) - getSortValue(b.stop, b.index))
        .map(({stop}) => stop);
}

// useBusStop

export function useBusStop(routeName: string) {
    const [stops, setStops] = useState<BusStop[]>(() => routeStopsCache.get(routeName) ?? []);

    useEffect(() => {
        if (!routeName) return;
        let isMounted = true;
        const fetchStops = async () => {
            try {
                const cached = routeStopsCache.get(routeName);
                if (cached) {
                    if (isMounted) setStops(cached);
                    return;
                }
                const allStopsPromise = stopCache.getOrFetch("Stations", async () => {
                    const data = await getBusStopLocationData();
                    return sortStops(data);
                });
                const routeStopsPromise = getRouteStopsByRouteName(routeName).then(sortStops);
                const [allStops, routeStops] = await Promise.all([allStopsPromise, routeStopsPromise]);
                const isValid = routeStops.length >= MIN_VALID_STOPS;
                const finalStops = isValid ? routeStops : allStops;
                routeStopsCache.set(routeName, finalStops);
                if (APP_CONFIG.IS_DEV) {
                    console.debug(`[useBusStop] Route="${routeName}": matched=${routeStops.length}, fallback=${!isValid}`);
                }
                if (isMounted) setStops(finalStops);
            } catch (err) {
                if (APP_CONFIG.IS_DEV) console.error(`[useBusStop] Failed to load stops for ${routeName}`, err);
            }
        };

        fetchStops().then(r => void r);

        return () => {
            isMounted = false;
        };
    }, [routeName]);

    return stops;
}

// useClosestStopOrd

export function useClosestStopOrd(routeName: string): number | null {
    const {map} = useAppMapContext();
    const stops = useBusStop(routeName);
    const [closestOrd, setClosestOrd] = useState<number | null>(null);

    useEffect(() => {
        if (!map || stops.length === 0) return;

        const calculateClosest = () => {
            if (!map.getCenter) return;
            const {lat, lng} = map.getCenter();
            const closest = stops.reduce((best, current) => {
                const bestDist = getHaversineDistance(lat, lng, best.gpslati, best.gpslong);
                const currDist = getHaversineDistance(lat, lng, current.gpslati, current.gpslong);
                return currDist < bestDist ? current : best;
            }, stops[0]);
            const ord = Number(closest.nodeord);
            setClosestOrd(Number.isFinite(ord) ? ord : null);
        };

        calculateClosest();
        map.on("moveend", calculateClosest);

        return () => {
            map.off("moveend", calculateClosest);
        };
    }, [map, stops]);

    return closestOrd;
}

// useBusArrivalInfo

const arrivalFetcher = async (url: string): Promise<CachedData<BusStopArrival[]>> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};

const EMPTY_ARRIVAL_LIST: BusStopArrival[] = [];

export function useBusArrivalInfo(busStopId: string | null) {
    const {data, error, isLoading} = useSWR<CachedData<BusStopArrival[]>>(
        busStopId && busStopId.trim() !== "" ? `/api/bus-arrival/${busStopId}` : null,
        arrivalFetcher,
        {
            refreshInterval: API_CONFIG.LIVE.POLLING_INTERVAL_MS,
            revalidateOnFocus: true,
            dedupingInterval: 2000,
        }
    );

    return useMemo(() => ({
        data: data?.data ?? EMPTY_ARRIVAL_LIST,
        loading: isLoading,
        error: error ? "도착 정보를 불러올 수 없습니다." : null,
    }), [data, isLoading, error]);
}

