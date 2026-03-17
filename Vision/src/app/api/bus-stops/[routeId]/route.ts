import { createApiHandler } from "@shared/api/createApiHandler";
import { fetchRouteStops, type RawBusStop } from "@shared/redis/publicApi";

// Bus stop locations rarely change — cache for 10 minutes
export const GET = createApiHandler<RawBusStop[]>({
    paramKey: "routeId",
    cacheKey: (id) => `stops:${id}`,
    fetcher: fetchRouteStops,
    ttl: 600,
    errorMessage: "Failed to fetch stop data",
    loggerPrefix: "/bus-stops",
});
