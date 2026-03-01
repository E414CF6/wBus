import { CacheManager } from "@core/cache/CacheManager";
import { API_CONFIG, APP_CONFIG } from "@core/constants/env";
import { UI_TEXT } from "@core/constants/locale";
import { getBusStopArrivalData } from "@entities/bus/api";
import { getBusStopLocationData, getRouteStopsByRouteName } from "@entities/station/api";
import type { BusStop, BusStopArrival } from "@entities/station/types";
import { useAppMapContext } from "@shared/context/AppMapContext";
import { getHaversineDistance } from "@shared/utils/geo";
import { useCallback, useEffect, useRef, useState } from "react";

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

        map.whenReady(calculateClosest);
        map.on("moveend", calculateClosest);

        return () => {
            map.off("moveend", calculateClosest);
        };
    }, [map, stops]);

    return closestOrd;
}

// useBusArrivalInfo

export function useBusArrivalInfo(busStopId: string | null) {
    const [data, setData] = useState<BusStopArrival[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const fetchData = useCallback(async () => {
        if (!busStopId || busStopId.trim() === "") {
            setData([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await getBusStopArrivalData(busStopId);
            setData(result);
        } catch (e) {
            if (APP_CONFIG.IS_DEV) console.error("[useBusArrivalInfo] Error fetching bus arrival data:", e);
            setError(UI_TEXT.ERROR.NO_ARRIVAL_INFO);
        } finally {
            setLoading(false);
        }
    }, [busStopId]);

    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (!busStopId || busStopId.trim() === "") {
            setData([]);
            return;
        }
        fetchData().then(r => void r);
        timerRef.current = setInterval(fetchData, API_CONFIG.LIVE.POLLING_INTERVAL_MS);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [busStopId, fetchData]);

    return {data, loading, error};
}

export function getNextBusArrivalInfo(routeName: string, data: BusStopArrival[]) {
    const target = data.find((bus) => bus.routeno.replace(/-/g, "").trim() === routeName.replace(/-/g, "").trim());
    if (!target) return null;

    return {minutes: Math.ceil(target.arrtime / 60), stopsAway: target.arrprevstationcnt};
}
