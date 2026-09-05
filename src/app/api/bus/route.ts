import {NextResponse} from "next/server";
import {getOrFetchSchedule} from "@entities/schedule";
import {buildCacheControl} from "@shared/cache/cachePolicy";

// Edge CDN ISR Cache: Revalidate every 24 hours (86400 seconds)
export const revalidate = 86400;

export async function GET() {
    const startTime = Date.now();
    try {
        const {data, meta} = await getOrFetchSchedule(false);
        const cacheControl = buildCacheControl({
            ttlSeconds: 86400,
            maxAgeSeconds: 300, // Browser Cache: 5 min
            sMaxAgeSeconds: 86400, // CDN Cache: 24 hours
            staleWhileRevalidateSeconds: 604800, // SWR: 7 days
            staleIfErrorSeconds: 2592000,
        });

        return NextResponse.json({
            success: true, data, meta, elapsedMs: Date.now() - startTime,
        }, {
            headers: {
                "Cache-Control": cacheControl, "X-Cache-Status": meta.exists ? "HIT" : "MISS",
            },
        });
    } catch (error) {
        console.error("API /api/bus error:", error);
        return NextResponse.json({
            success: false, error: error instanceof Error ? error.message : "Unknown error",
        }, {status: 500});
    }
}
