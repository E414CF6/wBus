import {type NextRequest, NextResponse} from "next/server";
import {GET as getSchedule} from "../schedule/route";
import {fetchBusLocations, getAdaptiveTtlSeconds, type RawBusLocation} from "@entities/bus";
import {getCachedOrFetch} from "@shared/cache";
import {mapWithConcurrencyLimit} from "@shared/utils/concurrency";

export const dynamic = "force-dynamic";

const LIVE_CACHE_OPTIONS = {
    staleWhileRevalidateSeconds: 5, staleIfErrorSeconds: 60,
};

const CACHE_CONTROL_HEADER = "public, max-age=2, s-maxage=10, stale-while-revalidate=5, stale-if-error=60";
const ROUTE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * GET /api/bus
 * - If `routeIds` search parameter is present: Returns batched real-time bus locations for specified route IDs.
 * - Otherwise: Falls back to legacy timetable schedule endpoint.
 */
export async function GET(request: NextRequest) {
    const {searchParams} = request.nextUrl;
    const routeIdsParam = searchParams.get("routeIds");

    if (!routeIdsParam) {
        return getSchedule(request);
    }

    const routeIds = routeIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0 && id.length <= 50 && ROUTE_ID_REGEX.test(id))
        .slice(0, 15);

    if (routeIds.length === 0) {
        return NextResponse.json({error: "Invalid or empty routeIds parameter"}, {status: 400});
    }

    try {
        const settled = await mapWithConcurrencyLimit(routeIds, async (routeId) => {
            const ttl = getAdaptiveTtlSeconds(routeId, 8, 15);
            const res = await getCachedOrFetch<RawBusLocation[]>(`bus:${routeId}`, () => fetchBusLocations(routeId), {
                ttlSeconds: ttl, ...LIVE_CACHE_OPTIONS,
            });
            return res.data || [];
        }, {concurrency: 4, staggerMs: 15});

        const allBuses: RawBusLocation[] = [];
        let anySuccess = false;

        for (const res of settled) {
            if (res.status === "fulfilled" && Array.isArray(res.value)) {
                allBuses.push(...res.value);
                anySuccess = true;
            }
        }

        if (!anySuccess && routeIds.length > 0) {
            return NextResponse.json({error: "Failed to fetch bus telemetry for requested routes"}, {status: 502});
        }

        return NextResponse.json({
            data: allBuses, timestamp: Date.now(), meta: {
                status: "hit", layer: "edge", count: allBuses.length, routes: routeIds,
            },
        }, {
            headers: {
                "Cache-Control": CACHE_CONTROL_HEADER, "X-Batch-Routes-Count": String(routeIds.length),
            },
        });
    } catch (err) {
        console.error("[API /bus batch]", err);
        return NextResponse.json({error: "Internal server error fetching batched bus telemetry"}, {status: 500});
    }
}
