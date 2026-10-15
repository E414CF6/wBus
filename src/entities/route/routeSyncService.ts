import "server-only";

import fs from "fs";
import path from "path";
import {revalidatePath} from "next/cache";

import {invalidateRouteCaches} from "./api";
import type {GeoPolyline, RouteMapData} from "./types";
import type {StationLocation} from "@entities/station/types";

const DEFAULT_CITY_CODE = "32020"; // Wonju
const DEFAULT_TAGO_URL = "https://apis.data.go.kr/1613000/BusRouteInfoInqireService";
const DEFAULT_OSRM_URL = process.env.OSRM_API_URL || "https://router.project-osrm.org/route/v1/driving";

function getServiceKey(): string | null {
    return process.env.DATA_GO_KR_SERVICE_KEY || process.env.DATA_GO_KR_SERVICE_KEYS?.split(",")[0] || null;
}

async function fetchOsrmPolyline(coords: [number, number][]): Promise<[number, number][] | null> {
    if (coords.length < 2) return null;
    try {
        const coordsStr = coords.map((c) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`).join(";");
        const radiuses = coords.map(() => 25).join(";");
        const url = `${DEFAULT_OSRM_URL}/${coordsStr}?overview=full&geometries=geojson&steps=false&continue_straight=true&radiuses=${radiuses}`;
        const res = await fetch(url, {
            headers: {"User-Agent": "wBus-Transit-Pipeline/2.0"},
            signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
            const json = await res.json();
            const routeCoords = json?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
            if (Array.isArray(routeCoords) && routeCoords.length >= coords.length) {
                return routeCoords;
            }
        }
    } catch {
        // Fallback to raw coords
    }
    return null;
}


interface TagoRouteItem {
    routeid: string;
    routeno: string | number;
    routetp?: string;
    startnodenm?: string;
    endnodenm?: string;
}

interface TagoStopItem {
    nodeid: string;
    nodenm: string;
    nodeord: number;
    nodeno?: string | number;
    gpslati: number;
    gpslong: number;
    updowncd?: number;
}

async function fetchTago<T>(endpoint: string, params: Record<string, string | number>): Promise<T[]> {
    const serviceKey = getServiceKey();
    if (!serviceKey) {
        throw new Error("DATA_GO_KR_SERVICE_KEY 환경변수가 설정되지 않았습니다.");
    }

    const url = new URL(`${DEFAULT_TAGO_URL}/${endpoint}`);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("_type", "json");
    for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, String(v));
    }

    const res = await fetch(url.toString(), {
        headers: {"User-Agent": "wBus-Polly/2.0"},
        signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
        throw new Error(`TAGO API HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    const items = json?.response?.body?.items?.item;
    if (!items) return [];
    return Array.isArray(items) ? items : [items];
}

function calculateHaversineMeters(p1: [number, number], p2: [number, number]): number {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(p2[1] - p1[1]);
    const dLon = toRad(p2[0] - p1[0]);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(p1[1])) * Math.cos(toRad(p2[1])) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculatePolylineDistanceMeters(coords: [number, number][]): number {
    let total = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        total += calculateHaversineMeters(coords[i], coords[i + 1]);
    }
    return total;
}

export interface RouteRefreshOptions {
    routeFilter?: string | null;
    cityCode?: string;
    mode?: "quick" | "full";
    maxRoutes?: number;
}

export interface RouteRefreshResult {
    success: boolean;
    refreshed: boolean;
    message: string;
    totalRoutesProcessed: number;
    routesCount: number;
    elapsedMs: number;
}

export async function refreshRouteData(
    options: RouteRefreshOptions = {}
): Promise<RouteRefreshResult> {
    const startTime = Date.now();
    const cityCode = options.cityCode || DEFAULT_CITY_CODE;
    const isQuick = options.mode === "quick";

    const serviceKey = getServiceKey();
    if (!serviceKey) {
        return {
            success: false,
            refreshed: false,
            message: "DATA_GO_KR_SERVICE_KEY 환경변수가 설정되지 않아 노선 데이터를 갱신할 수 없습니다.",
            totalRoutesProcessed: 0,
            routesCount: 0,
            elapsedMs: Date.now() - startTime,
        };
    }

    console.log(`[RouteSyncService] Starting route sync (cityCode: ${cityCode}, mode: ${options.mode || "standard"})...`);

    // 1. Fetch route list from TAGO
    let allRoutes: TagoRouteItem[] = [];
    try {
        allRoutes = await fetchTago<TagoRouteItem>("getRouteNoList", {
            cityCode,
            numOfRows: 2048,
            pageNo: 1,
        });
    } catch (err) {
        console.error("[RouteSyncService] Failed to fetch route list:", err);
        return {
            success: false,
            refreshed: false,
            message: `공공데이터포털 노선 목록 조회 실패: ${err instanceof Error ? err.message : String(err)}`,
            totalRoutesProcessed: 0,
            routesCount: 0,
            elapsedMs: Date.now() - startTime,
        };
    }

    let targetRoutes = allRoutes.filter((r) => {
        const routeNo = String(r.routeno || "");
        if (!routeNo || routeNo === "UNKNOWN") return false;
        if (options.routeFilter && routeNo !== options.routeFilter) return false;
        return true;
    });

    if (isQuick) {
        // In quick mode, prioritize key Yonsei and main arterial routes
        const priorityRoutes = ["30", "34", "34-1", "2", "2-1", "100", "51"];
        targetRoutes = targetRoutes.filter((r) => priorityRoutes.includes(String(r.routeno)));
    } else if (options.maxRoutes && options.maxRoutes > 0) {
        targetRoutes = targetRoutes.slice(0, options.maxRoutes);
    }

    console.log(`[RouteSyncService] Identified ${targetRoutes.length} routes to process.`);

    const routeMapping: Record<string, string[]> = {};
    const allStopsMap: Record<string, StationLocation> = {};
    const CONCURRENCY = 3;
    let processedCount = 0;

    // Load existing routeMap if exists to preserve non-processed routes
    try {
        const existingRouteMapPath = path.join(process.cwd(), "public", "routeMap.json");
        if (fs.existsSync(existingRouteMapPath)) {
            const parsed = JSON.parse(fs.readFileSync(existingRouteMapPath, "utf-8")) as RouteMapData;
            if (parsed.route_numbers) {
                Object.assign(routeMapping, parsed.route_numbers);
            }
        }
    } catch {
        // Ignore parse error
    }

    // Load existing stationMap if exists
    try {
        const existingStationMapPath = path.join(process.cwd(), "public", "stationMap.json");
        if (fs.existsSync(existingStationMapPath)) {
            const parsed = JSON.parse(fs.readFileSync(existingStationMapPath, "utf-8")) as {
                stations?: Record<string, StationLocation>;
            };
            if (parsed.stations) {
                Object.assign(allStopsMap, parsed.stations);
            }
        }
    } catch {
        // Ignore parse error
    }

    // 2. Fetch stops & assemble polylines
    for (let i = 0; i < targetRoutes.length; i += CONCURRENCY) {
        const chunk = targetRoutes.slice(i, i + CONCURRENCY);
        await Promise.all(
            chunk.map(async (route) => {
                const routeId = String(route.routeid);
                const routeNo = String(route.routeno);

                try {
                    const stopItems = await fetchTago<TagoStopItem>("getRouteAcctoThrghSttnList", {
                        cityCode,
                        routeId,
                        numOfRows: 2048,
                    });

                    if (stopItems.length === 0) return;

                    const stops = stopItems
                        .map((item) => ({
                            nodeid: String(item.nodeid || ""),
                            nodenm: String(item.nodenm || ""),
                            nodeord: Number(item.nodeord || 0),
                            nodeno: String(item.nodeno || ""),
                            gpslati: Number(item.gpslati || 0),
                            gpslong: Number(item.gpslong || 0),
                            updowncd: Number(item.updowncd ?? 0),
                        }))
                        .sort((a, b) => a.nodeord - b.nodeord);

                    if (!routeMapping[routeNo]) routeMapping[routeNo] = [];
                    if (!routeMapping[routeNo].includes(routeId)) routeMapping[routeNo].push(routeId);

                    stops.forEach((s) => {
                        allStopsMap[s.nodeid] = {
                            nodenm: s.nodenm,
                            nodeno: s.nodeno,
                            gpslati: s.gpslati,
                            gpslong: s.gpslong,
                        };
                    });

                    // Build UP and DOWN polylines with OSRM road snapping (fallback to straight-lines)
                    const upCoords: [number, number][] = stops
                        .filter((s) => s.updowncd === 1 && s.gpslong > 0 && s.gpslati > 0)
                        .map((s) => [s.gpslong, s.gpslati]);
                    const downCoords: [number, number][] = stops
                        .filter((s) => s.updowncd === 0 && s.gpslong > 0 && s.gpslati > 0)
                        .map((s) => [s.gpslong, s.gpslati]);

                    const [snappedUp, snappedDown] = await Promise.all([
                        fetchOsrmPolyline(upCoords),
                        fetchOsrmPolyline(downCoords),
                    ]);

                    const finalUp = snappedUp && snappedUp.length >= 2 ? snappedUp : upCoords;
                    const finalDown = snappedDown && snappedDown.length >= 2 ? snappedDown : downCoords;

                    const totalDist =
                        calculatePolylineDistanceMeters(finalUp) +
                        calculatePolylineDistanceMeters(finalDown);

                    const polylineData: GeoPolyline = {
                        route_id: routeId,
                        route_no: routeNo,
                        stops_count: stops.length,
                        total_dist: Math.round(totalDist),
                        up_polyline: finalUp,
                        down_polyline: finalDown,
                        stops: stops.map((s) => ({
                            id: s.nodeid,
                            name: s.nodenm,
                            ord: s.nodeord,
                            ud: s.updowncd,
                            lat: s.gpslati,
                            lon: s.gpslong,
                            nodeno: s.nodeno,
                        })),
                    };

                    // Save route JSON to /tmp/routes/{routeId}.json
                    const tmpRouteDir = "/tmp/routes";
                    if (!fs.existsSync(tmpRouteDir)) {
                        fs.mkdirSync(tmpRouteDir, {recursive: true});
                    }
                    fs.writeFileSync(
                        path.join(tmpRouteDir, `${routeId}.json`),
                        JSON.stringify(polylineData, null, 2),
                        "utf-8"
                    );

                    // If writable local dev environment, also save to public/routes/
                    if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
                        const localRouteDir = path.join(process.cwd(), "public", "routes");
                        if (!fs.existsSync(localRouteDir)) {
                            fs.mkdirSync(localRouteDir, {recursive: true});
                        }
                        fs.writeFileSync(
                            path.join(localRouteDir, `${routeId}.json`),
                            JSON.stringify(polylineData, null, 2),
                            "utf-8"
                        );
                    }

                    processedCount++;
                } catch (err) {
                    console.error(`[RouteSyncService] Error fetching route ${routeNo} (${routeId}):`, err);
                }
            })
        );
    }

    const timestamp = new Date().toISOString();
    const routeMapData: RouteMapData = {
        lastUpdated: timestamp,
        route_numbers: routeMapping,
    };
    const stationMapData = {
        lastUpdated: timestamp,
        stations: allStopsMap,
    };

    // Save consolidated maps to /tmp
    try {
        fs.writeFileSync("/tmp/routeMap.json", JSON.stringify(routeMapData, null, 2), "utf-8");
        fs.writeFileSync("/tmp/stationMap.json", JSON.stringify(stationMapData, null, 2), "utf-8");
    } catch (e) {
        console.warn("[RouteSyncService] Failed writing to /tmp:", e);
    }

    // Also update public/ in writable environments
    if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
        try {
            const pubDir = path.join(process.cwd(), "public");
            fs.writeFileSync(path.join(pubDir, "routeMap.json"), JSON.stringify(routeMapData, null, 2), "utf-8");
            fs.writeFileSync(path.join(pubDir, "stationMap.json"), JSON.stringify(stationMapData, null, 2), "utf-8");
        } catch {
            // Ignore write errors in read-only setups
        }
    }

    // Invalidate caches
    invalidateRouteCaches();
    try {
        revalidatePath("/api/route-stops");
        revalidatePath("/map");
        revalidatePath("/live");
    } catch {
        // Silently ignore outside Next.js request context
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`[RouteSyncService] Route sync finished in ${elapsedMs}ms (${processedCount} routes updated).`);

    return {
        success: true,
        refreshed: processedCount > 0,
        message: `${processedCount}개 노선 및 정류장 데이터셋을 성공적으로 갱신했습니다.`,
        totalRoutesProcessed: processedCount,
        routesCount: Object.keys(routeMapping).length,
        elapsedMs,
    };
}

