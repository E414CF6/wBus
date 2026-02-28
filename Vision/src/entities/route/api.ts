import { fetchAPI, HttpError } from "@core/api/fetchAPI";
import { CacheManager } from "@core/cache/CacheManager";
import { API_CONFIG, APP_CONFIG } from "@core/constants/env";
import type { GeoPolyline, RouteDetail, RouteInfo, RouteMapData, } from "@entities/route/types";

// ── Caches ─────────────────────────────────────────────────────

const routeMapCache = new CacheManager<RouteMapData>();
const polylineCache = new CacheManager<GeoPolyline | null>();

// ── URL Builders ───────────────────────────────────────────────

function getPolylineUrl(routeKey: string): string {
    if (API_CONFIG.STATIC.USE_REMOTE && API_CONFIG.STATIC.BASE_URL) {
        return `${API_CONFIG.STATIC.BASE_URL}/${API_CONFIG.STATIC.PATHS.POLYLINES}/${routeKey}.geojson`;
    }
    return `/data/polylines/${routeKey}.geojson`;
}

function getRouteMapUrl(): string {
    if (API_CONFIG.STATIC.USE_REMOTE && API_CONFIG.STATIC.BASE_URL) {
        return `${API_CONFIG.STATIC.BASE_URL}/${API_CONFIG.STATIC.PATHS.ROUTE_MAP}`;
    }
    return "/data/routeMap.json";
}

// ── Internal Helpers ───────────────────────────────────────────

export async function getRouteMapData(): Promise<RouteMapData> {
    return routeMapCache.getOrFetch("routeMap", async () => {
        return fetchAPI<RouteMapData>(getRouteMapUrl(), {baseUrl: ""});
    });
}

// ── Public API ─────────────────────────────────────────────────

export async function getRouteMap(): Promise<Record<string, string[]>> {
    const data = await getRouteMapData();
    return Object.fromEntries(
        Object.entries(data.route_numbers).filter(([, ids]) => ids.length > 0)
    );
}

export async function getPolyline(routeKey: string): Promise<GeoPolyline | null> {
    return polylineCache.getOrFetch(routeKey, async () => {
        try {
            return await fetchAPI<GeoPolyline>(getPolylineUrl(routeKey), {baseUrl: ""});
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
    if (!polyline || !polyline.features || polyline.features.length === 0) return null;
    const props = polyline.features[0].properties;
    if (!props || !props.stops) return null;
    const sequence = props.stops.map((s) => ({
        nodeid: s.id, nodeord: s.ord, updowncd: s.ud
    }));
    return {routeno: props.route_no, sequence};
}

export async function getAvailableRoutes(): Promise<string[]> {
    const routes = await getRouteMap();
    return Object.keys(routes);
}
