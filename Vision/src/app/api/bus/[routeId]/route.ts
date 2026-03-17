import { getCachedOrFetch } from "@shared/redis/client";
import { fetchBusLocations, type RawBusLocation } from "@shared/redis/publicApi";
import { NextResponse } from "next/server";

// Always treat this route as dynamic to avoid prerendered 404s on deploy
export const dynamic = "force-dynamic";

const CACHE_TTL = 3; // seconds

/**
 * GET /api/bus/[routeId]
 * Fetch real-time bus locations for a specific route ID.
 */
export async function GET(
    _request: Request,
    {params}: { params: Promise<{ routeId: string }> }
) {
    const {routeId} = await params;

    try {
        const result = await getCachedOrFetch<RawBusLocation[]>(
            `bus:${routeId}`,
            () => fetchBusLocations(routeId),
            CACHE_TTL
        );

        return NextResponse.json(result, {
            headers: {
                "Cache-Control": "public, s-maxage=3, stale-while-revalidate=3",
            },
        });
    } catch (err) {
        console.error(`[API /bus/${routeId}]`, err);
        return NextResponse.json(
            {error: "Failed to fetch bus data"},
            {status: 500}
        );
    }
}
