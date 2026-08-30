import type {GeoPolyline, RouteDetail, RouteInfo, RouteMapData, SegmentsJSON} from "@entities/route/types";

import {HttpError} from "@shared/api/fetchAPI";
import {CacheManager} from "@shared/cache/CacheManager";
import {API_CONFIG, APP_CONFIG} from "@shared/config/env";
import {loadStaticData} from "@shared/utils/dataLoader";

// Caches

const routeMapCache = new CacheManager<RouteMapData>();
const polylineCache = new CacheManager<GeoPolyline | null>();
const segmentsCache = new CacheManager<SegmentsJSON>();

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
