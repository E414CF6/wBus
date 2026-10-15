import {revalidatePath} from "next/cache";
import {type NextRequest, NextResponse} from "next/server";

import {refreshRouteData} from "@entities/route/server";
import {invalidateScheduleTag, refreshSchedule} from "@entities/schedule/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

/**
 * Unified Cron Job endpoint designed for Vercel Cron
 * Handles schedule updates daily, and optionally route/station dataset sync weekly (on Sundays)
 * or when target=all is specified.
 */
async function handleUnifiedCron(request: NextRequest) {
    const startTime = Date.now();
    try {
        const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_KEY;
        const authHeader = request.headers.get("authorization");
        const isAuthorized = cronSecret
            ? authHeader === `Bearer ${cronSecret}`
            : process.env.NODE_ENV === "development";

        if (!isAuthorized) {
            return NextResponse.json(
                {success: false, error: "인증되지 않은 요청입니다. (CRON_SECRET 또는 ADMIN_KEY 필요)"},
                {status: 401}
            );
        }

        const target = request.nextUrl.searchParams.get("target") || "auto";
        const todayDayOfWeek = new Date().getUTCDay(); // 0 is Sunday

        // 1. Refresh bus schedules (always executed on cron trigger)
        const scheduleResult = await refreshSchedule(true, true);
        if (scheduleResult.refreshed) {
            try {
                invalidateScheduleTag();
                revalidatePath("/api/schedule");
                revalidatePath("/schedule");
            } catch (revalErr) {
                console.warn("[CronRefresh] Schedule revalidate error:", revalErr);
            }
        }

        // 2. Check if route dataset sync should also be executed:
        // - explicitly requested with ?target=all or ?target=routes
        // - or auto mode on Sundays (UTC day 0)
        let routeResult = null;
        const shouldSyncRoutes = target === "all" || target === "routes" || (target === "auto" && todayDayOfWeek === 0);

        if (shouldSyncRoutes) {
            try {
                routeResult = await refreshRouteData({mode: "quick"});
            } catch (routeErr) {
                console.warn("[CronRefresh] Route sync warning:", routeErr);
                routeResult = {
                    success: false,
                    refreshed: false,
                    message: routeErr instanceof Error ? routeErr.message : "노선 갱신 실패",
                    totalRoutesProcessed: 0,
                    routesCount: 0,
                    elapsedMs: 0,
                };
            }
        }

        return NextResponse.json(
            {
                success: true,
                target,
                schedule: {
                    refreshed: scheduleResult.refreshed,
                    message: scheduleResult.message,
                    totalRoutes: scheduleResult.data?.totalRoutes,
                },
                routes: routeResult,
                elapsedMs: Date.now() - startTime,
            },
            {
                headers: {
                    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
                    Pragma: "no-cache",
                    Expires: "0",
                },
            }
        );
    } catch (error) {
        console.error("API /api/cron/refresh error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "통합 데이터셋 갱신 실패",
            },
            {status: 500}
        );
    }
}

export async function GET(request: NextRequest) {
    return handleUnifiedCron(request);
}

export async function POST(request: NextRequest) {
    return handleUnifiedCron(request);
}
