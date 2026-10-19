import type {GeoPolyline, RouteDetail, RouteInfo, RouteVariation, RouteVariationStop,} from "@entities/route/types";
import type {RawCityRoute} from "@entities/bus/api/publicApi";
import {registerDynamicRouteMeta} from "@entities/route/routeMetadata";
import {getStationMap} from "@entities/station/api";
import type {StationLocation} from "@entities/station/types";

import {fetchAPI, HttpError} from "@shared/api/fetchAPI";
import {CacheManager} from "@shared/cache/CacheManager";
import {APP_CONFIG, STORAGE_KEYS} from "@shared/config/env";

export interface CityRoutesPayload {
    cityCode: string;
    route_numbers: Record<string, string[]>;
    routes: RawCityRoute[];
    count: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Caches (L1 Memory + L2 Persistent localStorage)
const cityRoutesCache = new CacheManager<CityRoutesPayload>({
    maxSize: 30,
    ttlMs: ONE_DAY_MS,
    storagePrefix: STORAGE_KEYS.CITY_ROUTES_PREFIX,
    maxStorageEntries: 15,
});

const routeInfoCache = new CacheManager<RouteInfo | null>({
    maxSize: 300,
    ttlMs: ONE_DAY_MS,
});

const polylineCache = new CacheManager<GeoPolyline | null>({
    maxSize: 150,
    ttlMs: ONE_DAY_MS,
    storagePrefix: STORAGE_KEYS.POLYLINE_PREFIX,
    maxStorageEntries: 35,
});

const variationsCache = new CacheManager<RouteVariation[]>({
    maxSize: 100,
    ttlMs: ONE_DAY_MS,
});

function resolveCityCode(cityCode?: string): string {
    return (
        cityCode ||
        (typeof window !== "undefined"
            ? localStorage.getItem(STORAGE_KEYS.CITY_CODE) || "32020"
            : "32020")
    );
}

/**
 * Synchronously inspect cached city routes (L1 Memory or L2 localStorage)
 */
export function getCachedCityRoutesSync(cityCode?: string): CityRoutesPayload | null {
    const cCode = resolveCityCode(cityCode);
    const cached = cityRoutesCache.get(cCode);
    if (cached && cached.routes?.length) {
        registerDynamicRouteMeta(cCode, cached.routes);
    }
    return cached;
}

/**
 * Synchronously inspect cached route info (from cityRoutesCache or routeInfoCache)
 */
export function getCachedRouteInfoSync(routeName: string, cityCode?: string): RouteInfo | null {
    if (!routeName || routeName === "0") return null;
    const cCode = resolveCityCode(cityCode);

    const cityData = cityRoutesCache.get(cCode);
    const idsFromCity = cityData?.route_numbers?.[routeName];
    if (idsFromCity && idsFromCity.length > 0) {
        return {routeName, vehicleRouteIds: idsFromCity};
    }

    return routeInfoCache.get(`${cCode}:${routeName}`);
}

/**
 * Synchronously inspect cached GeoPolyline (L1 Memory or L2 localStorage)
 */
export function getCachedPolylineSync(routeKey: string, cityCode?: string): GeoPolyline | null {
    const cCode = resolveCityCode(cityCode);
    return polylineCache.get(`${cCode}:${routeKey}`);
}

/**
 * Fetch and cache full city routes list & route_numbers map (with request coalescing + L2 persistence)
 */
export async function fetchCityRoutesData(cityCode?: string): Promise<CityRoutesPayload> {
    const cCode = resolveCityCode(cityCode);
    const cached = cityRoutesCache.get(cCode);
    if (cached && cached.routes && cached.routes.length > 0) {
        registerDynamicRouteMeta(cCode, cached.routes);
        return cached;
    }

    const json = await fetchAPI<Partial<CityRoutesPayload>>(`/api/routes?cityCode=${cCode}`);
    const routes = Array.isArray(json.routes) ? json.routes : [];
    const routeNumbers = json.route_numbers || {};
    if (routes.length > 0) {
        registerDynamicRouteMeta(cCode, routes);
    }
    const payload: CityRoutesPayload = {
        cityCode: cCode,
        route_numbers: routeNumbers,
        routes,
        count: json.count ?? routes.length,
    };
    if (routes.length > 0) {
        cityRoutesCache.set(cCode, payload);
    }
    return payload;
}

// Public API

export async function getRouteMap(cityCode?: string): Promise<Record<string, string[]>> {
    try {
        const data = await fetchCityRoutesData(cityCode);
        return data.route_numbers || {};
    } catch {
        return {};
    }
}

export async function getPolyline(routeKey: string, cityCode?: string): Promise<GeoPolyline | null> {
    const cCode = resolveCityCode(cityCode);
    const cacheKey = `${cCode}:${routeKey}`;
    const result = await polylineCache.getOrFetch(cacheKey, async () => {
        try {
            return await fetchAPI<GeoPolyline>(`/api/polyline/${encodeURIComponent(routeKey)}?cityCode=${cCode}`);
        } catch (error) {
            if (error instanceof HttpError && error.status === 404) {
                if (APP_CONFIG.IS_DEV) {
                    console.warn(`[getPolyline] Polyline file not found: ${routeKey} (${cCode})`);
                }
                return null;
            }
            throw error;
        }
    });
    if (!result) {
        polylineCache.delete(cacheKey);
    }
    return result;
}

export async function getRouteInfo(routeName: string, cityCode?: string): Promise<RouteInfo | null> {
    if (!routeName || routeName === "0") return null;
    const cCode = resolveCityCode(cityCode);

    // 1. Check already-cached full city route map first (0 network calls!)
    const cachedCity = getCachedCityRoutesSync(cCode);
    const cachedIds = cachedCity?.route_numbers?.[routeName];
    if (cachedIds && cachedIds.length > 0) {
        return {routeName, vehicleRouteIds: cachedIds};
    }

    // 2. Coalesced fetch with routeInfoCache
    const cacheKey = `${cCode}:${routeName}`;
    const result = await routeInfoCache.getOrFetch(cacheKey, async () => {
        try {
            const json = await fetchAPI<{route_numbers?: Record<string, string[]>; routes?: Array<{routeid: string}>}>(
                `/api/routes?cityCode=${cCode}&routeNo=${encodeURIComponent(routeName)}`
            );
            const ids = json?.route_numbers?.[routeName] || (json?.routes?.[0]?.routeid ? [json.routes[0].routeid] : null);
            if (ids && ids.length > 0) {
                return {routeName, vehicleRouteIds: ids};
            }
            return null;
        } catch (err) {
            if (APP_CONFIG.IS_DEV && routeName !== "0") {
                console.warn(`[getRouteInfo] Route info fetch failed: ${routeName}`, err);
            }
            return null;
        }
    });
    if (!result) {
        routeInfoCache.delete(cacheKey);
    }
    return result;
}

export async function getRouteDetails(routeId: string, cityCode?: string): Promise<RouteDetail | null> {
    const polyline = await getPolyline(routeId, cityCode);
    if (!polyline || !polyline.stops) return null;
    const sequence = polyline.stops.map((s) => ({
        nodeid: s.id, nodeord: s.ord, updowncd: s.ud
    }));
    return {routeno: polyline.route_no, sequence};
}

export async function getRouteVariations(routeName: string, cityCode?: string): Promise<RouteVariation[]> {
    if (!routeName || routeName === "0") return [];
    const cCode = cityCode || (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.CITY_CODE) || "32020" : "32020");
    const cacheKey = `${cCode}:${routeName}`;
    return variationsCache.getOrFetch(cacheKey, async () => {
        const routeInfo = await getRouteInfo(routeName, cCode);
        if (!routeInfo || !routeInfo.vehicleRouteIds?.length) return [];

        const polylines = await Promise.all(
            routeInfo.vehicleRouteIds.map(async (id) => {
                const poly = await getPolyline(id, cCode);
                return {id, poly};
            })
        );

        const validPolylines = polylines.filter(
            (p): p is { id: string; poly: GeoPolyline } => Boolean(p.poly && p.poly.stops?.length)
        );
        if (validPolylines.length === 0) return [];

        // Lazy fetch stationMap only if any stop is missing nodeno or coordinates
        const needsStationMap = validPolylines.some((p) =>
            p.poly.stops.some((s) => !s.nodeno || s.lat === undefined || s.lon === undefined)
        );

        let stationMap: Record<string, StationLocation> = {};
        if (needsStationMap) {
            try {
                stationMap = await getStationMap();
            } catch {
                // Station map is optional for coordinates, used only for nodeno enrichment
            }
        }

        const baseStops = validPolylines[0].poly.stops;
        const baseNames = new Set(baseStops.map((s) => s.name));
        const baseFirst = baseStops[0]?.name ?? "";
        const baseLast = baseStops[baseStops.length - 1]?.name ?? "";

        const usedLabels = new Map<string, number>();

        return validPolylines.map(({id, poly}, index) => {
            const stops: RouteVariationStop[] = (poly.stops || []).map((s) => ({
                nodeid: s.id,
                nodenm: s.name,
                nodeord: s.ord,
                updowncd: s.ud,
                gpslati: s.lat ?? stationMap[s.id]?.gpslati ?? 0,
                gpslong: s.lon ?? stationMap[s.id]?.gpslong ?? 0,
                nodeno: String(s.nodeno || stationMap[s.id]?.nodeno || ""),
            }));

            // Find turning point station:
            // 1. Transition from outbound (ud: 0) to inbound (ud: 1)
            let turningStop: RouteVariationStop | null = null;
            for (let i = 0; i < stops.length - 1; i++) {
                if (stops[i].updowncd === 0 && stops[i + 1].updowncd === 1) {
                    turningStop = stops[i];
                    break;
                }
            }
            // 2. Explicit name contains "회차"
            if (!turningStop) {
                turningStop = stops.find((s) => s.nodenm.includes("회차")) ?? null;
            }

            // Generate user-friendly variation label
            let label = "기본 노선";
            if (index > 0) {
                const first = poly.stops[0]?.name ?? "";
                const last = poly.stops[poly.stops.length - 1]?.name ?? "";

                if (first && baseFirst && first !== baseFirst) {
                    label = `${first.replace(/ (차고지|종점|승강장)$/, "")} 출발`;
                } else if (last && baseLast && last !== baseLast && poly.stops.length < baseStops.length * 0.85) {
                    label = `${last.replace(/ (차고지|종점|승강장)$/, "")} 종점`;
                } else {
                    const diff = poly.stops.filter((s) => !baseNames.has(s.name));
                    if (diff.length > 0) {
                        const cleanName = diff[0].name
                            .replace(/정류장$/, "")
                            .replace(/\(승차전용\)$/, "")
                            .replace(/\(교내\)$/, "")
                            .trim();
                        label = `${cleanName} 경유`;
                    } else if (poly.stops.length < baseStops.length) {
                        label = `단축 (${poly.stops.length}개 정류장)`;
                    } else {
                        label = `변형 ${index + 1}`;
                    }
                }
            }

            const count = (usedLabels.get(label) ?? 0) + 1;
            usedLabels.set(label, count);
            const finalLabel = count > 1 ? `${label} (${count})` : label;

            return {
                routeId: id,
                label: finalLabel,
                stops,
                stopCount: stops.length,
                turningStop,
            };
        });
    });
}

/**
 * Invalidate in-memory & persistent caches for route map, polylines, and route variations
 */
export function invalidateRouteCaches(): void {
    cityRoutesCache.clear();
    routeInfoCache.clear();
    polylineCache.clear();
    variationsCache.clear();
}

