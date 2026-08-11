import type {BusStop, StationLocation, StationMapData} from "@entities/station/types";
import {CacheManager} from "@shared/cache/CacheManager";
import {API_CONFIG} from "@shared/config/env";
import {loadStaticData} from "@shared/utils/dataLoader";

// Cache

const stationMapCache = new CacheManager<StationMapData>();

// Internal API

async function getStationMapData(): Promise<StationMapData> {
    return stationMapCache.getOrFetch("stationMap", async () => {
        return loadStaticData<StationMapData>(API_CONFIG.STATIC.PATHS.STATION_MAP);
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
