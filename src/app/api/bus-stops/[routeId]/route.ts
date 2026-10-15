import {ApiValidators, createApiHandler} from "@shared/api";
import {fetchRouteStops, type RawBusStop} from "@entities/bus";

import {buildCacheControl} from "@shared/cache/cachePolicy";

// Edge CDN ISR Cache: Revalidate every 24 hours (86400 seconds)
export const revalidate = 86400;

const CACHE_CONTROL = buildCacheControl({
    ttlSeconds: 3600,
    maxAgeSeconds: 300,
    sMaxAgeSeconds: 86400,
    staleWhileRevalidateSeconds: 86400,
    staleIfErrorSeconds: 86400,
});

export const GET = createApiHandler<RawBusStop[]>({
    paramKey: "routeId",
    cacheKey: (id, req) => {
        const cityCode = req ? new URL(req.url).searchParams.get("cityCode") || "32020" : "32020";
        return `bus-stops:${cityCode}:${id}`;
    },
    fetcher: (id, req) => {
        const cityCode = req ? new URL(req.url).searchParams.get("cityCode") || "32020" : "32020";
        return fetchRouteStops(id, cityCode);
    },
    ttl: 3600,
    errorMessage: "Failed to fetch stop data",
    cacheControl: CACHE_CONTROL,
    loggerPrefix: "bus-stops",
    validate: ApiValidators.isValidRouteId,
    cacheOptions: {
        staleWhileRevalidateSeconds: 86400,
        staleIfErrorSeconds: 86400,
    },
});
