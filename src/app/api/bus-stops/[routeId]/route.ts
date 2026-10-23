import {ApiValidators, createApiHandler} from "@shared/api";
import {fetchRouteStops, type RawBusStop} from "@entities/bus";

import {buildCacheControl} from "@shared/cache/cachePolicy";

// Always treat this route as dynamic to avoid static build-time serialization
export const dynamic = "force-dynamic";

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
        const cityCode = ApiValidators.resolveCityCode(req ? new URL(req.url).searchParams.get("cityCode") : null);
        return `bus-stops:${cityCode}:${id}`;
    },
    fetcher: (id, req) => {
        const cityCode = ApiValidators.resolveCityCode(req ? new URL(req.url).searchParams.get("cityCode") : null);
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
