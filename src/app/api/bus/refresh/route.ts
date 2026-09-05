import {NextRequest, NextResponse} from "next/server";
import {refreshSchedule} from "@entities/schedule";
import {UI_TEXT} from "@shared/config/locale";

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    try {
        const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_KEY;
        const authHeader = request.headers.get("authorization");
        const isAuthorized = cronSecret ? authHeader === `Bearer ${cronSecret}` : process.env.NODE_ENV === "development";

        const forceParam = request.nextUrl.searchParams.get("force") === "true";
        const force = isAuthorized && forceParam;
        const {refreshed, message, data, meta} = await refreshSchedule(force);

        return NextResponse.json({
            success: true, refreshed, message, data, meta, elapsedMs: Date.now() - startTime,
        }, {
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            },
        });
    } catch (error) {
        console.error("API /api/bus/refresh error:", error);
        try {
            const fallback = await refreshSchedule(false);
            return NextResponse.json({
                success: true,
                refreshed: false,
                message: UI_TEXT.BUS_SERVICE.SERVER_TIMEOUT_FALLBACK,
                data: fallback.data,
                meta: fallback.meta,
                elapsedMs: Date.now() - startTime,
            });
        } catch {
            return NextResponse.json({
                success: false, error: error instanceof Error ? error.message : UI_TEXT.BUS_SERVICE.REFRESH_ERROR,
            }, {status: 500});
        }
    }
}

