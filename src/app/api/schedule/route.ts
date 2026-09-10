import {getOrFetchSchedule} from "@entities/schedule/server";
import {type NextRequest, NextResponse} from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const startTime = Date.now();
    try {
        const {data, meta} = await getOrFetchSchedule(false);

        // Generate strong ETag based on updatedAt timestamp and route count
        const etag = `W/"wbus-sched-${meta.updatedAt ? new Date(meta.updatedAt).getTime() : "latest"}-${data.routes?.length || 0}"`;

        const cacheControlHeader = "public, max-age=60, stale-while-revalidate=300, must-revalidate";

        // Conditional GET validation
        const ifNoneMatch = request.headers.get("if-none-match");
        if (ifNoneMatch && ifNoneMatch === etag) {
            return new NextResponse(null, {
                status: 304,
                headers: {
                    ETag: etag,
                    "Cache-Control": cacheControlHeader,
                },
            });
        }

        return NextResponse.json({
            success: true, data, meta, elapsedMs: Date.now() - startTime,
        }, {
            headers: {
                ETag: etag,
                "Cache-Control": cacheControlHeader,
            },
        });
    } catch (error) {
        console.error("API /api/schedule error:", error);
        return NextResponse.json({
            success: false, error: error instanceof Error ? error.message : "Unknown error",
        }, {status: 500});
    }
}
