import {type NextRequest, NextResponse} from "next/server";
import {fetchBusLocations, getAdaptiveTtlSeconds, type RawBusLocation} from "@entities/bus";
import {getCachedOrFetch} from "@shared/cache";
import {mapWithConcurrencyLimit} from "@shared/utils/concurrency";

import {ApiValidators} from "@shared/api";

export const dynamic = "force-dynamic";

const LIVE_CACHE_OPTIONS = {
    staleWhileRevalidateSeconds: 5, staleIfErrorSeconds: 60,
};

const CACHE_CONTROL_HEADER = "public, max-age=2, s-maxage=10, stale-while-revalidate=5, stale-if-error=60";

/**
 * GET /api/bus
 * Returns batched real-time bus locations for specified route IDs (`?routeIds=...`).
 */
export async function GET(request: NextRequest) {
    const {searchParams} = request.nextUrl;
    const routeIdsParam = searchParams.get("routeIds");

    if (!routeIdsParam) {
        return NextResponse.json(
            {error: "Missing required query parameter: routeIds. To fetch bus timetables, please use /api/schedule."},
            {status: 400}
        );
    }

    const cityCode = ApiValidators.resolveCityCode(searchParams.get("cityCode"));

    let routeIds = routeIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter((id) => ApiValidators.isValidRouteId(id))
        .slice(0, 15);

    if (cityCode === "32020") {
        routeIds = routeIds.filter((id) => !id.startsWith("WJB258"));
    } else if (cityCode === "32320") {
        routeIds = routeIds.filter((id) => id.startsWith("WJB258"));
    }

    if (routeIds.length === 0) {
        return NextResponse.json({error: "Invalid or empty routeIds parameter"}, {status: 400});
    }

    try {
        let hasDegraded = false;
        const settled = await mapWithConcurrencyLimit(routeIds, async (routeId) => {
            const ttl = getAdaptiveTtlSeconds(routeId, 8, 15, cityCode);
            const res = await getCachedOrFetch<RawBusLocation[]>(`bus:${cityCode}:${routeId}`, () => fetchBusLocations(routeId, { cityCode }), {
                ttlSeconds: ttl, ...LIVE_CACHE_OPTIONS,
            });
            if (res.meta?.degraded) {
                hasDegraded = true;
            }
            return res.data || [];
        }, {concurrency: 4, staggerMs: 15});

        const allBuses: RawBusLocation[] = [];
        let anySuccess = false;

        for (const res of settled) {
            if (res.status === "fulfilled" && Array.isArray(res.value)) {
                allBuses.push(...res.value);
                anySuccess = true;
            } else if (res.status === "rejected") {
                hasDegraded = true;
            }
        }

        if (!anySuccess && routeIds.length > 0) {
            return NextResponse.json({error: "Failed to fetch bus telemetry for requested routes"}, {status: 502});
        }

        const headers: Record<string, string> = {
            "Cache-Control": CACHE_CONTROL_HEADER,
            "X-Batch-Routes-Count": String(routeIds.length),
        };
        if (hasDegraded) {
            headers["X-Cache-Degraded"] = "true";
        }

        return NextResponse.json({
            data: allBuses, timestamp: Date.now(), meta: {
                status: hasDegraded ? "fallback" : "hit",
                layer: "edge",
                count: allBuses.length,
                routes: routeIds,
                degraded: hasDegraded,
            },
        }, {headers});
    } catch (err) {
        console.error("[API /bus batch]", err);
        return NextResponse.json({error: "Internal server error fetching batched bus telemetry"}, {status: 500});
    }
}
