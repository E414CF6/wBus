import {getOrFetchSchedule} from "@entities/schedule";
import {type NextRequest, NextResponse} from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const startTime = Date.now();
    try {
        const {data, meta} = await getOrFetchSchedule(false);

        // Generate strong ETag based on updatedAt and total route count
        const etag = `W/"wbus-sched-${meta.updatedAt ? new Date(meta.updatedAt).getTime() : "latest"}-${data.routes?.length || 0}"`;

        // Check If-None-Match header for conditional 304 Not Modified
        const ifNoneMatch = request.headers.get("if-none-match");
        if (ifNoneMatch && ifNoneMatch === etag) {
            return new NextResponse(null, {
                status: 304,
                headers: {
                    ETag: etag,
                    "Cache-Control":
                        "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
                },
            });
        }

        return NextResponse.json(
            {
                success: true,
                data,
                meta,
                elapsedMs: Date.now() - startTime,
            },
            {
                headers: {
                    ETag: etag,
                    "Cache-Control":
                        "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
                },
            }
        );
    } catch (error) {
        console.error("API /api/schedule error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            {status: 500}
        );
    }
}
