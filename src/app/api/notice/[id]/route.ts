import {NextRequest, NextResponse} from "next/server";
import {scrapeWonjuNoticeDetail} from "@lib/noticeScraper";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    try {
        const {id} = await params;
        if (!id || !/^\d+$/.test(id)) {
            return NextResponse.json({success: false, error: "유효하지 않은 공지사항 ID입니다."}, {status: 400});
        }

        const data = await scrapeWonjuNoticeDetail(id);
        return NextResponse.json({success: true, data}, {
            headers: {
                "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
            },
        });
    } catch (error) {
        console.error("API GET /api/notice/[id] error:", error);
        return NextResponse.json({
            success: false, error: error instanceof Error ? error.message : "공지사항 상세 조회 실패",
        }, {status: 500});
    }
}
