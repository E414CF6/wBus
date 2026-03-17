import { getRouteStopsByRouteName } from "@entities/station/api";
import type { BusStop } from "@entities/station/types";
import { getCachedOrFetch } from "@shared/redis/client";
import { NextResponse } from "next/server";

// Cache stops for 24 hours as they change very rarely
const CACHE_TTL = 86400;

export async function GET(
    _request: Request,
    {params}: { params: Promise<{ routeName: string }> }
) {
    const {routeName} = await params;

    try {
        const result = await getCachedOrFetch<BusStop[]>(
            `routeStops:${routeName}`,
            async () => {
                // This function now uses dataLoader which works on server (reading FS)
                return getRouteStopsByRouteName(routeName);
            },
            CACHE_TTL
        );

        return NextResponse.json(result, {
            headers: {
                "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
            },
        });
    } catch (err) {
        console.error(`[API /route-stops/${routeName}]`, err);
        return NextResponse.json(
            {error: "Failed to fetch route stops"},
            {status: 500}
        );
    }
}
