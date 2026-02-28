import { fetchAPI } from "@core/api/fetchAPI";
import type { BusItem } from "@entities/bus/types";
import type { BusStopArrival } from "@entities/station/types";

export async function getBusLocationData(routeId: string): Promise<BusItem[]> {
    const data = await fetchAPI<{
        response?: { body?: { items?: { item?: BusItem | BusItem[] } } };
    }>(`/getBusLocation/${routeId}`);
    const rawItem = data.response?.body?.items?.item;
    if (!rawItem) {
        return [];
    }
    return Array.isArray(rawItem) ? rawItem : [rawItem];
}

export async function getBusStopArrivalData(busStopId: string): Promise<BusStopArrival[]> {
    const data = await fetchAPI<{
        response?: { body?: { items?: { item?: BusStopArrival | BusStopArrival[] } } };
    }>(`/getBusArrivalInfo/${busStopId}`);
    const rawItem = data.response?.body?.items?.item;
    if (!rawItem) {
        return [];
    }
    return Array.isArray(rawItem) ? rawItem : [rawItem];
}
