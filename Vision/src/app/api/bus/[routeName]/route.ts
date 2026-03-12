import { getCachedOrFetch } from "@shared/redis/client";
import { fetchBusLocations, type RawBusLocation } from "@shared/redis/publicApi";
import { readFileSync } from "fs";
import { NextResponse } from "next/server";
import { join } from "path";

const CACHE_TTL = 3; // seconds

/**
 * Resolve Blob base URL from token (production) or env var.
 * Falls back to undefined → use local filesystem.
 */
function getBlobBaseUrl(): string | undefined {
    if (process.env.NEXT_PUBLIC_USE_REMOTE_STATIC_DATA !== "true") return undefined;

    const explicit = process.env.NEXT_PUBLIC_STATIC_API_URL;
    if (explicit?.startsWith("http")) return explicit;

    const token = process.env.BLOB_READ_WRITE_TOKEN;

    if (!token) return undefined;
    const match = token.match(/^vercel_blob_rw_([^_]+)_/);

    if (!match) return undefined;
    return `https://${match[1].toLowerCase()}.public.blob.vercel-storage.com`;
}

// In-memory cache for routeMap (loaded once per cold start)
let routeMapCache: Record<string, string[]> | null = null;

async function getRouteIds(routeName: string): Promise<string[]> {
    if (!routeMapCache) {
        let raw;
        const blobUrl = getBlobBaseUrl();

        if (blobUrl) {
            const res = await fetch(`${blobUrl}/routeMap.json`);
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
