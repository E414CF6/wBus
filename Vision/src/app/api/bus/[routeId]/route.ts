import {createApiHandler} from "@shared/api/createApiHandler";
import {fetchBusLocations, type RawBusLocation} from "@shared/redis/publicApi";

// Always treat this route as dynamic to avoid prerendered 404s on deploy
export const dynamic = "force-dynamic";

/**
 * GET /api/bus/[routeId]
 * Fetch real-time bus locations for a specific route ID.
 */
export const GET = createApiHandler<RawBusLocation[]>({
    paramKey: "routeId",
    cacheKey: (id) => `bus:${id}`,
    fetcher: fetchBusLocations,
    ttl: 3,
    errorMessage: "Failed to fetch bus data",
    cacheControl: "public, s-maxage=3, stale-while-revalidate=3",
    loggerPrefix: "/bus",
});
