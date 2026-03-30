import {createStaticApiHandler} from "@shared/api/createApiHandler";
import {fetchRouteStops, type RawBusStop} from "@shared/redis/publicApi";

// Bus stop locations rarely change — rely on CDN caching only (no Redis)
export const GET = createStaticApiHandler<RawBusStop[]>({
    paramKey: "routeId",
    fetcher: fetchRouteStops,
    errorMessage: "Failed to fetch stop data",
    cacheControl: "public, s-maxage=3600, stale-while-revalidate=86400",
    loggerPrefix: "/bus-stops",
});
