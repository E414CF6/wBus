import {type NextRequest, NextResponse} from "next/server";
import {fetchCityRoutes, type RawCityRoute} from "@entities/bus";
import {getCachedOrFetch} from "@shared/cache";
import {ApiValidators} from "@shared/api";
import {STATIC_ROUTE_METADATA} from "@entities/route/routeMetadata";

export const dynamic = "force-dynamic";

const CACHE_CONTROL_HEADER = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400";

/**
 * GET /api/routes?cityCode=...&routeNo=...
 * Returns routes for a city.
 * - Defaults to Wonju ("32020") if cityCode is unspecified.
 * - Non-Wonju cities query TAGO BusRouteInfoInqireService/getRouteNoList with 24h caching.
 */
export async function GET(request: NextRequest) {
    const {searchParams} = request.nextUrl;
    const cityCode = searchParams.get("cityCode") || "32020";
    const routeNo = searchParams.get("routeNo") || undefined;

    if (!ApiValidators.isValidCityCode(cityCode)) {
        return NextResponse.json(
            {error: "Invalid cityCode parameter"},
            {status: 400}
        );
    }

    try {
        const cacheKey = `routes:${cityCode}:${routeNo || "all"}`;
        const result = await getCachedOrFetch<RawCityRoute[]>(
            cacheKey,
            async () => {
                const fetched = await fetchCityRoutes(cityCode, routeNo);
                if (fetched && fetched.length > 0) return fetched;
                return [];
            },
            {
                ttlSeconds: 86400,
                staleWhileRevalidateSeconds: 604800,
                staleIfErrorSeconds: 604800,
            }
        );

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
