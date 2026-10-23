import {ApiValidators, createApiHandler} from "@shared/api";
import {fetchBusLocations, getAdaptiveTtlSeconds, type RawBusLocation} from "@entities/bus";

// Always treat this route as dynamic to avoid prepended 404s on deploy
export const dynamic = "force-dynamic";

/**
 * GET /api/bus/[routeId]
 * Fetch real-time bus locations for a specific route ID.
 */
const LIVE_CACHE_OPTIONS = {
    staleWhileRevalidateSeconds: 5, staleIfErrorSeconds: 60,
};

export const GET = createApiHandler<RawBusLocation[]>({
    paramKey: "routeId",
    cacheKey: (id, req) => {
        const cityCode = ApiValidators.resolveCityCode(req ? new URL(req.url).searchParams.get("cityCode") : null);
        return `bus:${cityCode}:${id}`;
    },
    fetcher: (id, req) => {
        const cityCode = ApiValidators.resolveCityCode(req ? new URL(req.url).searchParams.get("cityCode") : null);
        return fetchBusLocations(id, {cityCode});
    },
    ttl: (id, req) => {
        const cityCode = ApiValidators.resolveCityCode(req ? new URL(req.url).searchParams.get("cityCode") : null);
        return getAdaptiveTtlSeconds(id, 8, 15, cityCode);
    },
    cacheOptions: LIVE_CACHE_OPTIONS,
    errorMessage: "Failed to fetch bus data",
    cacheControl: "public, max-age=2, s-maxage=10, stale-while-revalidate=5, stale-if-error=60",
    loggerPrefix: "/bus",
    validate: ApiValidators.isValidRouteId,
});
