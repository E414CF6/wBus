import {createApiHandler} from "@shared/api";
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
    cacheKey: (id) => `bus-stops:${id}`,
    fetcher: fetchRouteStops,
    ttl: 3600,
    errorMessage: "Failed to fetch stop data",
    cacheControl: CACHE_CONTROL,
    loggerPrefix: "bus-stops",
    validate: (id) => /^[a-zA-Z0-9_-]+$/.test(id) && id.length <= 50,
    cacheOptions: {
        staleWhileRevalidateSeconds: 86400,
        staleIfErrorSeconds: 86400,
    },
});
