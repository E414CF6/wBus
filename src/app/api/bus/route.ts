import {type NextRequest, NextResponse} from "next/server";
import {fetchBusLocations, getAdaptiveTtlSeconds, getCachedCityRoutes, type RawBusLocation} from "@entities/bus";
import {getClientPollHint, warmRouteWindowResources} from "@entities/bus/api/routeWindow";
import {filterRouteIdsByCity} from "@entities/city";
import {getCachedOrFetch} from "@shared/cache";
import {mapWithConcurrencyLimit} from "@shared/utils/concurrency";

import {ApiValidators} from "@shared/api";

export const dynamic = "force-dynamic";

const LIVE_CACHE_OPTIONS = {
    staleWhileRevalidateSeconds: 5,
    staleIfErrorSeconds: 60,
    useDistributedCache: true,
    l2TimeoutMs: 300,
};

const CACHE_CONTROL_HEADER = "public, max-age=2, s-maxage=10, stale-while-revalidate=5, stale-if-error=60";
const MAX_ROUTE_NAME_VARIANTS = 30;
const MAX_QUERY_ROUTE_IDS = 15;

type ResolvedBusRoutes =
    | { ok: true; routeIds: string[]; routeName?: string; lookupDegraded?: boolean }
    | { ok: false; response: NextResponse };

async function resolveBusRouteIds(searchParams: URLSearchParams, cityCode: string): Promise<ResolvedBusRoutes> {
    const routeNameParam = searchParams.get("routeName");
    if (routeNameParam !== null) {
        const routeName = routeNameParam.trim();
        if (!ApiValidators.isValidRouteName(routeName)) {
            return {
                ok: false,
                response: NextResponse.json({error: "Invalid routeName parameter"}, {status: 400}),
            };
        }

        const routesResult = await getCachedCityRoutes(cityCode, routeName);
        const rawRoutes = routesResult.data || [];
        const matched = rawRoutes.filter((r) => String(r.routeno) === routeName || r.routeid === routeName);
        const routeIds = filterRouteIdsByCity(
            cityCode,
            Array.from(new Set(matched.map((r) => r.routeid)))
        ).slice(0, MAX_ROUTE_NAME_VARIANTS);

        return {
            ok: true,
            routeIds,
            routeName,
            lookupDegraded: Boolean(routesResult.meta?.degraded) || rawRoutes.length === 0,
        };
    }

    const routeIdsParam = searchParams.get("routeIds");
    if (!routeIdsParam) {
        return {
            ok: false,
            response: NextResponse.json(
                {error: "Missing required query parameter: routeName or routeIds. To fetch bus timetables, please use /api/schedule."},
                {status: 400}
            ),
        };
    }

    const routeIds = filterRouteIdsByCity(
        cityCode,
        routeIdsParam
            .split(",")
            .map((id) => id.trim())
            .filter((id) => ApiValidators.isValidRouteId(id))
            .slice(0, MAX_QUERY_ROUTE_IDS)
    );

    if (routeIds.length === 0) {
        return {
            ok: false,
            response: NextResponse.json({error: "Invalid or empty routeIds parameter"}, {status: 400}),
        };
    }

    return {ok: true, routeIds};
}

/**
 * GET /api/bus
 * Returns batched real-time bus locations for a route name (`?routeName=...`) or explicit route IDs (`?routeIds=...`).
 */
export async function GET(request: NextRequest) {
    const {searchParams} = request.nextUrl;
    const cityCode = ApiValidators.resolveCityCode(searchParams.get("cityCode"));

    try {
        const resolved = await resolveBusRouteIds(searchParams, cityCode);
        if (!resolved.ok) {
            return resolved.response;
        }

        const {routeIds, routeName, lookupDegraded} = resolved;
        if (routeIds.length === 0) {
            const degraded = Boolean(lookupDegraded);
            return NextResponse.json(
                {
                    data: [],
                    timestamp: Date.now(),
                    meta: {
                        status: degraded ? "fallback" : "hit",
                        layer: "edge",
                        count: 0,
                        routes: [],
                        ...(routeName ? {routeName} : {}),
                        degraded,
                        inService: false,
                    },
                },
                {
                    headers: {
                        "Cache-Control": "no-store",
                        "X-Batch-Routes-Count": "0",
                        ...(degraded ? {"X-Cache-Degraded": "true"} : {}),
                    },
                }
            );
        }

        await warmRouteWindowResources(cityCode);

        let hasDegraded = false;
        const settled = await mapWithConcurrencyLimit(routeIds, async (routeId) => {
            const ttl = getAdaptiveTtlSeconds(routeId, 8, 15, cityCode);
            const res = await getCachedOrFetch<RawBusLocation[]>(`bus:${cityCode}:${routeId}`, () => fetchBusLocations(routeId, {cityCode}), {
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

        const pollHint = allBuses.length > 0 ? {inService: true} : getClientPollHint(routeIds, cityCode);
        const headers: Record<string, string> = {
            "Cache-Control": hasDegraded ? "no-store" : CACHE_CONTROL_HEADER,
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
                ...(routeName ? {routeName} : {}),
                degraded: hasDegraded,
                ...pollHint,
            },
        }, {headers});
    } catch (err) {
        console.error("[API /bus batch]", err);
        return NextResponse.json({error: "Internal server error fetching batched bus telemetry"}, {status: 500});
    }
}
