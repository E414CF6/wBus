import {NextResponse} from "next/server";
import {getOrFetchSchedule} from "@entities/schedule";
import {buildCacheControl} from "@shared/cache/cachePolicy";

export async function GET() {
    const startTime = Date.now();
    try {
        const {data, meta} = await getOrFetchSchedule(false);
        const cacheControl = buildCacheControl({
            ttlSeconds: 3600, maxAgeSeconds: 300, // Browser Cache: 5 min
            sMaxAgeSeconds: 3600, // CDN Cache: 1 hour
            staleWhileRevalidateSeconds: 86400, // SWR: 24 hours
            staleIfErrorSeconds: 86400,
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
