import {createApiHandler} from "@shared/api/createApiHandler";
import {buildCacheControl} from "@shared/cache/cachePolicy";
import {fetchBusArrivals, type RawBusArrival} from "@shared/redis/publicApi";

export const dynamic = "force-dynamic";

const LIVE_CACHE_OPTIONS = {
    staleWhileRevalidateSeconds: 3, staleIfErrorSeconds: 10,
};

export const GET = createApiHandler<RawBusArrival[]>({
    paramKey: "busStopId",
    cacheKey: (id) => `arrival:${id}`,
    fetcher: fetchBusArrivals,
    ttl: 3,
    cacheOptions: LIVE_CACHE_OPTIONS,
    errorMessage: "Failed to fetch arrival data",
    cacheControl: buildCacheControl({
        ttlSeconds: 3, ...LIVE_CACHE_OPTIONS,
    }),
    loggerPrefix: "/bus-arrival",
});
