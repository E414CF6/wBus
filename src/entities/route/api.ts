import type {GeoPolyline, RouteDetail, RouteInfo, RouteVariation, RouteVariationStop} from "@entities/route/types";
import type {RawCityRoute} from "@entities/bus/api/publicApi";
import {filterRouteIdsByCity, filterRouteNumbersMapByCity, filterRoutesByCity} from "@entities/city/routeBoundary";
import {getRouteMeta, registerDynamicRouteMeta} from "@entities/route/routeMetadata";

import {fetchAPI, HttpError} from "@shared/api/fetchAPI";
import {CacheManager} from "@shared/cache/CacheManager";
import {idbGet, idbSet} from "@shared/cache/idbStorage";
import {APP_CONFIG, STORAGE_KEYS} from "@shared/config/env";

export interface CityRoutesPayload {
    cityCode: string;
    route_numbers: Record<string, string[]>;
    routes: RawCityRoute[];
    count: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
let legacyRouteStorageCleaned = false;

/**
 * One-time cleanup of legacy large localStorage caches now persisted in IndexedDB.
 */
function cleanupLegacyRouteLocalStorage(): void {
    if (legacyRouteStorageCleaned || typeof window === "undefined") return;
    legacyRouteStorageCleaned = true;
    try {
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (key.startsWith(STORAGE_KEYS.CITY_ROUTES_PREFIX) || key.startsWith(STORAGE_KEYS.POLYLINE_PREFIX)) {
                toRemove.push(key);
            }
        }
        for (const key of toRemove) {
            localStorage.removeItem(key);
        }
    } catch {
        // Ignore storage errors
    }
}

// L1 fast synchronous in-memory caches (L2 persistence backed by IndexedDB)
const cityRoutesCache = new CacheManager<CityRoutesPayload>({
    maxSize: 30, ttlMs: ONE_DAY_MS,
});

const routeInfoCache = new CacheManager<RouteInfo | null>({
    maxSize: 300, ttlMs: ONE_DAY_MS,
});

const polylineCache = new CacheManager<GeoPolyline | null>({
    maxSize: 150, ttlMs: ONE_DAY_MS,
});

const variationsCache = new CacheManager<RouteVariation[]>({
    maxSize: 100, ttlMs: ONE_DAY_MS,
});

function resolveCityCode(cityCode?: string): string {
    return (cityCode || (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.CITY_CODE) || "32020" : "32020"));
}

function sanitizeCityRoutesPayload(cCode: string, payload: CityRoutesPayload): {
    sanitized: CityRoutesPayload; changed: boolean;
} {
    const filteredRoutes = filterRoutesByCity(cCode, payload.routes || []);
    const {cleaned: cleanedMap, hadContamination} = filterRouteNumbersMapByCity(cCode, payload.route_numbers || {});
    const changed = hadContamination || filteredRoutes.length !== (payload.routes || []).length;
    const sanitized: CityRoutesPayload = changed
        ? {cityCode: cCode, route_numbers: cleanedMap, routes: filteredRoutes, count: filteredRoutes.length}
        : payload;
    if (sanitized.routes?.length) {
        registerDynamicRouteMeta(cCode, sanitized.routes);
    }
    return {sanitized, changed};
}

/**
 * Synchronously inspect cached city routes (L1 Memory)
 */
export function getCachedCityRoutesSync(cityCode?: string): CityRoutesPayload | null {
    const cCode = resolveCityCode(cityCode);
    const cached = cityRoutesCache.get(cCode);
    if (!cached) return null;

    const {sanitized, changed} = sanitizeCityRoutesPayload(cCode, cached);
    if (changed) {
        cityRoutesCache.set(cCode, sanitized);
    }
    return sanitized;
}

/**
 * Synchronously inspect cached route info (from cityRoutesCache or routeInfoCache)
 */
export function getCachedRouteInfoSync(routeName: string, cityCode?: string): RouteInfo | null {
    if (!routeName || routeName === "0") return null;
    const cCode = resolveCityCode(cityCode);

    const cityData = getCachedCityRoutesSync(cCode);
    const idsFromCity = filterRouteIdsByCity(cCode, cityData?.route_numbers?.[routeName] || []);
    if (idsFromCity.length > 0) {
        return {routeName, vehicleRouteIds: idsFromCity};
    }

    const cached = routeInfoCache.get(`${cCode}:${routeName}`);
    if (cached?.vehicleRouteIds) {
        const vIds = filterRouteIdsByCity(cCode, cached.vehicleRouteIds);
        if (vIds.length > 0) {
            return {routeName, vehicleRouteIds: vIds};
        }
    }
    return null;
}

/**
 * Synchronously inspect cached GeoPolyline (L1 Memory or L2 localStorage)
 */
export function getCachedPolylineSync(routeKey: string, cityCode?: string): GeoPolyline | null {
    const cCode = resolveCityCode(cityCode);
    return polylineCache.get(`${cCode}:${routeKey}`);
}

/**
 * Fetch and cache full city routes list & route_numbers map (with request coalescing + L2 IndexedDB persistence)
 */
