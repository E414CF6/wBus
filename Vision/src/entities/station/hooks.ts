import type {BusStop, BusStopArrival} from "@entities/station/types";
import {API_CONFIG} from "@shared/config/env";
import {useAppMapContext} from "@shared/context/AppMapContext";
import type {CachedData} from "@shared/redis/types";
import {getHaversineDistance} from "@shared/utils/geo";
import {useEffect, useMemo, useState} from "react";
import useSWR from "swr";

// Fetcher for the new API
const apiFetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch stops");
    const data = await res.json();
    return data.data; // Redis cached response wrapper has .data
};

// useBusStop
export function useBusStop(routeName: string) {
    const {data: stops} = useSWR(
        routeName ? `/api/route-stops/${routeName}` : null,
        apiFetcher,
        {
            revalidateOnFocus: false, // Stops are static
            dedupingInterval: 60000,
            fallbackData: [],
        }
    );

    return stops ?? [];
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
            const closest = stops.reduce((best: BusStop, current: BusStop) => {
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
