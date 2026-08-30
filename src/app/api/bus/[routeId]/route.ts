import {createApiHandler} from "@shared/api/createApiHandler";
import {fetchBusLocations, getAdaptiveTtlSeconds, type RawBusLocation} from "@shared/redis/publicApi";

// Always treat this route as dynamic to avoid prepended 404s on deploy
export const dynamic = "force-dynamic";

/**
 * GET /api/bus/[routeId]
 * Fetch real-time bus locations for a specific route ID.
 */
const LIVE_CACHE_OPTIONS = {
    staleWhileRevalidateSeconds: 3, staleIfErrorSeconds: 120,
};

export const GET = createApiHandler<RawBusLocation[]>({
    paramKey: "routeId",
    cacheKey: (id) => `bus:${id}`,
    fetcher: fetchBusLocations,
    ttl: (id) => getAdaptiveTtlSeconds(id, 4, 20),
    cacheOptions: LIVE_CACHE_OPTIONS,
    errorMessage: "Failed to fetch bus data",
    cacheControl: "no-store, no-cache, must-revalidate",
    loggerPrefix: "/bus",
    validate: (id) => /^[a-zA-Z0-9_-]+$/.test(id) && id.length <= 50,
});
