import {filterRoutesByCity, isRouteAllowedInCity} from "@entities/city/routeBoundary";
import {
    filterValidItems,
    TagoBusArrivalSchema,
    TagoBusLocationSchema,
    TagoBusStopSchema,
    TagoCityRouteSchema,
    TagoNearbyStopSchema,
} from "@shared/api/schemas";
import {type CachedData, getCachedOrFetch, peekCached} from "@shared/cache";
import {API_PRIORITY} from "@shared/utils/concurrency";
import {
    isRouteInServiceWindow,
    recordRouteBusActivity,
    registerCityRoutesMapping,
    registerRouteIdMapping,
    warmRouteWindowResources,
} from "../routeWindow";
import {
    fetchSeoulBusArrivals,
    fetchSeoulBusLocations,
    fetchSeoulCityRoutes,
    fetchSeoulNearbyStops,
    fetchSeoulRouteStops,
    isWithinSeoulBounds,
    SEOUL_CITY_CODE,
} from "../seoulApi";
import {keyManager} from "./serviceKeyManager";
import {
    circuitBreaker,
    extractItems,
    fetchAllPublicApiPages,
    fetchPublicApi,
    pendingInflightRequests,
    publicApiQueue,
} from "./tagoClient";
import {
    CITY_CODE,
    type PublicApiResponseEnvelope,
    type RawBusArrival,
    type RawBusLocation,
    type RawBusStop,
    type RawCityRoute,
    type RawNearbyStop,
} from "./tagoTypes";

interface RouteBusMetrics {
    busCount: number;
    lastFetchedAt: number;
}

const routeBusMetricsMap = new Map<string, RouteBusMetrics>();

export function getAdaptiveTtlSeconds(
    routeId: string,
    activeTtl = 8,
    idleTtl = 15,
    cityCode: string = CITY_CODE
): number {
    const status = isRouteInServiceWindow(routeId, new Date(), cityCode);
    if (!status.inService) {
        return status.retryAfterSeconds;
    }

    const metrics = routeBusMetricsMap.get(`${cityCode}:${routeId}`) ?? routeBusMetricsMap.get(routeId);
    if (!metrics) return activeTtl;
    return metrics.busCount > 0 ? activeTtl : idleTtl;
}

export function getPublicApiHealth() {
    return {
        circuit: circuitBreaker.getState(),
        keys: keyManager.getMetrics(),
        queue: publicApiQueue.getMetrics(),
        inflightRequests: pendingInflightRequests.size,
        routeBusCounts: Object.fromEntries(Array.from(routeBusMetricsMap.entries()).map(([id, m]) => [id, m.busCount])),
    };
}

export async function fetchBusLocations(
    routeId: string,
    options?: { force?: boolean; priority?: number; cityCode?: string }
): Promise<RawBusLocation[]> {
    const cityCode = options?.cityCode ?? CITY_CODE;
    const metricsKey = `${cityCode}:${routeId}`;

    await warmRouteWindowResources(cityCode);

    const serviceStatus = isRouteInServiceWindow(routeId, new Date(), cityCode);
    if (!serviceStatus.inService && !options?.force) {
        routeBusMetricsMap.set(metricsKey, {busCount: 0, lastFetchedAt: Date.now()});
        return [];
    }

    const currentMetrics = routeBusMetricsMap.get(metricsKey);
    const priority =
        options?.priority ??
        (serviceStatus.reason === "activity_override" || (currentMetrics && currentMetrics.busCount > 0)
            ? API_PRIORITY.USER_INTERACTIVE
            : API_PRIORITY.STREAM_ACTIVE);

    if (cityCode === SEOUL_CITY_CODE) {
        const items = await fetchSeoulBusLocations(
            routeId,
            () => keyManager.getKey(),
            (idx) => keyManager.markCooldown(idx)
        );
        routeBusMetricsMap.set(metricsKey, {busCount: items.length, lastFetchedAt: Date.now()});
        recordRouteBusActivity(routeId, items.length, cityCode);
        return items;
    }

    if (!isRouteAllowedInCity(cityCode, routeId)) {
        return [];
    }

    const tagoCityCode = cityCode === "32320" ? "32020" : cityCode;
    const data = await fetchPublicApi<PublicApiResponseEnvelope<RawBusLocation>>(
        "/BusLcInfoInqireService/getRouteAcctoBusLcList",
        {routeId, cityCode: tagoCityCode},
        {priority}
    );

    const items = extractItems(data, `getRouteAcctoBusLcList:${cityCode}:${routeId}`);
    const mapped = items.map((bus) => ({
        ...bus,
        routeid: routeId,
        gpslati: Number(bus.gpslati),
        gpslong: Number(bus.gpslong),
        routenm: String(bus.routenm ?? ""),
    }));
    const validItems = filterValidItems(mapped, TagoBusLocationSchema, `bus-loc:${cityCode}:${routeId}`) as RawBusLocation[];

    const discoveredRouteNo = validItems.find((b) => b.routenm)?.routenm;
    if (discoveredRouteNo) {
        registerRouteIdMapping(cityCode, routeId, String(discoveredRouteNo));
    }

    routeBusMetricsMap.set(metricsKey, {busCount: validItems.length, lastFetchedAt: Date.now()});
    recordRouteBusActivity(routeId, validItems.length, cityCode, discoveredRouteNo ? String(discoveredRouteNo) : undefined);

    return validItems;
}

