import type {BusStop, StationLocation} from "@entities/station/types";

// Public API

export async function getBusStopLocationData(): Promise<BusStop[]> {
    return [];
}

export async function getStationMap(): Promise<Record<string, StationLocation>> {
    return {};
}

