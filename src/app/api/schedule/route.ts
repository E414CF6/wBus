import {getOrFetchSchedule} from "@entities/schedule";
import {NextResponse} from "next/server";

// Edge CDN ISR Cache: Revalidate every 24 hours (86400 seconds)
export const revalidate = 86400;

export async function GET() {
    const startTime = Date.now();
    try {
        const {data, meta} = await getOrFetchSchedule(false);

        // Generate strong ETag based on updatedAt and total route count
        const etag = `W/"wbus-sched-${meta.updatedAt ? new Date(meta.updatedAt).getTime() : "latest"}-${data.routes?.length || 0}"`;

        const cacheControlHeader = "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=2592000";

        return NextResponse.json({
            success: true, data, meta, elapsedMs: Date.now() - startTime,
        }, {
            headers: {
                ETag: etag, "Cache-Control": cacheControlHeader,
            },
        });
    } catch (error) {
        console.error("API /api/schedule error:", error);
        return NextResponse.json({
            success: false, error: error instanceof Error ? error.message : "Unknown error",
        }, {status: 500});
    }
}
