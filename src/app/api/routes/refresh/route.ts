import {type NextRequest, NextResponse} from "next/server";

import {refreshRouteData} from "@entities/route/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

async function handleRefresh(request: NextRequest) {
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

        const searchParams = request.nextUrl.searchParams;
        const routeFilter = searchParams.get("route");
        const mode = (searchParams.get("mode") as "quick" | "full") || (routeFilter ? "quick" : "full");
        const cityCode = searchParams.get("cityCode") || "32020";
        const maxRoutesParam = searchParams.get("maxRoutes");
        const maxRoutes = maxRoutesParam ? parseInt(maxRoutesParam, 10) : undefined;

        const result = await refreshRouteData({
            routeFilter,
            mode,
            cityCode,
            maxRoutes,
        });

        return NextResponse.json(
            {
                ...result,
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
        console.error("API /api/routes/refresh error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "노선 데이터 갱신 실패",
            },
            {status: 500}
        );
    }
}

export async function GET(request: NextRequest) {
    return handleRefresh(request);
}

export async function POST(request: NextRequest) {
    return handleRefresh(request);
}
