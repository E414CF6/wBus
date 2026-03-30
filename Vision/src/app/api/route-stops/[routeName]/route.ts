import {getRouteStopsByRouteName} from "@entities/station/api";
import type {BusStop} from "@entities/station/types";
import {createStaticApiHandler} from "@shared/api/createApiHandler";

// Route stops change very rarely — rely on CDN caching only (no Redis)
export const GET = createStaticApiHandler<BusStop[]>({
    paramKey: "routeName",
    fetcher: getRouteStopsByRouteName,
    errorMessage: "Failed to fetch route stops",
    cacheControl: "public, s-maxage=3600, stale-while-revalidate=86400",
    loggerPrefix: "/route-stops",
});
