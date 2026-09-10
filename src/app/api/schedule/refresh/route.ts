import {revalidatePath} from "next/cache";
import {type NextRequest, NextResponse} from "next/server";

import {invalidateScheduleTag, refreshSchedule} from "@entities/schedule/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

async function handleRefresh(request: NextRequest) {
    const startTime = Date.now();
    try {
        const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_KEY;
        const authHeader = request.headers.get("authorization");
        const isAuthorized = cronSecret ? authHeader === `Bearer ${cronSecret}` : process.env.NODE_ENV === "development";

        const forceParam = request.nextUrl.searchParams.get("force") === "true";
        // Allow force refresh from client requests (with rate limit protection inside refreshSchedule)
        // or always for authorized requests (Vercel Cron / Admin)
        const force = forceParam || isAuthorized;
        const {refreshed, message, data, meta} = await refreshSchedule(force, isAuthorized);

        // Instantly purge Next.js Data Cache Tag and ISR paths if schedule was freshly scraped/updated
        if (refreshed) {
            try {
                invalidateScheduleTag();
                revalidatePath("/api/schedule");
                revalidatePath("/schedule");
            } catch (revalidateErr) {
                console.warn("[ScheduleRefresh] revalidate error:", revalidateErr);
            }
        }

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

export async function GET(request: NextRequest) {
    return handleRefresh(request);
}

export async function POST(request: NextRequest) {
    return handleRefresh(request);
}
