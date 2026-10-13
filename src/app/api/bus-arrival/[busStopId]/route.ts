import {ApiValidators, createApiHandler} from "@shared/api";
import {fetchBusArrivals, type RawBusArrival} from "@entities/bus";

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
    validate: ApiValidators.isValidStopId,
});
