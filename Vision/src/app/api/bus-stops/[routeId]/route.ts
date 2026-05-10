import {createApiHandler} from "@shared/api/createApiHandler";
import {fetchRouteStops, type RawBusStop} from "@shared/redis/publicApi";

export const dynamic = "force-dynamic";

export const GET = createApiHandler<RawBusStop[]>({
    paramKey: "routeId",
    cacheKey: (id) => `bus-stops:${id}`,
    fetcher: fetchRouteStops,
    ttl: 3600,
    errorMessage: "Failed to fetch stop data",
    cacheControl: "public, s-maxage=3600, stale-while-revalidate=86400",
    loggerPrefix: "/bus-stops",
});
