import { getCachedOrFetch } from "@shared/redis/client";
import { fetchRouteStops, type RawBusStop } from "@shared/redis/publicApi";
import { NextResponse } from "next/server";

// Bus stop locations rarely change — cache for 10 minutes
const CACHE_TTL = 600;

export async function GET(
    _request: Request,
    {params}: { params: Promise<{ routeId: string }> }
) {
    const {routeId} = await params;

    try {
        const result = await getCachedOrFetch<RawBusStop[]>(
            `stops:${routeId}`,
            () => fetchRouteStops(routeId),
            CACHE_TTL
        );

        return NextResponse.json(result);
    } catch (err) {
        console.error(`[API /bus-stops/${routeId}]`, err);
        return NextResponse.json(
            {error: "Failed to fetch stop data"},
            {status: 500}
        );
    }
}
