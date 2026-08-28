import {NextResponse} from "next/server";

import {getOrFetchSchedule} from "@lib/scheduleService";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
    const startTime = Date.now();
    try {
        const {data, meta} = await getOrFetchSchedule(false);
        return NextResponse.json({
            success: true, data, meta, elapsedMs: Date.now() - startTime,
        }, {
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
                Pragma: "no-cache",
                Expires: "0",
            },
        });
    } catch (error) {
        console.error("API /api/schedule error:", error);
        return NextResponse.json({
            success: false, error: error instanceof Error ? error.message : "Unknown error",
        }, {status: 500});
    }
}
