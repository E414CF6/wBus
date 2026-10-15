import type {
    GeoPolyline,
    RouteDetail,
    RouteInfo,
    RouteVariation,
    RouteVariationStop,
} from "@entities/route/types";
import {getStationMap} from "@entities/station/api";
import type {StationLocation} from "@entities/station/types";

import {fetchAPI, HttpError} from "@shared/api/fetchAPI";
import {CacheManager} from "@shared/cache/CacheManager";
import {APP_CONFIG, STORAGE_KEYS} from "@shared/config/env";

// Caches

const polylineCache = new CacheManager<GeoPolyline | null>();
const variationsCache = new CacheManager<RouteVariation[]>();

// Public API

export async function getRouteMap(cityCode?: string): Promise<Record<string, string[]>> {
    const cCode = cityCode || (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.CITY_CODE) || "32020" : "32020");
    try {
        const json = await fetchAPI<{route_numbers?: Record<string, string[]>}>(`/api/routes?cityCode=${cCode}`);
        return json.route_numbers || {};
    } catch {
        return {};
    }
}

export async function getPolyline(routeKey: string, cityCode?: string): Promise<GeoPolyline | null> {
    const cCode = cityCode || (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.CITY_CODE) || "32020" : "32020");
    const cacheKey = `${cCode}:${routeKey}`;
    return polylineCache.getOrFetch(cacheKey, async () => {
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
}

export async function getRouteInfo(routeName: string, cityCode?: string): Promise<RouteInfo | null> {
    if (!routeName || routeName === "0") return null;
    const cCode = cityCode || (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.CITY_CODE) || "32020" : "32020");
    try {
        const json = await fetchAPI<{route_numbers?: Record<string, string[]>; routes?: Array<{routeid: string}>}>(
            `/api/routes?cityCode=${cCode}&routeNo=${encodeURIComponent(routeName)}`
        );
        const ids = json?.route_numbers?.[routeName] || (json?.routes?.[0]?.routeid ? [json.routes[0].routeid] : null);
        if (ids && ids.length > 0) {
            return { routeName, vehicleRouteIds: ids };
        }
        return null;
    } catch (err) {
        if (APP_CONFIG.IS_DEV && routeName !== "0") {
            console.warn(`[getRouteInfo] Route info fetch failed: ${routeName}`, err);
        }
        return null;
    }
}

export async function getRouteDetails(routeId: string): Promise<RouteDetail | null> {
    const polyline = await getPolyline(routeId);
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
 * Invalidate in-memory caches for route map, polylines, and route variations
 */
export function invalidateRouteCaches(): void {
    polylineCache.clear();
    variationsCache.clear();
}

