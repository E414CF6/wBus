import { getCachedOrFetch } from "@shared/redis/client";
import { fetchBusArrivals, type RawBusArrival } from "@shared/redis/publicApi";
import { NextResponse } from "next/server";

const CACHE_TTL = 3; // seconds

export async function GET(
    _request: Request,
    {params}: { params: Promise<{ busStopId: string }> }
) {
    const {busStopId} = await params;

    try {
        const result = await getCachedOrFetch<RawBusArrival[]>(
            `arrival:${busStopId}`,
            () => fetchBusArrivals(busStopId),
            CACHE_TTL
        );

        return NextResponse.json(result);
    } catch (err) {
        console.error(`[API /bus-arrival/${busStopId}]`, err);
        return NextResponse.json(
            {error: "Failed to fetch arrival data"},
            {status: 500}
        );
    }
}
