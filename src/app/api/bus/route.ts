import {NextResponse} from "next/server";
import {getOrFetchSchedule} from "@entities/schedule/server";
import {buildCacheControl} from "@shared/cache/cachePolicy";

export const dynamic = "force-dynamic";

export async function GET() {
    const startTime = Date.now();
    try {
        const {data, meta} = await getOrFetchSchedule(false);
        const cacheControl = buildCacheControl({
            ttlSeconds: 60,
            maxAgeSeconds: 60,
            staleWhileRevalidateSeconds: 300,
        });

        return NextResponse.json({
            success: true, data, meta, elapsedMs: Date.now() - startTime,
        }, {
            headers: {
                "Cache-Control": cacheControl,
                "X-Cache-Status": meta.exists ? "HIT" : "MISS",
            },
        });
    } catch (error) {
        console.error("API /api/bus error:", error);
        return NextResponse.json({
            success: false, error: error instanceof Error ? error.message : "Unknown error",
        }, {status: 500});
    }
}
