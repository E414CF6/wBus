import {type NextRequest, NextResponse} from "next/server";
import {getCityBoundaryErrorMessage} from "@entities/city";
import {ApiValidators} from "@shared/api";
import {type CachedData, distributedCache, peekCached, setCached} from "@shared/cache";
import {artifactStore} from "@shared/cache/artifactStore";
import {generateSingleRoutePolyline} from "@entities/route/routeSyncService";
import type {GeoPolyline} from "@entities/route/types";

export const dynamic = "force-dynamic";

const CACHE_CONTROL_HEADER =
    "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000, stale-if-error=2592000";

const POLYLINE_TTL_SECONDS = 86400; // 24 hours in L1 memory

/**
 * GET /api/polyline/[routeId]?cityCode=...&routeNo=...
 * Returns the full GeoPolyline object for any city in South Korea.
 * 1. Checks L1 in-memory cache for sub-millisecond response
 * 2. Checks local filesystem (public/routes or /tmp/routes) and warms L1 cache
 * 3. On-demand generates road-snapped polyline using TAGO stations + OSRM chunked pipeline
 * 4. Falls back to smooth spline geometry if road-snapping detours or fails
 */
export async function GET(
    request: NextRequest,
    {params}: { params: Promise<{ routeId: string }> }
) {
    const {routeId} = await params;
    if (!routeId || !ApiValidators.isValidRouteId(routeId)) {
        return NextResponse.json({error: "Invalid routeId parameter"}, {status: 400});
    }

    const {searchParams} = request.nextUrl;
    const cityCode = ApiValidators.resolveCityCode(searchParams.get("cityCode"));
    const routeNo = searchParams.get("routeNo") || undefined;

    // Boundary check: Wonju (32020) and Hoengseong (32320)
    const boundaryError = getCityBoundaryErrorMessage(cityCode, routeId);
    if (boundaryError) {
        return NextResponse.json({error: boundaryError}, {status: 404});
    }

    const cacheKey = `polyline:${cityCode}:${routeId}`;

    // 1. Check L1 In-Memory Cache
    const memCached = peekCached<GeoPolyline>(cacheKey, POLYLINE_TTL_SECONDS);
    if (memCached?.data && !memCached.data.is_fallback) {
        return NextResponse.json(memCached.data, {
            status: 200,
            headers: {
                "Cache-Control": CACHE_CONTROL_HEADER,
                "X-Cache-Status": "hit",
                "X-Cache-Layer": "memory",
            },
        });
    }

    // 1b. Check L2 Redis Cache
    try {
        const l2 = await distributedCache.get<CachedData<GeoPolyline>>(cacheKey, 350);
        if (l2?.data && !l2.data.is_fallback && Array.isArray(l2.data.stops) && l2.data.stops.length > 0) {
            setCached(cacheKey, l2.data);
            return NextResponse.json(l2.data, {
                status: 200,
                headers: {
                    "Cache-Control": CACHE_CONTROL_HEADER,
                    "X-Cache-Status": "hit",
                    "X-Cache-Layer": "redis",
                },
            });
        }
    } catch {
        // Continue to artifactStore
    }

    // 2. Check /tmp, Vercel Blob (namespaced first, then legacy key), and bundled public/routes/
    try {
        const stored =
            (await artifactStore.getJson<GeoPolyline>(`routes/${cityCode}/${routeId}.json`)) ??
            (await artifactStore.getJson<GeoPolyline>(`routes/${routeId}.json`));
        if (stored?.data && !stored.data.is_fallback && Array.isArray(stored.data.stops) && stored.data.stops.length > 0) {
            setCached(cacheKey, stored.data);
            void distributedCache.set(cacheKey, {data: stored.data, timestamp: Date.now()}, 7 * 86400);
            return NextResponse.json(stored.data, {
                status: 200,
                headers: {
                    "Cache-Control": CACHE_CONTROL_HEADER,
                    "X-Cache-Status": "hit",
                    "X-Cache-Layer": stored.source === "blob" ? "blob" : "disk",
                },
            });
        }
    } catch {
        // Continue to generator
    }

    // 3. Generate on-demand via OSRM + TAGO (with request deduplication)
    try {
        const polyline = await generateSingleRoutePolyline(routeId, cityCode, routeNo);
        if (polyline) {
            if (polyline.is_fallback) {
                return NextResponse.json(polyline, {
                    status: 200,
                    headers: {
                        "Cache-Control": "no-store, max-age=0",
                        "X-Cache-Status": "bypass",
                        "X-Cache-Layer": "fallback",
                    },
                });
            }
            setCached(cacheKey, polyline);
            void distributedCache.set(cacheKey, {data: polyline, timestamp: Date.now()}, 7 * 86400);
            return NextResponse.json(polyline, {
                status: 200,
                headers: {
                    "Cache-Control": CACHE_CONTROL_HEADER,
                    "X-Cache-Status": "miss",
                    "X-Cache-Layer": "origin",
                },
            });
        }
    } catch (err) {
        console.error(`[API /api/polyline/${routeId} city=${cityCode}] Generator error:`, err);
    }

    return NextResponse.json({error: `Polyline not found for route ${routeId}`}, {status: 404});
}
