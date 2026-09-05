import {refreshSchedule} from "@entities/schedule";
import {type NextRequest, NextResponse} from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    try {
        const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_KEY;
        const authHeader = request.headers.get("authorization");
        const isAuthorized = cronSecret ? authHeader === `Bearer ${cronSecret}` : process.env.NODE_ENV === "development";

        const forceParam = request.nextUrl.searchParams.get("force") === "true";
        // Only authorized requests (e.g. Vercel Cron with secret) can force-bypass the refresh cooldown
        const force = isAuthorized && forceParam;
        const {refreshed, message, data, meta} = await refreshSchedule(force);

        return NextResponse.json({
            success: true, refreshed, message, data, meta, elapsedMs: Date.now() - startTime,
        }, {
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
                Pragma: "no-cache",
                Expires: "0",
            },
        });
    } catch (error) {
        console.error("API /api/schedule/refresh error:", error);
        return NextResponse.json({
            success: false, error: error instanceof Error ? error.message : "시간표 갱신 실패",
        }, {status: 500});
    }
}
