import {createApiHandler} from "@shared/api";
import {getRouteDetails, getRouteMapData} from "@entities/route/api";
import {getStationMap} from "@entities/station/api";
import type {BusStop} from "@entities/station/types";
import {buildCacheControl} from "@shared/cache/cachePolicy";

// Edge CDN ISR Cache: Revalidate every 24 hours (86400 seconds)
export const revalidate = 86400;

async function getRouteStopsByRouteName(routeName: string): Promise<BusStop[]> {
    const routeMapData = await getRouteMapData();
    const routeIds = routeMapData.route_numbers[routeName] ?? [];
    if (routeIds.length === 0) return [];

    const stationMap = await getStationMap();
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
                ...station,
                nodeid: stop.nodeid,
                nodeord: stop.nodeord,
                updowncd: stop.updowncd,
            });
        });
    });

    return Array.from(stopMap.values());
}

const CACHE_CONTROL = buildCacheControl({
    ttlSeconds: 3600,
    maxAgeSeconds: 300,
    sMaxAgeSeconds: 86400,
    staleWhileRevalidateSeconds: 86400,
    staleIfErrorSeconds: 86400,
});

export const GET = createApiHandler<BusStop[]>({
    paramKey: "routeName",
    cacheKey: (id) => `route-stops:${id}`,
    fetcher: getRouteStopsByRouteName,
    ttl: 3600,
    errorMessage: "Failed to fetch route stops",
    cacheControl: CACHE_CONTROL,
    loggerPrefix: "route-stops",
    validate: (id) => /^[a-zA-Z0-9_\uAC00-\uD7A3-]+$/.test(id) && id.length <= 30,
    cacheOptions: {
        staleWhileRevalidateSeconds: 86400,
        staleIfErrorSeconds: 86400,
    },
});
