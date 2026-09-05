import {createApiHandler} from "@shared/api/createApiHandler";
import {fetchBusArrivals, type RawBusArrival} from "@shared/redis/publicApi";

export const dynamic = "force-dynamic";

const LIVE_CACHE_OPTIONS = {
    staleWhileRevalidateSeconds: 5, staleIfErrorSeconds: 60,
};

export const GET = createApiHandler<RawBusArrival[]>({
    paramKey: "busStopId",
    cacheKey: (id) => `arrival:${id}`,
    fetcher: fetchBusArrivals,
    ttl: 3,
    cacheOptions: LIVE_CACHE_OPTIONS,
    errorMessage: "Failed to fetch arrival data",
    cacheControl: "public, max-age=1, s-maxage=3, stale-while-revalidate=5, stale-if-error=60",
    loggerPrefix: "/bus-arrival",
    validate: (id) => /^[a-zA-Z0-9_-]+$/.test(id) && id.length <= 50,
});
