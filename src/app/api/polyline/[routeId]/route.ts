import {type NextRequest, NextResponse} from "next/server";
import {ApiValidators} from "@shared/api";
import {peekCached, setCached} from "@shared/cache";
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
    if (cityCode === "32020" && routeId.startsWith("WJB258")) {
        return NextResponse.json(
            {error: `Route ${routeId} belongs to Hoengseong (32320), not Wonju (32020)`},
            {status: 404}
        );
    }
    if (cityCode === "32320" && !routeId.startsWith("WJB258")) {
        return NextResponse.json(
            {error: `Route ${routeId} belongs to Wonju (32020), not Hoengseong (32320)`},
            {status: 404}
        );
    }

    const cacheKey = `polyline:${cityCode}:${routeId}`;

    // 1. Check L1 In-Memory Cache
    const memCached = peekCached<GeoPolyline>(cacheKey, POLYLINE_TTL_SECONDS);
    if (memCached?.data) {
        return NextResponse.json(memCached.data, {
            status: 200,
            headers: {
                "Cache-Control": CACHE_CONTROL_HEADER,
                "X-Cache-Status": "hit",
                "X-Cache-Layer": "memory",
            },
        });
    }

    // 2. Try local filesystem (public/routes/ or /tmp/routes/)
    try {
        const {readFile} = await import("fs/promises");
        const {existsSync} = await import("fs");
        const {join} = await import("path");

        const localPaths = [
            join(process.cwd(), "public", "routes", `${routeId}.json`),
            join("/tmp", "routes", `${routeId}.json`),
        ];

        for (const localPath of localPaths) {
            if (existsSync(/*turbopackIgnore: true*/ localPath)) {
                const content = await readFile(/*turbopackIgnore: true*/ localPath, "utf-8");
                try {
                    const parsed = JSON.parse(content) as GeoPolyline;
                    if (parsed && Array.isArray(parsed.stops) && parsed.stops.length > 0) {
                        setCached(cacheKey, parsed);
                        return new NextResponse(content, {
                            status: 200,
                            headers: {
                                "Content-Type": "application/json; charset=utf-8",
                                "Cache-Control": CACHE_CONTROL_HEADER,
                                "X-Cache-Status": "hit",
                                "X-Cache-Layer": "disk",
                            },
                        });
                    }
                } catch {
                    // Corrupted disk file: fall through to on-demand regeneration (self-healing)
                }
            }
        }
    } catch {
        // Continue to generator
    }

    // 3. Generate on-demand via OSRM + TAGO (with request deduplication)
    try {
        const polyline = await generateSingleRoutePolyline(routeId, cityCode, routeNo);
        if (polyline) {
            setCached(cacheKey, polyline);
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
