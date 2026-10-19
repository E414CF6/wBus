import {type NextRequest, NextResponse} from "next/server";
import {getCachedCityRoutes} from "@entities/bus";
import {ApiValidators} from "@shared/api";
import {invalidateCacheByPrefix} from "@shared/cache";

export const dynamic = "force-dynamic";

const CACHE_CONTROL_HEADER =
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800";

/**
 * GET /api/routes?cityCode=...&routeNo=...
 * Returns routes for a city.
 * - Defaults to Wonju ("32020") if cityCode is unspecified.
 * - Shares unified L1 memory cache (`routes:{cityCode}:all`) across full-list and single-route queries.
 */
export async function GET(request: NextRequest) {
    const {searchParams} = request.nextUrl;
    const cityCode = searchParams.get("cityCode") || "32020";
    const routeNo = searchParams.get("routeNo") || undefined;
    const forceRefresh = searchParams.get("refresh") === "true";

    if (!ApiValidators.isValidCityCode(cityCode)) {
        return NextResponse.json(
            {error: "Invalid cityCode parameter"},
            {status: 400}
        );
    }

    if (forceRefresh) {
        invalidateCacheByPrefix(`routes:${cityCode}`);
    }

    try {
        const result = await getCachedCityRoutes(cityCode, routeNo);
        if (!result.data || result.data.length === 0) {
            invalidateCacheByPrefix(`routes:${cityCode}`);
        }

        // Group into route_numbers mapping { [routeNo]: [routeId1, routeId2, ...] }
        const routeNumbersMap: Record<string, string[]> = {};
        for (const item of result.data || []) {
            const rNo = String(item.routeno);
            if (!routeNumbersMap[rNo]) {
                routeNumbersMap[rNo] = [];
            }
            if (!routeNumbersMap[rNo].includes(item.routeid)) {
                routeNumbersMap[rNo].push(item.routeid);
            }
        }

        return NextResponse.json(
            {
                cityCode,
                route_numbers: routeNumbersMap,
                routes: result.data || [],
                count: result.data?.length || 0,
            },
            {
                headers: {
                    "Cache-Control": CACHE_CONTROL_HEADER,
                    ...(result.meta ? {
                        "X-Cache-Status": result.meta.status,
                        "X-Cache-Layer": result.meta.layer,
                    } : {}),
                },
            }
        );
    } catch (err) {
        console.error(`[API /api/routes city=${cityCode}]`, err);
        return NextResponse.json(
            {error: "Failed to fetch routes for requested city"},
            {status: 500}
        );
    }
}
