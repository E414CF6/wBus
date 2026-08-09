import {NextRequest, NextResponse} from "next/server";
import {refreshBusData} from "@shared/lib/busService";

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    try {
        const force = request.nextUrl.searchParams.get("force") === "true";
        const {refreshed, message, data, meta} = await refreshBusData(force);

        return NextResponse.json({
            success: true,
            refreshed,
            message,
            data,
            meta,
            elapsedMs: Date.now() - startTime,
        });
    } catch (error) {
        console.error("API /api/bus/refresh error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "시간표 갱신 처리 중 오류가 발생했습니다.",
            },
            {status: 500}
        );
    }
}
