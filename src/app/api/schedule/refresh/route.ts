import {refreshSchedule} from "@entities/schedule";
import {type NextRequest, NextResponse} from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    try {
        const forceParam = request.nextUrl.searchParams.get("force");
        const force = forceParam === null ? true : forceParam === "true";
        const {refreshed, message, data, meta} = await refreshSchedule(force);

        return NextResponse.json(
            {
                success: true,
                refreshed,
                message,
                data,
                meta,
                elapsedMs: Date.now() - startTime,
            },
            {
                headers: {
                    "Cache-Control":
                        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
                    Pragma: "no-cache",
                    Expires: "0",
                },
            }
        );
    } catch (error) {
        console.error("API /api/schedule/refresh error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "시간표 갱신 실패",
            },
            {status: 500}
        );
    }
}