/**
 * On-demand polyline generator for non-Wonju routes across South Korea.
 * Fetches route through-stations from TAGO, snaps with OSRM, saves to /tmp/routes/, and returns GeoPolyline.
 */
export async function generateSingleRoutePolyline(
    routeId: string,
    cityCode = DEFAULT_CITY_CODE,
    routeNo?: string
): Promise<GeoPolyline | null> {
    try {
        const stopItems = await fetchTago<TagoStopItem>("getRouteAcctoThrghSttnList", {
            cityCode,
            routeId,
            numOfRows: 2048,
        });

        if (!stopItems || stopItems.length === 0) return null;

        const stops = stopItems
            .map((item) => ({
                nodeid: String(item.nodeid || ""),
                nodenm: String(item.nodenm || ""),
                nodeord: Number(item.nodeord || 0),
                nodeno: String(item.nodeno || ""),
                gpslati: Number(item.gpslati || 0),
                gpslong: Number(item.gpslong || 0),
                updowncd: Number(item.updowncd ?? 0),
            }))
            .sort((a, b) => a.nodeord - b.nodeord);

        const hasBothDirections =
            stops.some((s) => s.updowncd === 1) && stops.some((s) => s.updowncd === 0);

        let upCoords: [number, number][];
        let downCoords: [number, number][];

        if (hasBothDirections) {
            upCoords = stops
                .filter((s) => s.updowncd === 1 && s.gpslong > 0 && s.gpslati > 0)
                .map((s) => [s.gpslong, s.gpslati]);
            downCoords = stops
                .filter((s) => s.updowncd === 0 && s.gpslong > 0 && s.gpslati > 0)
                .map((s) => [s.gpslong, s.gpslati]);
        } else {
            const allCoords: [number, number][] = stops
                .filter((s) => s.gpslong > 0 && s.gpslati > 0)
                .map((s) => [s.gpslong, s.gpslati]);
            upCoords = allCoords;
            downCoords = allCoords;
        }

        const [snappedUp, snappedDown] = await Promise.all([
            fetchOsrmPolyline(upCoords),
            hasBothDirections ? fetchOsrmPolyline(downCoords) : Promise.resolve(null),
        ]);

        const finalUp = snappedUp && snappedUp.length >= 2 ? snappedUp : upCoords;
        const finalDown = hasBothDirections
            ? snappedDown && snappedDown.length >= 2
                ? snappedDown
                : downCoords
            : finalUp;

        const totalDist =
            calculatePolylineDistanceMeters(finalUp) +
            (hasBothDirections ? calculatePolylineDistanceMeters(finalDown) : 0);

        const polylineData: GeoPolyline = {
            route_id: routeId,
            route_no: routeNo || routeId,
            stops_count: stops.length,
            total_dist: Math.round(totalDist),
            up_polyline: finalUp,
            down_polyline: finalDown,
            stops: stops.map((s) => ({
                id: s.nodeid,
                name: s.nodenm,
                ord: s.nodeord,
                ud: s.updowncd,
                lat: s.gpslati,
                lon: s.gpslong,
                nodeno: s.nodeno,
            })),
        };

        // Cache in /tmp/routes/{routeId}.json
        try {
            const tmpDir = "/tmp/routes";
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, {recursive: true});
            }
            fs.writeFileSync(path.join(tmpDir, `${routeId}.json`), JSON.stringify(polylineData), "utf-8");
        } catch {
            // Read-only filesystem fallback
        }

        return polylineData;
    } catch (err) {
        console.error(`[RouteSyncService] Failed to generate polyline for ${routeId}:`, err);
        return null;
    }
}
