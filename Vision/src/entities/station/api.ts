import { fetchAPI } from "@core/api/fetchAPI";
import { CacheManager } from "@core/cache/CacheManager";
import { API_CONFIG } from "@core/constants/env";
import { getRouteDetails, getRouteMapData } from "@entities/route/api";
import type { BusStop, StationLocation, StationMapData } from "@entities/station/types";

// Cache

const stationMapCache = new CacheManager<StationMapData>();

// URL Builder

function getStationMapUrl(): string {
    if (API_CONFIG.STATIC.USE_REMOTE && API_CONFIG.STATIC.BASE_URL) {
        return `${API_CONFIG.STATIC.BASE_URL}/${API_CONFIG.STATIC.PATHS.STATION_MAP}`;
    }
    return "/data/stationMap.json";
}

// Internal API

async function getStationMapData(): Promise<StationMapData> {
    return stationMapCache.getOrFetch("stationMap", async () => {
        return fetchAPI<StationMapData>(getStationMapUrl(), {baseUrl: ""});
    });
}

// Public API

export async function getBusStopLocationData(): Promise<BusStop[]> {
    const data = await getStationMapData();
    return Object.entries(data.stations).map(([nodeid, station]) => ({
        ...station, nodeid,
    }));
}

export async function getStationMap(): Promise<Record<string, StationLocation>> {
    const data = await getStationMapData();
    return data.stations;
}

export async function getRouteStopsByRouteName(routeName: string): Promise<BusStop[]> {
    const routeMapData = await getRouteMapData();
    const routeIds = routeMapData.route_numbers[routeName] ?? [];
    if (routeIds.length === 0) return [];

    const stationMapData = await getStationMapData();
    const stationMap = stationMapData.stations;
    const stopMap = new Map<string, BusStop>();

    const routeDetailsList = await Promise.all(
        routeIds.map((routeId) => getRouteDetails(routeId))
    );

    routeDetailsList.forEach((detail) => {
        if (!detail?.sequence) return;
        detail.sequence.forEach((stop) => {
            const station = stationMap[stop.nodeid];
            if (!station) return;
            const key = `${stop.nodeid}-${stop.updowncd ?? ""}`;
            if (stopMap.has(key)) return;
            stopMap.set(key, {
                ...station, nodeid: stop.nodeid,
                nodeord: stop.nodeord, updowncd: stop.updowncd,
            });
        });
    });

    return Array.from(stopMap.values());
}
