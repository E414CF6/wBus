import {getRouteDetails, getRouteMapData} from "@entities/route/api";
import {getStationMap} from "@entities/station/api";
import type {BusStop} from "@entities/station/types";
import {CacheManager} from "@shared/cache/CacheManager";
import {buildCacheControl} from "@shared/cache/cachePolicy";
import {NextResponse} from "next/server";

// Edge CDN ISR Cache: Revalidate every 24 hours (86400 seconds)
export const revalidate = 86400;

const memoryCache = new CacheManager<BusStop[]>(100);

const CACHE_CONTROL = buildCacheControl({
    ttlSeconds: 3600,
    maxAgeSeconds: 300,
    sMaxAgeSeconds: 86400,
    staleWhileRevalidateSeconds: 86400,
    staleIfErrorSeconds: 86400,
});

async function getRouteStopsByRouteName(routeName: string): Promise<BusStop[]> {
    const routeMapData = await getRouteMapData();
    const routeIds = routeMapData.route_numbers[routeName] ?? [];
    if (routeIds.length === 0) return [];

    const stationMap = await getStationMap();
    const stopMap = new Map<string, BusStop>();

    const routeDetailsList = await Promise.all(
        routeIds.map((routeId) => getRouteDetails(routeId))
    );

    routeDetailsList.forEach((detail) => {
        if (!detail?.sequence) return;
        detail.sequence.forEach((stop) => {
            const station = stationMap[stop.nodeid];
            if (!station) return;
            const key = `${stop.nodeid}-${stop.updowncd ?? ""}`;
            if (stopMap.has(key)) return;
            stopMap.set(key, {
                ...station,
                nodeid: stop.nodeid,
                nodeord: stop.nodeord,
                updowncd: stop.updowncd,
            });
        });
    });

    return Array.from(stopMap.values());
}

export async function GET(_request: Request, {params}: { params: Promise<{ routeName: string }> }) {
    const {routeName} = await params;

    if (!routeName || !/^[a-zA-Z0-9_\uAC00-\uD7A3-]+$/.test(routeName) || routeName.length > 30) {
        return NextResponse.json({error: "Invalid routeName"}, {status: 400});
    }

    try {
        const cached = memoryCache.get(routeName);
        if (cached) {
            return NextResponse.json(
                {data: cached, timestamp: Date.now(), meta: {status: "hit", layer: "memory"}},
                {
                    headers: {
                        "Cache-Control": CACHE_CONTROL,
                        "X-Cache-Status": "hit",
                        "X-Cache-Layer": "memory",
                    },
                }
            );
        }

        const data = await getRouteStopsByRouteName(routeName);
        memoryCache.set(routeName, data);

        return NextResponse.json(
            {data, timestamp: Date.now(), meta: {status: "miss", layer: "memory"}},
            {
                headers: {
                    "Cache-Control": CACHE_CONTROL,
                    "X-Cache-Status": "miss",
                    "X-Cache-Layer": "memory",
                },
            }
        );
    } catch (err) {
        console.error(`[API /route-stops/${routeName}]`, err);
        return NextResponse.json({error: "Failed to fetch route stops"}, {status: 500});
    }
}
