import {type NextRequest, NextResponse} from "next/server";
import {ApiValidators} from "@shared/api";
import {generateSingleRoutePolyline} from "@entities/route/routeSyncService";

export const dynamic = "force-dynamic";

const CACHE_CONTROL_HEADER =
    "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000, stale-if-error=2592000";

/**
 * GET /api/polyline/[routeId]?cityCode=...&routeNo=...
 * Returns the full GeoPolyline object for any city in South Korea.
 * 1. Checks local filesystem (public/routes or /tmp/routes) for instant response
 * 2. On-demand generates road-snapped polyline using TAGO stations + OSRM chunked pipeline
 * 3. Falls back to smooth spline geometry if road-snapping detours or fails
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
    const cityCode = searchParams.get("cityCode") || "32020";
    const routeNo = searchParams.get("routeNo") || undefined;

    // 1. Try local filesystem (public/routes/ or /tmp/routes/)
    try {
        const {readFile} = await import("fs/promises");
        const {existsSync} = await import("fs");
        const {join} = await import("path");

        const localPaths = [
            join(process.cwd(), "public", "routes", `${routeId}.json`),
            join("/tmp", "routes", `${routeId}.json`),
        ];

        for (const localPath of localPaths) {
            if (existsSync(localPath)) {
                const content = await readFile(localPath, "utf-8");
                return new NextResponse(content, {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                        "Cache-Control": CACHE_CONTROL_HEADER,
                    },
                });
            }
        }
    } catch {
        // Continue to generator
    }

    // 2. Generate on-demand via OSRM + TAGO
    try {
        const polyline = await generateSingleRoutePolyline(routeId, cityCode, routeNo);
        if (polyline) {
            return NextResponse.json(polyline, {
                status: 200,
                headers: {
                    "Cache-Control": CACHE_CONTROL_HEADER,
                },
            });
        }
    } catch (err) {
        console.error(`[API /api/polyline/${routeId} city=${cityCode}] Generator error:`, err);
    }

    return NextResponse.json({error: `Polyline not found for route ${routeId}`}, {status: 404});
}
