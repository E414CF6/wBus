import {createApiHandler} from "@shared/api/createApiHandler";
import {fetchBusArrivals, type RawBusArrival} from "@shared/redis/publicApi";

export const GET = createApiHandler<RawBusArrival[]>({
    paramKey: "busStopId",
    cacheKey: (id) => `arrival:${id}`,
    fetcher: fetchBusArrivals,
    ttl: 3,
    errorMessage: "Failed to fetch arrival data",
    cacheControl: "public, s-maxage=3, stale-while-revalidate=3",
    loggerPrefix: "/bus-arrival",
});
