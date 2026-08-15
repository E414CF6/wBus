import {CacheManager} from "@shared/cache/CacheManager";
import {buildCacheControl} from "@shared/cache/cachePolicy";
import {fetchRouteStops, type RawBusStop} from "@shared/redis/publicApi";
import {NextResponse} from "next/server";

export const dynamic = "force-dynamic";

const memoryCache = new CacheManager<RawBusStop[]>(200);

const CACHE_CONTROL = buildCacheControl({
    ttlSeconds: 3600,
    maxAgeSeconds: 300,
    sMaxAgeSeconds: 86400,
    staleWhileRevalidateSeconds: 86400,
    staleIfErrorSeconds: 86400,
});

export async function GET(_request: Request, {params}: { params: Promise<{ routeId: string }> }) {
    const {routeId} = await params;

    if (!routeId || !/^[a-zA-Z0-9_-]+$/.test(routeId) || routeId.length > 50) {
        return NextResponse.json({error: "Invalid routeId"}, {status: 400});
    }

    try {
        const cached = memoryCache.get(routeId);
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

        const data = await fetchRouteStops(routeId);
        memoryCache.set(routeId, data);

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
        console.error(`[API /bus-stops/${routeId}]`, err);
        return NextResponse.json({error: "Failed to fetch stop data"}, {status: 500});
    }
}
