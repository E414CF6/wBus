import "server-only";

import {createHash} from "crypto";
import {OsrmRouteResponseSchema} from "@shared/api/schemas";
import {fetchWithRetry, SharedCircuitBreaker} from "@shared/api/upstreamClient";
import {CacheManager} from "@shared/cache";
import {distributedCache} from "@shared/cache/distributedCache";
import {mapWithConcurrencyLimit} from "@shared/utils/concurrency";
import {
    calculatePolylineMeters,
    chunkCoordinates,
    isExcessiveDetour,
    smoothPolylineSpline,
    stitchPolylineSegments,
} from "./polylineChunker";

const DEFAULT_OSRM_URL = process.env.OSRM_API_URL || "https://router.project-osrm.org/route/v1/driving";
const OSRM_CHUNK_SIZE = 18;
const OSRM_DETOUR_TTL_MS = 15 * 60 * 1000;
const OSRM_REDIS_TTL_SECONDS = 7 * 24 * 60 * 60;

function hashCoordsChunk(coordsStr: string): string {
    return createHash("sha1").update(coordsStr).digest("hex").slice(0, 16);
}

const osrmBreaker = new SharedCircuitBreaker("OSRM", 5, 20_000);

const osrmChunkCache = new CacheManager<[number, number][] | null>({
    maxSize: 1500,
    ttlMs: 7 * 24 * 60 * 60 * 1000,
});

export function getOsrmClientHealth() {
    return {
        osrmCircuit: osrmBreaker.getState(),
        osrmChunkCacheSize: osrmChunkCache.size,
    };
}

export async function fetchOsrmSingleChunk(chunk: [number, number][]): Promise<[number, number][] | null> {
    if (chunk.length < 2) return null;
    const coordsStr = chunk.map((c) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`).join(";");
    const redisKey = `osrm:chunk:${hashCoordsChunk(coordsStr)}`;

    let hadNetworkError = false;
    let hadDetour = false;
    const result = await osrmChunkCache.getOrFetch(coordsStr, async () => {
        const redisCached = await distributedCache.get<[number, number][]>(redisKey, 300).catch(() => null);
        if (Array.isArray(redisCached) && redisCached.length >= 2) {
            return redisCached;
        }

        try {
            const radiuses = chunk.map(() => 45).join(";");
            const url = `${DEFAULT_OSRM_URL}/${coordsStr}?overview=full&geometries=geojson&steps=false&continue_straight=false&radiuses=${radiuses}`;
            const res = await fetchWithRetry(url, {
                headers: {"User-Agent": "wBus-Transit-Pipeline/2.0"},
                timeoutMs: 5000,
                maxAttempts: 2,
                circuitBreaker: osrmBreaker,
            });
            if (res.ok) {
                const rawJson = await res.json();
                const parsed = OsrmRouteResponseSchema.safeParse(rawJson);
                const routeCoords = parsed.success ? parsed.data.routes?.[0]?.geometry?.coordinates : undefined;
                if (Array.isArray(routeCoords) && routeCoords.length >= 2) {
                    const straightDist = calculatePolylineMeters(chunk);
                    const routedDist = calculatePolylineMeters(routeCoords);
                    if (isExcessiveDetour(straightDist, routedDist)) {
                        console.warn(
                            `[RouteSyncService] OSRM detour detected (${routedDist.toFixed(0)}m vs straight ${straightDist.toFixed(0)}m). Falling back to smoothed spline.`
                        );
                        hadDetour = true;
                        return null;
                    }
                    void distributedCache.set(redisKey, routeCoords, OSRM_REDIS_TTL_SECONDS).catch(() => false);
                    return routeCoords;
                }
            } else {
                hadNetworkError = true;
            }
        } catch {
            hadNetworkError = true;
        }
        return null;
    });

    if (hadNetworkError && result === null) {
        osrmChunkCache.delete(coordsStr);
    } else if (hadDetour && result === null) {
        osrmChunkCache.set(coordsStr, null, OSRM_DETOUR_TTL_MS);
    }
    return result;
}

export interface OsrmPolylineResult {
    coords: [number, number][] | null;
    allFallback: boolean;
}

export async function fetchOsrmPolylineWithMeta(coords: [number, number][]): Promise<OsrmPolylineResult> {
    if (coords.length < 2) return {coords: null, allFallback: false};

    if (coords.length <= OSRM_CHUNK_SIZE) {
        const single = await fetchOsrmSingleChunk(coords);
        if (single && single.length >= 2) {
            return {coords: single, allFallback: false};
        }
        return {coords: smoothPolylineSpline(coords), allFallback: true};
    }

    const chunks = chunkCoordinates(coords, OSRM_CHUNK_SIZE);
    let osrmSuccessCount = 0;
    const settled = await mapWithConcurrencyLimit(
        chunks,
        async (chunk) => {
            const snapped = await fetchOsrmSingleChunk(chunk);
            if (snapped && snapped.length >= 2) {
                osrmSuccessCount++;
                return snapped;
            }
            return smoothPolylineSpline(chunk);
        },
        {concurrency: 3, staggerMs: 20}
    );

    const segments: [number, number][][] = settled.map((res, idx) =>
        res.status === "fulfilled" && res.value ? res.value : smoothPolylineSpline(chunks[idx])
    );

    const stitched = stitchPolylineSegments(segments);
    return {
        coords: stitched.length >= 2 ? stitched : coords,
        allFallback: osrmSuccessCount === 0,
    };
}

export async function fetchOsrmPolyline(coords: [number, number][]): Promise<[number, number][] | null> {
    const result = await fetchOsrmPolylineWithMeta(coords);
    return result.coords;
}
