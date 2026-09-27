import type {
    GeoPolyline,
    RouteDetail,
    RouteInfo,
    RouteMapData,
    RouteVariation,
    RouteVariationStop,
    SegmentsJSON,
} from "@entities/route/types";
import {getStationMap} from "@entities/station/api";
import type {StationLocation} from "@entities/station/types";

import {HttpError} from "@shared/api/fetchAPI";
import {CacheManager} from "@shared/cache/CacheManager";
import {API_CONFIG, APP_CONFIG} from "@shared/config/env";
import {loadStaticData} from "@shared/utils/dataLoader";

// Caches

const routeMapCache = new CacheManager<RouteMapData>();
const polylineCache = new CacheManager<GeoPolyline | null>();
const segmentsCache = new CacheManager<SegmentsJSON>();
const variationsCache = new CacheManager<RouteVariation[]>();

// Internal Helpers

export async function getRouteMapData(): Promise<RouteMapData> {
    return routeMapCache.getOrFetch("routeMap", async () => {
        return loadStaticData<RouteMapData>(API_CONFIG.STATIC.PATHS.ROUTE_MAP);
    });
}

// Public API

export async function getRouteMap(): Promise<Record<string, string[]>> {
    const data = await getRouteMapData();
    return Object.fromEntries(Object.entries(data.route_numbers).filter(([, ids]) => ids.length > 0));
}

export async function getSegmentsJSON(): Promise<SegmentsJSON> {
    return segmentsCache.getOrFetch("segment.json", async () => {
        return loadStaticData<SegmentsJSON>(API_CONFIG.STATIC.PATHS.SEGMENTS);
    });
}

export async function getPolyline(routeKey: string): Promise<GeoPolyline | null> {
    return polylineCache.getOrFetch(routeKey, async () => {
        try {
            return await loadStaticData<GeoPolyline>(`${API_CONFIG.STATIC.PATHS.ROUTE_DIR}/${routeKey}.json`);
        } catch (error) {
            if (error instanceof HttpError && error.status === 404) {
                if (APP_CONFIG.IS_DEV) {
                    console.warn(`[getPolyline] Polyline file not found: ${routeKey}`);
                }
                return null;
            }
            throw error;
        }
    });
}

export async function getRouteInfo(routeName: string): Promise<RouteInfo | null> {
    try {
        const map = await getRouteMap();
        const routeIds = map[routeName];
        if (!routeIds?.length) {
            if (APP_CONFIG.IS_DEV) {
                console.warn(`[getRouteInfo] Route missing: ${routeName}`);
            }
            return null;
        }
        return {routeName, vehicleRouteIds: routeIds};
    } catch (err) {
        if (APP_CONFIG.IS_DEV) {
            console.error(`[getRouteInfo] Route missing: ${routeName}`, err);
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

export async function getRouteVariations(routeName: string): Promise<RouteVariation[]> {
    if (!routeName) return [];
    return variationsCache.getOrFetch(routeName, async () => {
        const routeInfo = await getRouteInfo(routeName);
        if (!routeInfo || !routeInfo.vehicleRouteIds?.length) return [];

        let stationMap: Record<string, StationLocation> = {};
        try {
            stationMap = await getStationMap();
        } catch {
            // Station map is optional for coordinates, used only for nodeno enrichment
        }

        const polylines = await Promise.all(
            routeInfo.vehicleRouteIds.map(async (id) => {
                const poly = await getPolyline(id);
                return {id, poly};
            })
        );

        const validPolylines = polylines.filter(
            (p): p is { id: string; poly: GeoPolyline } => Boolean(p.poly && p.poly.stops?.length)
        );
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
                gpslati: s.lat ?? stationMap[s.id]?.gpslati ?? 0,
                gpslong: s.lon ?? stationMap[s.id]?.gpslong ?? 0,
                nodeno: String(stationMap[s.id]?.nodeno ?? ""),
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

