import {createApiHandler} from "@shared/api/createApiHandler";
import {buildCacheControl} from "@shared/cache/cachePolicy";
import {fetchBusLocations, type RawBusLocation} from "@shared/redis/publicApi";

// Always treat this route as dynamic to avoid prerendered 404s on deploy
export const dynamic = "force-dynamic";

/**
 * GET /api/bus/[routeId]
 * Fetch real-time bus locations for a specific route ID.
 */
const LIVE_CACHE_OPTIONS = {
    staleWhileRevalidateSeconds: 3, staleIfErrorSeconds: 10,
};

export const GET = createApiHandler<RawBusLocation[]>({
    paramKey: "routeId",
    cacheKey: (id) => `bus:${id}`,
    fetcher: fetchBusLocations,
    ttl: 3,
    cacheOptions: LIVE_CACHE_OPTIONS,
    errorMessage: "Failed to fetch bus data",
    cacheControl: buildCacheControl({
        ttlSeconds: 3, ...LIVE_CACHE_OPTIONS,
    }),
    loggerPrefix: "/bus",
});
