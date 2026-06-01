import {createApiHandler} from "@shared/api/createApiHandler";
import {buildCacheControl} from "@shared/cache/cachePolicy";
import {fetchRouteStops, type RawBusStop} from "@shared/redis/publicApi";

export const dynamic = "force-dynamic";

const STATIC_CACHE_OPTIONS = {
    staleWhileRevalidateSeconds: 86400, staleIfErrorSeconds: 86400,
};

export const GET = createApiHandler<RawBusStop[]>({
    paramKey: "routeId",
    cacheKey: (id) => `bus-stops:${id}`,
    fetcher: fetchRouteStops,
    ttl: 3600,
    cacheOptions: STATIC_CACHE_OPTIONS,
    errorMessage: "Failed to fetch stop data",
    cacheControl: buildCacheControl({
        ttlSeconds: 3600, ...STATIC_CACHE_OPTIONS,
    }),
    loggerPrefix: "/bus-stops",
});
