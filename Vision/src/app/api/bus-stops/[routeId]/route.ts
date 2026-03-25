import {createApiHandler} from "@shared/api/createApiHandler";
import {fetchRouteStops, type RawBusStop} from "@shared/redis/publicApi";

// Bus stop locations rarely change — cache for 24 hours
export const GET = createApiHandler<RawBusStop[]>({
    paramKey: "routeId",
    cacheKey: (id) => `stops:${id}`,
    fetcher: fetchRouteStops,
    ttl: 86400,
    errorMessage: "Failed to fetch stop data",
    cacheControl: "public, s-maxage=3600, stale-while-revalidate=86400",
    loggerPrefix: "/bus-stops",
});
