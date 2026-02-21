import { fetchAPI, HttpError } from "@core/network/fetchAPI";
import { CacheManager } from "@core/cache/CacheManager";

import { API_CONFIG, APP_CONFIG } from "@core/config/env";

import type {
    GeoPolyline,
    BusStop,
    StationLocation,
    RouteDetail,
    RouteInfo,
    RouteMapData,
    StationMapData
} from "@core/domain";

/**
 * Cache Managers
 */
const routeMapCache = new CacheManager<RouteMapData>();
const stationMapCache = new CacheManager<StationMapData>();
const polylineCache = new CacheManager<GeoPolyline | null>();

/**
 * Build URL for polyline data based on remote/local mode
 */
function getPolylineUrl(routeKey: string): string {
    if (API_CONFIG.STATIC.USE_REMOTE && API_CONFIG.STATIC.BASE_URL) {
        return `${API_CONFIG.STATIC.BASE_URL}/${API_CONFIG.STATIC.PATHS.POLYLINES}/${routeKey}.geojson`;
    }
    return `/data/polylines/${routeKey}.geojson`;
}

/**
 * Build URL for route map based on remote/local mode
 */
function getRouteMapUrl(): string {
    if (API_CONFIG.STATIC.USE_REMOTE && API_CONFIG.STATIC.BASE_URL) {
        return `${API_CONFIG.STATIC.BASE_URL}/${API_CONFIG.STATIC.PATHS.ROUTE_MAP}`;
    }
    return "/data/routeMap.json";
}

function getStationMapUrl(): string {
    if (API_CONFIG.STATIC.USE_REMOTE && API_CONFIG.STATIC.BASE_URL) {
        return `${API_CONFIG.STATIC.BASE_URL}/${API_CONFIG.STATIC.PATHS.STATION_MAP}`;
    }
    return "/data/stationMap.json";
}

async function getRouteMapData(): Promise<RouteMapData> {
    return routeMapCache.getOrFetch("routeMap", async () => {
        return fetchAPI<RouteMapData>(getRouteMapUrl(), { baseUrl: "" });
    });
}

async function getStationMapData(): Promise<StationMapData> {
    return stationMapCache.getOrFetch("stationMap", async () => {
        return fetchAPI<StationMapData>(getStationMapUrl(), { baseUrl: "" });
    });
}

/**
 * Fetches and caches the routeMap.json data.
 * This function ensures only one fetch request is made even if called multiple times.
 * @returns A promise that resolves to a map of route names to vehicle IDs (excludes empty routes)
 */
export async function getRouteMap(): Promise<Record<string, string[]>> {
    const data = await getRouteMapData();
    // Filter out routes with empty vehicle IDs (e.g., "Shuttle": [])
    return Object.fromEntries(
        Object.entries(data.route_numbers).filter(([, ids]) => ids.length > 0)
    );
}

/**
 * Fetch the polyline geojson file for the provided key and cache the result.
 * The key should follow the naming scheme `${routeId}` to target
 * a specific route variant (falls back to `${routeName}` if no ID is provided).
 *
 * @param routeKey - filename-friendly key (ex: "30_WJB251000068")
 * @returns {Promise<GeoPolyline | null>} - GeoJSON Data or null if not found
 */
export async function getPolyline(
    routeKey: string
): Promise<GeoPolyline | null> {
    return polylineCache.getOrFetch(routeKey, async () => {
        try {
            return await fetchAPI<GeoPolyline>(getPolylineUrl(routeKey), {
                baseUrl: "",
            });
        } catch (error) {
            // Gracefully handle missing polyline files (404 errors)
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

/**
 * Fetches station location data from \`stationMap.json\`.
 * This data is cached to minimize redundant fetch requests.
 * Maps the station key (nodeid) from the object key to the nodeid property.
 * @returns A promise that resolves to an array of station items
 */
export async function getBusStopLocationData(): Promise<BusStop[]> {
    const data = await getStationMapData();
    // Map the station key (nodeid) from object keys to the nodeid property
    return Object.entries(data.stations).map(([nodeid, station]) => ({
        ...station,
        nodeid,
    }));
}

/**
 * Fetches the station map keyed by nodeid.
 * Useful for lookup-heavy operations that only need coordinates.
 */
export async function getStationMap(): Promise<Record<string, StationLocation>> {
    const data = await getStationMapData();
    return data.stations;
}

/**
 * Fetches route-specific stops by joining route polyline features with station metadata.
 */
export async function getRouteStopsByRouteName(
    routeName: string
): Promise<BusStop[]> {
    const routeMapData = await getRouteMapData();
    const routeIds = routeMapData.route_numbers[routeName] ?? [];

    if (routeIds.length === 0) return [];

    const stationMapData = await getStationMapData();
    const stationMap = stationMapData.stations;

    const stopMap = new Map<string, BusStop>();

    // Fetch details for all route variants concurrently
    const routeDetailsList = await Promise.all(
        routeIds.map((routeId) => getRouteDetails(routeId))
    );

    routeDetailsList.forEach((detail) => {
        if (!detail?.sequence) return;

        detail.sequence.forEach((stop) => {
            const station = stationMap[stop.nodeid];
            if (!station) return;

            const key = `${stop.nodeid}-${stop.updowncd ?? ""}`;
            if (stopMap.has(key)) return;

            stopMap.set(key, {
                ...station,
                nodeid: stop.nodeid,
                nodeord: stop.nodeord,
                updowncd: stop.updowncd,
            });
        });
    });

    return Array.from(stopMap.values());
}

/**
 * Returns a list of available route names (only routes with vehicle IDs).
 */
export async function getAvailableRoutes(): Promise<string[]> {
    const routes = await getRouteMap();
    return Object.keys(routes);
}

/**
 * Returns a RouteInfo object for the given route name.
 * @param routeName - The name of the route (e.g., "30", "34")
 * @returns A promise that resolves to RouteInfo or null if not found
 */
export async function getRouteInfo(
    routeName: string
): Promise<RouteInfo | null> {
    try {
        const map = await getRouteMap();
        const routeIds = map[routeName];

        if (!routeIds?.length) {
            if (APP_CONFIG.IS_DEV) {
                console.warn(`[getRouteInfo] Route missing: ${routeName}`);
            }

            return null;
        }

        return {
            routeName,
            vehicleRouteIds: routeIds,
        };
    } catch (err) {
        if (APP_CONFIG.IS_DEV) {
            console.error(`[getRouteInfo] Route missing: ${routeName}`, err);
        }

        return null;
    }
}

/**
 * Fetches route detail information including sequence data from its polyline GeoJSON.
 * @param routeId - The ID of the route (e.g., "WJB251000068")
 * @returns A promise that resolves to RouteDetail or null if not found
 */
export async function getRouteDetails(
    routeId: string
): Promise<RouteDetail | null> {
    const polyline = await getPolyline(routeId);
    if (!polyline || !polyline.features || polyline.features.length === 0) return null;

    const props = polyline.features[0].properties;
    if (!props || !props.stops) return null;

    const sequence = props.stops.map((s) => ({
        nodeid: s.id,
        nodeord: s.ord,
        updowncd: s.ud
    }));

    return {
        routeno: props.route_no,
        sequence
    };
}
