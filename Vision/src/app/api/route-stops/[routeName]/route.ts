import {getRouteStopsByRouteName} from "@entities/station/api";
import type {BusStop} from "@entities/station/types";
import {createApiHandler} from "@shared/api/createApiHandler";
import {buildCacheControl} from "@shared/cache/cachePolicy";

export const dynamic = "force-dynamic";

const STATIC_CACHE_OPTIONS = {
    staleWhileRevalidateSeconds: 86400, staleIfErrorSeconds: 86400,
};

export const GET = createApiHandler<BusStop[]>({
    paramKey: "routeName",
    cacheKey: (id) => `route-stops:${id}`,
    fetcher: getRouteStopsByRouteName,
    ttl: 3600,
    cacheOptions: STATIC_CACHE_OPTIONS,
    errorMessage: "Failed to fetch route stops",
    cacheControl: buildCacheControl({
        ttlSeconds: 3600, ...STATIC_CACHE_OPTIONS,
    }),
    loggerPrefix: "/route-stops",
});
