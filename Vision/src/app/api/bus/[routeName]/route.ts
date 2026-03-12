import { getCachedOrFetch } from "@shared/redis/client";
import { fetchBusLocations, type RawBusLocation } from "@shared/redis/publicApi";
import { readFileSync } from "fs";
import { NextResponse } from "next/server";
import { join } from "path";

const CACHE_TTL = 3; // seconds

/**
 * Return a remote base URL when USE_REMOTE is enabled.
 * In production, next.config.ts derives the Blob URL from BLOB_READ_WRITE_TOKEN
 * and sets it as NEXT_PUBLIC_STATIC_API_URL automatically.
 * Falls back to undefined → use local filesystem.
 */
function getRemoteBaseUrl(): string | undefined {
    if (process.env.NEXT_PUBLIC_USE_REMOTE_STATIC_DATA !== "true") return undefined;

    const url = process.env.NEXT_PUBLIC_STATIC_API_URL;
    return url?.startsWith("http") ? url : undefined;
}

// In-memory cache for routeMap (loaded once per cold start)
let routeMapCache: Record<string, string[]> | null = null;

async function getRouteIds(routeName: string): Promise<string[]> {
    if (!routeMapCache) {
        let raw;
        const remoteUrl = getRemoteBaseUrl();

        if (remoteUrl) {
            const res = await fetch(`${remoteUrl}/routeMap.json`);
            if (!res.ok) throw new Error(`Failed to fetch routeMap: ${res.status}`);
            raw = await res.json();
        } else {
            const filePath = join(process.cwd(), "public", "data", "routeMap.json");
            raw = JSON.parse(readFileSync(filePath, "utf-8"));
        }

        routeMapCache = raw.route_numbers as Record<string, string[]>;
    }

    return routeMapCache[routeName] ?? [];
}

export async function GET(
    _request: Request,
    {params}: { params: Promise<{ routeName: string }> }
) {
    const {routeName} = await params;

    try {
        const routeIds = await getRouteIds(routeName);
        if (routeIds.length === 0) {
            return NextResponse.json(
                {data: [], timestamp: Date.now()},
                {status: 200}
            );
        }

        const result = await getCachedOrFetch<RawBusLocation[]>(
            `bus:${routeName}`,
            async () => {
                const results = await Promise.allSettled(
                    routeIds.map((id) => fetchBusLocations(id))
                );

                return results
                    .filter((r): r is PromiseFulfilledResult<RawBusLocation[]> => r.status === "fulfilled")
                    .flatMap((r) => r.value);
            },
            CACHE_TTL
        );

        return NextResponse.json(result);
    } catch (err) {
        console.error(`[API /bus/${routeName}]`, err);
        return NextResponse.json(
            {error: "Failed to fetch bus data"},
            {status: 500}
        );
    }
}
