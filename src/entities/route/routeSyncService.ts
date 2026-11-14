import "server-only";

import {createHash} from "crypto";
import {revalidatePath} from "next/cache";

import {CacheManager, getCachedOrFetch, invalidateCacheByPrefixAsync, setCached} from "@shared/cache";
import {artifactStore} from "@shared/cache/artifactStore";
import {distributedCache} from "@shared/cache/distributedCache";
import {fetchOsrmPolyline, fetchOsrmPolylineWithMeta, getOsrmClientHealth} from "./osrmClient";
import type {GeoPolyline} from "./types";
import {
    calculatePolylineMeters,
    connectTurningPoint,
    findTurningDirection,
    smoothPolylineSpline,
} from "./polylineChunker";

const DEFAULT_CITY_CODE = "32020"; // Wonju
const ROUTES_CRON_STATUS_KEY = "cron:status:routes";
const DEFAULT_SYNC_TIME_BUDGET_MS = 45_000;

interface NormalizedStopInput {
    nodeid: string;
    nodenm: string;
    nodeord: number;
    nodeno: string;
    gpslati: number;
    gpslong: number;
    updowncd: number;
}

/**
 * Deterministic digest of stop sequence & coordinates so incremental route sync
 * can skip unchanged routes without hitting the public OSRM demo server.
 */
export function computeStopsHash(stops: Array<Pick<NormalizedStopInput, "nodeid" | "nodeord" | "updowncd" | "gpslati" | "gpslong">>): string {
    const signature = stops
        .map((s) => `${s.nodeid}:${s.nodeord}:${s.updowncd}:${s.gpslati.toFixed(5)},${s.gpslong.toFixed(5)}`)
        .join("|");
    return createHash("sha1").update(signature).digest("hex").slice(0, 16);
}

// In-flight & L1 cache for generated route polylines
const polylineGenerationCache = new CacheManager<GeoPolyline | null>({
    maxSize: 500,
    ttlMs: 24 * 60 * 60 * 1000, // 24 hours
});

export function getRouteSyncHealth() {
    return {
        ...getOsrmClientHealth(),
        polylineGenerationCacheSize: polylineGenerationCache.size,
    };
}

function hasPublicApiKey(): boolean {
    return Boolean(
        process.env.DATA_GO_KR_SERVICE_KEY?.trim() ||
        process.env.DATA_GO_KR_SERVICE_KEYS?.split(",")[0]?.trim()
    );
}


interface TagoRouteItem {
    routeid: string;
    routeno: string | number;
    routetp?: string;
    startnodenm?: string;
    endnodenm?: string;
}

function calculatePolylineDistanceMeters(coords: [number, number][]): number {
    return calculatePolylineMeters(coords);
}

export interface RouteRefreshOptions {
    routeFilter?: string | null;
    cityCode?: string;
    mode?: "quick" | "full";
    maxRoutes?: number;
    cursor?: number;
    timeBudgetMs?: number;
    force?: boolean;
}

export interface RouteRefreshResult {
    success: boolean;
    refreshed: boolean;
    message: string;
    totalRoutesProcessed: number;
    skippedUnchanged?: number;
    totalCandidates?: number;
    nextCursor?: number | null;
    routesCount: number;
    elapsedMs: number;
}

function normalizeStopItems(rawStops: Array<{
    nodeid?: string;
    nodenm?: string;
    nodeord?: number | string;
    nodeno?: string | number;
    gpslati?: number | string;
    gpslong?: number | string;
    updowncd?: number | string;
}>): NormalizedStopInput[] {
    return rawStops
        .map((s) => ({
            nodeid: String(s.nodeid || ""),
            nodenm: String(s.nodenm || ""),
            nodeord: Number(s.nodeord || 0),
            nodeno: String(s.nodeno || ""),
            gpslati: Number(s.gpslati || 0),
            gpslong: Number(s.gpslong || 0),
            updowncd: Number(s.updowncd ?? 0),
        }))
        .sort((a, b) => a.nodeord - b.nodeord);
}