export async function fetchBusArrivals(nodeId: string, cityCode = CITY_CODE): Promise<RawBusArrival[]> {
    if (cityCode === SEOUL_CITY_CODE) {
        return fetchSeoulBusArrivals(nodeId);
    }

    const tagoCityCode = cityCode === "32320" ? "32020" : cityCode;
    const data = await fetchPublicApi<PublicApiResponseEnvelope<RawBusArrival>>(
        "/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList",
        {nodeId, cityCode: tagoCityCode},
        {priority: API_PRIORITY.USER_INTERACTIVE}
    );

    const items = extractItems(data, `getSttnAcctoArvlPrearngeInfoList:${cityCode}:${nodeId}`);
    return filterValidItems(
        items.map((item) => ({
            ...item,
            routeno: String(item.routeno ?? ""),
            arrprevstationcnt: Number(item.arrprevstationcnt ?? 0),
            arrtime: Number(item.arrtime ?? 0),
        })),
        TagoBusArrivalSchema,
        `bus-arrival:${cityCode}:${nodeId}`
    ) as RawBusArrival[];
}

export async function fetchRouteStops(routeId: string, cityCode = CITY_CODE): Promise<RawBusStop[]> {
    if (cityCode === SEOUL_CITY_CODE) {
        return fetchSeoulRouteStops(routeId);
    }

    if (!isRouteAllowedInCity(cityCode, routeId)) {
        return [];
    }

    const tagoCityCode = cityCode === "32320" ? "32020" : cityCode;
    const items = await fetchAllPublicApiPages<RawBusStop>(
        "/BusRouteInfoInqireService/getRouteAcctoThrghSttnList",
        {routeId, cityCode: tagoCityCode, numOfRows: "1024"},
        API_PRIORITY.USER_INTERACTIVE,
        `getRouteAcctoThrghSttnList:${cityCode}:${routeId}`
    );
    return filterValidItems(
        items.map((stop) => ({
            ...stop,
            gpslati: Number(stop.gpslati),
            gpslong: Number(stop.gpslong),
            nodeord: Number(stop.nodeord ?? 0),
            updowncd: Number(stop.updowncd ?? 0),
        })),
        TagoBusStopSchema,
        `route-stops:${cityCode}:${routeId}`
    ) as RawBusStop[];
}

export async function fetchNearbyStops(params: { gpsLati: number; gpsLong: number }): Promise<RawNearbyStop[]> {
    if (isWithinSeoulBounds(params.gpsLati, params.gpsLong)) {
        try {
            const seoulStops = await fetchSeoulNearbyStops(params);
            if (seoulStops.length > 0) {
                return seoulStops;
            }
        } catch {
            // Fall through to TAGO if Seoul endpoint fails
        }
    }

    const data = await fetchPublicApi<PublicApiResponseEnvelope<RawNearbyStop>>(
        "/BusSttnInfoInqireService/getCrdntPrxmtSttnList",
        {
            gpsLati: String(params.gpsLati),
            gpsLong: String(params.gpsLong),
            numOfRows: "50",
        },
        {priority: API_PRIORITY.USER_INTERACTIVE}
    );

    const items = extractItems(data, `getCrdntPrxmtSttnList:${params.gpsLati},${params.gpsLong}`);
    return filterValidItems(
        items.map((s) => ({
            ...s,
            gpslati: Number(s.gpslati),
            gpslong: Number(s.gpslong),
        })),
        TagoNearbyStopSchema,
        `nearby-stops:${params.gpsLati.toFixed(3)},${params.gpsLong.toFixed(3)}`
    ) as RawNearbyStop[];
}

