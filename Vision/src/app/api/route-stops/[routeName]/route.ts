import { getRouteStopsByRouteName } from "@entities/station/api";
import type { BusStop } from "@entities/station/types";
import { createApiHandler } from "@shared/api/createApiHandler";

// Cache stops for 24 hours as they change very rarely
export const GET = createApiHandler<BusStop[]>({
    paramKey: "routeName",
    cacheKey: (id) => `routeStops:${id}`,
    // This function now uses dataLoader which works on server (reading FS)
    fetcher: getRouteStopsByRouteName,
    ttl: 86400,
    errorMessage: "Failed to fetch route stops",
    cacheControl: "public, s-maxage=3600, stale-while-revalidate=86400",
    loggerPrefix: "/route-stops",
});
