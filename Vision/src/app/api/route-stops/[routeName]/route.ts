import {getRouteStopsByRouteName} from "@entities/station/api";
import type {BusStop} from "@entities/station/types";
import {createApiHandler} from "@shared/api/createApiHandler";

export const dynamic = "force-dynamic";

export const GET = createApiHandler<BusStop[]>({
    paramKey: "routeName",
    cacheKey: (id) => `route-stops:${id}`,
    fetcher: getRouteStopsByRouteName,
    ttl: 3600,
    errorMessage: "Failed to fetch route stops",
    cacheControl: "public, s-maxage=3600, stale-while-revalidate=86400",
    loggerPrefix: "/route-stops",
});