export async function fetchCityRoutes(cityCode: string, routeNo?: string): Promise<RawCityRoute[]> {
    if (cityCode === SEOUL_CITY_CODE) {
        return fetchSeoulCityRoutes(routeNo);
    }

    const tagoCityCode = cityCode === "32320" ? "32020" : cityCode;
    const params: Record<string, string> = {
        cityCode: tagoCityCode,
        numOfRows: "2048",
    };
    if (routeNo) {
        params.routeNo = routeNo;
    }

    const items = await fetchAllPublicApiPages<RawCityRoute>(
        "/BusRouteInfoInqireService/getRouteNoList",
        params,
        API_PRIORITY.USER_INTERACTIVE,
        `getRouteNoList:${cityCode}:${routeNo ?? "all"}`
    );
    const mapped = filterValidItems(
        items.map((r) => ({
            ...r,
            routeno: String(r.routeno ?? ""),
        })),
        TagoCityRouteSchema,
        `city-routes:${cityCode}`
    ) as RawCityRoute[];

    const filtered = filterRoutesByCity(cityCode, mapped);
    if (filtered.length > 0) {
        registerCityRoutesMapping(cityCode, filtered);
    }

    return filtered;
}

const ROUTE_CACHE_OPTIONS = {
    ttlSeconds: 86400,
    staleWhileRevalidateSeconds: 604800,
    staleIfErrorSeconds: 604800,
    useDistributedCache: true,
} as const;

export async function getCachedCityRoutes(cityCode: string, routeNo?: string) {
    const allCacheKey = `routes:${cityCode}:all`;

    if (routeNo) {
        const cachedAll = peekCached<RawCityRoute[]>(
            allCacheKey,
            ROUTE_CACHE_OPTIONS.ttlSeconds + ROUTE_CACHE_OPTIONS.staleWhileRevalidateSeconds
        );
        if (cachedAll?.data && cachedAll.data.length > 0) {
            registerCityRoutesMapping(cityCode, cachedAll.data);
            const exact = cachedAll.data.filter((r) => String(r.routeno) === routeNo);
            if (exact.length > 0) {
                return {data: exact, meta: cachedAll.meta};
            }
        }
    }

    let allResult: CachedData<RawCityRoute[]>;
    try {
        allResult = await getCachedOrFetch<RawCityRoute[]>(
            allCacheKey,
            async () => {
                const fetched = await fetchCityRoutes(cityCode);
                if (!fetched || fetched.length === 0) {
                    throw new Error(`[PublicAPI] No routes returned for city ${cityCode}`);
                }
                return fetched;
            },
            ROUTE_CACHE_OPTIONS
        );
        if (allResult.data && allResult.data.length > 0) {
            registerCityRoutesMapping(cityCode, allResult.data);
        }
    } catch {
        allResult = {data: [], timestamp: Date.now()};
    }

    if (!routeNo) {
        return allResult;
    }

    const matchedFromAll = (allResult.data || []).filter((r) => String(r.routeno) === routeNo);
    if (matchedFromAll.length > 0) {
        return {data: matchedFromAll, meta: allResult.meta};
    }

    const specificKey = `routes:${cityCode}:${routeNo}`;
    return getCachedOrFetch<RawCityRoute[]>(
        specificKey,
        async () => {
            const fetched = await fetchCityRoutes(cityCode, routeNo);
            return fetched && fetched.length > 0 ? fetched : [];
        },
        {
            ...ROUTE_CACHE_OPTIONS,
            shouldCache: (items) => Array.isArray(items) && items.length > 0,
        }
    );
}
