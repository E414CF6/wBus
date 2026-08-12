import {NextRequest, NextResponse} from "next/server";
import {refreshBusData} from "@shared/lib/busService";

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    try {
        const forceParam = request.nextUrl.searchParams.get("force");
        const force = forceParam === null ? true : forceParam === "true";
        const {refreshed, message, data, meta} = await refreshBusData(force);

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
            const fallback = await refreshBusData(false);
            return NextResponse.json({
                success: true,
                refreshed: false,
                message: "원주시 ITS 서버 응답 지연으로 기존 저장소의 시간표를 유지합니다.",
                data: fallback.data,
                meta: fallback.meta,
                elapsedMs: Date.now() - startTime,
            });
        } catch {
            return NextResponse.json({
                success: false, error: error instanceof Error ? error.message : "시간표 갱신 처리 중 오류가 발생했습니다.",
            }, {status: 500});
        }
    }
}
