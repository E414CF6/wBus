import {getRouteDetails, getRouteMapData} from "@entities/route/api";
import {getStationMap} from "@entities/station/api";
import type {BusStop} from "@entities/station/types";
import {createApiHandler} from "@shared/api/createApiHandler";
import {buildCacheControl} from "@shared/cache/cachePolicy";

export const dynamic = "force-dynamic";

const STATIC_CACHE_OPTIONS = {
    staleWhileRevalidateSeconds: 86400, staleIfErrorSeconds: 86400,
};

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
                ...station, nodeid: stop.nodeid,
                nodeord: stop.nodeord, updowncd: stop.updowncd,
            });
        });
    });

    return Array.from(stopMap.values());
}

export const GET = createApiHandler<BusStop[]>({
    paramKey: "routeName",
    cacheKey: (id) => `route-stops:${id}`,
    fetcher: getRouteStopsByRouteName,
    ttl: 3600,
    cacheOptions: STATIC_CACHE_OPTIONS,
    errorMessage: "Failed to fetch route stops",
    cacheControl: buildCacheControl({
        ttlSeconds: 3600, ...STATIC_CACHE_OPTIONS,
    }),
    loggerPrefix: "/route-stops",
    validate: (id) => /^[a-zA-Z0-9_\uAC00-\uD7A3-]+$/.test(id) && id.length <= 30,
});
