import {ApiValidators, createApiHandler} from "@shared/api";
import type {BusStop} from "@entities/station/types";
import type {GeoPolyline} from "@entities/route/types";
import {buildCacheControl} from "@shared/cache/cachePolicy";
import {getCachedOrFetch, peekCached} from "@shared/cache";
import {mapWithConcurrencyLimit} from "@shared/utils/concurrency";
import {fetchRouteStops, getCachedCityRoutes} from "@entities/bus";

// Edge CDN ISR Cache: Revalidate every 24 hours (86400 seconds)
export const revalidate = 86400;

async function getRouteStopsForCity(routeName: string, cityCode: string): Promise<BusStop[]> {
    try {
        const routesResult = await getCachedCityRoutes(cityCode, routeName);
        const rawRoutes = routesResult.data || [];
        const matched = rawRoutes.filter((r) => String(r.routeno) === routeName);
        const routeIds = (matched.length > 0 ? matched : rawRoutes).map((r) => r.routeid);
        if (routeIds.length === 0) return [];

        const stopMap = new Map<string, BusStop>();

        const settled = await mapWithConcurrencyLimit(
            routeIds,
            async (rId) => {
                // 1. Check if polyline is already cached in L1 memory (contains stops)
                const cachedPoly = peekCached<GeoPolyline>(`polyline:${cityCode}:${rId}`, 86400);
                if (cachedPoly?.data?.stops?.length) {
                    return cachedPoly.data.stops.map((s) => ({
                        nodeid: s.id,
                        nodenm: s.name,
                        nodeno: String(s.nodeno ?? ""),
                        gpslati: Number(s.lat ?? 0),
                        gpslong: Number(s.lon ?? 0),
                        nodeord: Number(s.ord ?? 0),
                        updowncd: Number(s.ud ?? 0),
                    }));
                }

                // 2. Otherwise use shared bus-stops L1 cache
                const cachedStops = await getCachedOrFetch(
                    `bus-stops:${cityCode}:${rId}`,
                    () => fetchRouteStops(rId, cityCode),
                    {
                        ttlSeconds: 3600,
                        staleWhileRevalidateSeconds: 86400,
                        staleIfErrorSeconds: 86400,
                    }
                );
                return cachedStops.data || [];
            },
            {concurrency: 4, staggerMs: 15}
        );

        for (const res of settled) {
            if (res.status === "fulfilled" && Array.isArray(res.value)) {
                for (const s of res.value) {
                    const key = `${s.nodeid}-${s.updowncd ?? ""}`;
                    if (!stopMap.has(key)) {
                        stopMap.set(key, {
                            nodeid: s.nodeid,
                            nodenm: s.nodenm,
                            nodeno: String(s.nodeno ?? ""),
                            gpslati: Number(s.gpslati),
                            gpslong: Number(s.gpslong),
                            nodeord: Number(s.nodeord ?? 0),
                            updowncd: Number(s.updowncd ?? 0),
                        });
                    }
                }
            }
        }

        return Array.from(stopMap.values());
    } catch (e) {
        console.error(`[getRouteStopsForCity] Failed to fetch stops for city ${cityCode}:`, e);
        return [];
    }
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
    cacheKey: (id, req) => {
        const cityCode = req ? new URL(req.url).searchParams.get("cityCode") || "32020" : "32020";
        return `route-stops:${cityCode}:${id}`;
    },
    fetcher: async (routeName, req) => {
        const cityCode = req ? new URL(req.url).searchParams.get("cityCode") || "32020" : "32020";
        return await getRouteStopsForCity(routeName, cityCode);
    },
    ttl: 3600,
    errorMessage: "Failed to fetch route stops",
    cacheControl: CACHE_CONTROL,
    loggerPrefix: "route-stops",
    validate: ApiValidators.isValidRouteName,
    cacheOptions: {
        staleWhileRevalidateSeconds: 86400,
        staleIfErrorSeconds: 86400,
    },
});