export async function fetchCityRoutesData(cityCode?: string): Promise<CityRoutesPayload> {
    const cCode = resolveCityCode(cityCode);
    cleanupLegacyRouteLocalStorage();

    const cached = getCachedCityRoutesSync(cCode);
    if (cached && cached.routes && cached.routes.length > 0) {
        return cached;
    }

    const result = await cityRoutesCache.getOrFetch(cCode, async () => {
        const idbKey = `${STORAGE_KEYS.CITY_ROUTES_PREFIX}${cCode}`;
        const fromIdb = await idbGet<CityRoutesPayload>(idbKey);
        if (fromIdb && Array.isArray(fromIdb.routes) && fromIdb.routes.length > 0) {
            const {sanitized, changed} = sanitizeCityRoutesPayload(cCode, fromIdb);
            if (sanitized.routes.length > 0) {
                if (changed) {
                    void idbSet(idbKey, sanitized, ONE_DAY_MS);
                }
                return sanitized;
            }
        }

        const json = await fetchAPI<Partial<CityRoutesPayload>>(`/api/routes?cityCode=${cCode}`);
        const rawPayload: CityRoutesPayload = {
            cityCode: cCode,
            route_numbers: json.route_numbers || {},
            routes: Array.isArray(json.routes) ? json.routes : [],
            count: json.count ?? (Array.isArray(json.routes) ? json.routes.length : 0),
        };
        const {sanitized} = sanitizeCityRoutesPayload(cCode, rawPayload);
        if (sanitized.routes.length > 0) {
            void idbSet(idbKey, sanitized, ONE_DAY_MS);
        }
        return sanitized;
    });

    if (!result || result.routes.length === 0) {
        cityRoutesCache.delete(cCode);
    }
    return result;
}

// Public API

export async function getPolyline(routeKey: string, cityCode?: string): Promise<GeoPolyline | null> {
    const cCode = resolveCityCode(cityCode);
    cleanupLegacyRouteLocalStorage();

    const cacheKey = `${cCode}:${routeKey}`;
    const result = await polylineCache.getOrFetch(cacheKey, async () => {
        const idbKey = `${STORAGE_KEYS.POLYLINE_PREFIX}${cacheKey}`;
        const fromIdb = await idbGet<GeoPolyline>(idbKey);
        if (fromIdb && !fromIdb.is_fallback && Array.isArray(fromIdb.stops) && fromIdb.stops.length > 0) {
            return fromIdb;
        }

        try {
            const poly = await fetchAPI<GeoPolyline>(`/api/polyline/${encodeURIComponent(routeKey)}?cityCode=${cCode}`);
            if (poly && !poly.is_fallback && Array.isArray(poly.stops) && poly.stops.length > 0) {
                void idbSet(idbKey, poly, ONE_DAY_MS);
            }
            return poly;
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
    if (!result || result.is_fallback) {
        polylineCache.delete(cacheKey);
    }
    return result;
}

export async function getRouteInfo(routeName: string, cityCode?: string): Promise<RouteInfo | null> {
    if (!routeName || routeName === "0") return null;
    const cCode = resolveCityCode(cityCode);

    // 1. Check already-cached full city route map first (0 network calls!)
    const cachedCity = getCachedCityRoutesSync(cCode);
    let cachedIds = cachedCity?.route_numbers?.[routeName];
    if (cachedIds && cachedIds.length > 0) {
        cachedIds = filterRouteIdsByCity(cCode, cachedIds);
        if (cachedIds.length > 0) {
            return {routeName, vehicleRouteIds: cachedIds};
        }
    }

    // 2. Coalesced fetch with routeInfoCache
    const cacheKey = `${cCode}:${routeName}`;
    const result = await routeInfoCache.getOrFetch(cacheKey, async () => {
        try {
            const json = await fetchAPI<{
                route_numbers?: Record<string, string[]>; routes?: Array<{ routeid: string }>
            }>(`/api/routes?cityCode=${cCode}&routeNo=${encodeURIComponent(routeName)}`);
            let ids = json?.route_numbers?.[routeName] || (json?.routes?.[0]?.routeid ? [json.routes[0].routeid] : null);
            if (ids && ids.length > 0) {
                ids = filterRouteIdsByCity(cCode, ids);
                if (ids.length > 0) {
                    return {routeName, vehicleRouteIds: ids};
                }
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
        const vIds = filterRouteIdsByCity(cCode, routeInfo.vehicleRouteIds);
        if (vIds.length === 0) return [];

        const polylines = await Promise.all(vIds.map(async (id) => {
            const poly = await getPolyline(id, cCode);
            return {id, poly};
        }));

        const validPolylines = polylines.filter((p): p is {
            id: string; poly: GeoPolyline
        } => Boolean(p.poly && p.poly.stops?.length));
        if (validPolylines.length === 0) return [];

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
                gpslati: s.lat ?? 0,
                gpslong: s.lon ?? 0,
                nodeno: String(s.nodeno || ""),
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

            // Derive origin and turnaround names for "{기점} - {회차지}" formatting
            const rawOrigin = stops[0]?.nodenm ?? poly.stops[0]?.name ?? "";
            const cleanOrigin = rawOrigin
                .replace(/\s*(차고지|종점|승강장)$/, "")
                .trim() || rawOrigin;

            const rawTurning = turningStop?.nodenm ?? "";
            const cleanTurning = rawTurning
                .replace(/\s*(차고지|종점|승강장)$/, "")
                .replace(/\s*\((시내방면|교내|종점|회차)\)$/, "")
                .trim() || rawTurning;

            const lastStop = stops[stops.length - 1]?.nodenm ?? poly.stops[poly.stops.length - 1]?.name ?? "";
            const cleanLast = lastStop
                .replace(/\s*(차고지|종점|승강장)$/, "")
                .replace(/\s*\((시내방면|교내|종점|회차)\)$/, "")
                .trim() || lastStop;

            const meta = getRouteMeta(routeName, cCode);
            const turnaroundName = cleanTurning || (cleanLast && cleanLast !== cleanOrigin ? cleanLast : "") || meta.destination || "회차지";
            const originName = cleanOrigin || meta.origin || "기점";

            let label = `${originName} ↔ ${turnaroundName}`;

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
                routeId: id, label: finalLabel, stops, stopCount: stops.length, turningStop,
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

export const clearRouteCaches = invalidateRouteCaches;