async function assembleRoutePolyline(params: {
    routeId: string;
    routeNo: string;
    stops: NormalizedStopInput[];
    stopsHash: string;
}): Promise<GeoPolyline | null> {
    const {routeId, routeNo, stops, stopsHash} = params;
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

    if (upCoords.length < 2 && downCoords.length < 2) return null;

    const [upRes, downRes] = await Promise.all([
        upCoords.length >= 2 ? fetchOsrmPolylineWithMeta(upCoords) : Promise.resolve({
            coords: null,
            allFallback: false
        }),
        hasBothDirections && downCoords.length >= 2
            ? fetchOsrmPolylineWithMeta(downCoords)
            : Promise.resolve({coords: null, allFallback: false}),
    ]);

    const snappedUp = upRes.coords;
    const snappedDown = downRes.coords;
    const isFallback =
        (upCoords.length >= 2 && upRes.allFallback) ||
        (hasBothDirections && downCoords.length >= 2 && downRes.allFallback);

    let finalUp = snappedUp && snappedUp.length >= 2 ? snappedUp : smoothPolylineSpline(upCoords);
    let finalDown = hasBothDirections
        ? (snappedDown && snappedDown.length >= 2 ? snappedDown : smoothPolylineSpline(downCoords))
        : finalUp;

    if (hasBothDirections && finalUp.length >= 2 && finalDown.length >= 2) {
        const turningDir = findTurningDirection(stops);
        const connected = await connectTurningPoint(
            finalUp,
            finalDown,
            turningDir,
            fetchOsrmPolyline
        );
        finalUp = connected.upPolyline;
        finalDown = connected.downPolyline;
    }

    const totalDist =
        calculatePolylineDistanceMeters(finalUp) +
        (hasBothDirections ? calculatePolylineDistanceMeters(finalDown) : 0);

    return {
        route_id: routeId,
        route_no: routeNo,
        stops_count: stops.length,
        stops_hash: stopsHash,
        total_dist: Math.round(totalDist),
        up_polyline: finalUp,
        down_polyline: finalDown,
        ...(isFallback ? {is_fallback: true} : {}),
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
}

export async function refreshRouteData(
    options: RouteRefreshOptions = {}
): Promise<RouteRefreshResult> {
    const startTime = Date.now();
    const cityCode = options.cityCode || DEFAULT_CITY_CODE;
    const isQuick = options.mode === "quick";
    const timeBudgetMs = options.timeBudgetMs ?? DEFAULT_SYNC_TIME_BUDGET_MS;

    if (cityCode !== "11" && !hasPublicApiKey()) {
        return {
            success: false,
            refreshed: false,
            message: "DATA_GO_KR_SERVICE_KEY 환경변수가 설정되지 않아 노선 데이터를 갱신할 수 없습니다.",
            totalRoutesProcessed: 0,
            routesCount: 0,
            nextCursor: null,
            elapsedMs: Date.now() - startTime,
        };
    }

    console.log(`[RouteSyncService] Starting route sync (cityCode: ${cityCode}, mode: ${options.mode || "standard"}, cursor: ${options.cursor ?? 0})...`);

    const {fetchCityRoutes, fetchRouteStops} = await import("@entities/bus");

    // 1. Fetch route list via unified TAGO/Seoul client (key rotation + rate limiting + circuit breaker)
    let allRoutes: TagoRouteItem[];
    try {
        allRoutes = await fetchCityRoutes(cityCode);
    } catch (err) {
        console.error("[RouteSyncService] Failed to fetch route list:", err);
        return {
            success: false,
            refreshed: false,
            message: `공공데이터포털 노선 목록 조회 실패: ${err instanceof Error ? err.message : String(err)}`,
            totalRoutesProcessed: 0,
            routesCount: 0,
            nextCursor: options.cursor ?? 0,
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
    } else if (options.maxRoutes && options.maxRoutes > 0 && options.cursor === undefined) {
        targetRoutes = targetRoutes.slice(0, options.maxRoutes);
    }

    const totalCandidates = targetRoutes.length;
    const startCursor = Math.max(0, Math.min(options.cursor ?? 0, totalCandidates));
    const endLimit = options.maxRoutes && options.maxRoutes > 0 && options.cursor !== undefined
        ? Math.min(startCursor + options.maxRoutes, totalCandidates)
        : totalCandidates;

    console.log(`[RouteSyncService] Identified ${totalCandidates} candidate routes (processing [${startCursor}..${endLimit})).`);

    const routeMapping: Record<string, string[]> = {};
    const CONCURRENCY = 3;
    let processedCount = 0;
    let skippedUnchanged = 0;
    let nextCursor: number | null = null;

    // 2. Fetch stops & assemble polylines within execution budget
    for (let i = startCursor; i < endLimit; i += CONCURRENCY) {
        if (i > startCursor && Date.now() - startTime >= timeBudgetMs) {
            nextCursor = i;
            console.warn(`[RouteSyncService] Time budget (${timeBudgetMs}ms) reached; pausing at cursor=${nextCursor}/${endLimit}.`);
            break;
        }

        const chunk = targetRoutes.slice(i, Math.min(i + CONCURRENCY, endLimit));
        await Promise.all(
            chunk.map(async (route) => {
                const routeId = String(route.routeid);
                const routeNo = String(route.routeno);

                try {
                    const stopItems = await fetchRouteStops(routeId, cityCode);
                    if (stopItems.length === 0) return;

                    const stops = normalizeStopItems(stopItems);
                    if (!routeMapping[routeNo]) routeMapping[routeNo] = [];
                    if (!routeMapping[routeNo].includes(routeId)) routeMapping[routeNo].push(routeId);

                    const stopsHash = computeStopsHash(stops);
                    const namespacedKey = `routes/${cityCode}/${routeId}.json`;

                    if (!options.force) {
                        const existing = await artifactStore.getJson<GeoPolyline>(namespacedKey).catch(() => null);
                        if (existing?.data?.stops_hash && existing.data.stops_hash === stopsHash && !existing.data.is_fallback) {
                            skippedUnchanged++;
                            return;
                        }
                    }

                    const polylineData = await assembleRoutePolyline({
                        routeId,
                        routeNo,
                        stops,
                        stopsHash,
                    });
                    if (!polylineData) return;

                    // Do not persist degraded spline-only fallbacks so transient OSRM failures self-heal
                    if (!polylineData.is_fallback) {
                        await artifactStore.putJson(namespacedKey, polylineData, {pretty: false});
                        setCached(`polyline:${cityCode}:${routeId}`, polylineData);
                        void distributedCache.set(
                            `polyline:${cityCode}:${routeId}`,
                            {data: polylineData, timestamp: Date.now()},
                            7 * 86400
                        ).catch(() => false);
                    }

                    processedCount++;
                } catch (err) {
                    console.error(`[RouteSyncService] Error fetching route ${routeNo} (${routeId}):`, err);
                }
            })
        );
    }

    if (nextCursor === null && endLimit < totalCandidates) {
        nextCursor = endLimit;
    }

    // Invalidate stale L1 + Redis caches when routes were rebuilt
    polylineGenerationCache.clear();
    if (processedCount > 0) {
        await invalidateCacheByPrefixAsync(["routes:", "bus-stops:", "route-stops:"]);
    }
    try {
        revalidatePath("/api/route-stops");
    } catch {
        // Silently ignore outside Next.js request context
    }

    const elapsedMs = Date.now() - startTime;
    console.log(
        `[RouteSyncService] Route sync finished in ${elapsedMs}ms (${processedCount} updated, ${skippedUnchanged} unchanged, nextCursor=${nextCursor}).`
    );

    await distributedCache.set(ROUTES_CRON_STATUS_KEY, {
        ok: true,
        cityCode,
        mode: options.mode || "standard",
        updatedAt: new Date().toISOString(),
        totalRoutesProcessed: processedCount,
        skippedUnchanged,
        totalCandidates,
        nextCursor,
        elapsedMs,
    }, 14 * 24 * 60 * 60).catch(() => false);

    return {
        success: true,
        refreshed: processedCount > 0,
        message: `${processedCount}개 노선 갱신 완료 (${skippedUnchanged}개 변경 없음 스킵).`,
        totalRoutesProcessed: processedCount,
        skippedUnchanged,
        totalCandidates,
        nextCursor,
        routesCount: Object.keys(routeMapping).length,
        elapsedMs,
    };
}

/**
 * On-demand polyline generator for routes across South Korea.
 * Fetches route through-stations from TAGO (with L1 cache), snaps with OSRM (with chunk cache + concurrency),
 * saves to /tmp/routes/, and returns GeoPolyline with in-flight request deduplication.
 */
export async function generateSingleRoutePolyline(
    routeId: string,
    cityCode = DEFAULT_CITY_CODE,
    routeNo?: string
): Promise<GeoPolyline | null> {
    const cacheKey = `${cityCode}:${routeId}`;
    return polylineGenerationCache.getOrFetch(cacheKey, async () => {
        try {
            // 0. For Seoul ("11"), use official TOPIS road-snapped polyline & stop sequence directly
            if (cityCode === "11") {
                try {
                    const {fetchSeoulRoutePolyline} = await import("@entities/bus");
                    const seoulPolyline = await fetchSeoulRoutePolyline(routeId, routeNo);
                    if (seoulPolyline && seoulPolyline.stops?.length) {
                        setCached(`polyline:${cityCode}:${routeId}`, seoulPolyline);
                        void distributedCache.set(
                            `polyline:${cityCode}:${routeId}`,
                            {data: seoulPolyline, timestamp: Date.now()},
                            7 * 86400
                        ).catch(() => false);
                        return seoulPolyline;
                    }
                } catch {
                    // Fall through to generic stop + OSRM pipeline
                }
            }

            let stops: NormalizedStopInput[] = [];

            // 1. Fetch route through-stations via unified transit client (with L1 + Redis cache)
            try {
                const {fetchRouteStops, getCachedCityRoutes} = await import("@entities/bus");
                const cachedStops = await getCachedOrFetch(
                    `bus-stops:${cityCode}:${routeId}`,
                    () => fetchRouteStops(routeId, cityCode),
                    {
                        ttlSeconds: 3600,
                        staleWhileRevalidateSeconds: 86400,
                        staleIfErrorSeconds: 86400,
                        shouldCache: (items) => Array.isArray(items) && items.length > 0,
                        useDistributedCache: true,
                    }
                );
                const rawStops = cachedStops.data;
                if (rawStops && rawStops.length > 0) {
                    stops = normalizeStopItems(rawStops);
                }

                // Enrich route_no from city route directory if caller omitted it
                if (!routeNo) {
                    const cityRoutes = await getCachedCityRoutes(cityCode);
                    const matched = cityRoutes.data?.find((r) => r.routeid === routeId);
                    if (matched?.routeno) {
                        routeNo = String(matched.routeno);
                    }
                }
            } catch {
                // Handled below if stops remain empty
            }

            if (stops.length === 0) return null;

            const stopsHash = computeStopsHash(stops);
            const polylineData = await assembleRoutePolyline({
                routeId,
                routeNo: routeNo || routeId,
                stops,
                stopsHash,
            });
            if (!polylineData) return null;

            // Only persist road-snapped polylines; skip durable caching if OSRM fell back to spline
            if (!polylineData.is_fallback) {
                setCached(`polyline:${cityCode}:${routeId}`, polylineData);
                void distributedCache.set(
                    `polyline:${cityCode}:${routeId}`,
                    {data: polylineData, timestamp: Date.now()},
                    7 * 86400
                ).catch(() => false);

                // Persist minified GeoPolyline under namespaced /tmp + Vercel Blob key
                await artifactStore.putJson(`routes/${cityCode}/${routeId}.json`, polylineData, {pretty: false});
            }

            return polylineData;
        } catch (err) {
            console.error(`[RouteSyncService] Failed to generate polyline for ${routeId}:`, err);
            return null;
        }
    }).then((result) => {
        if (!result || result.is_fallback) {
            polylineGenerationCache.delete(cacheKey);
        }
        return result;
    });
}
