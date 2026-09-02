import {scrapeWonjuNoticeList} from "@entities/notice";
import {type NextRequest, NextResponse} from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
        const searchText = (searchParams.get("searchText") || "").trim();
        const searchGb = (searchParams.get("searchGb") || "title").trim();

        const data = await scrapeWonjuNoticeList(page, searchText, searchGb);

        return NextResponse.json(
            {success: true, data},
            {
                headers: {
                    "Cache-Control":
                        "public, max-age=180, s-maxage=900, stale-while-revalidate=3600",
                },
            }
        );
    } catch (error) {
        console.error("API GET /api/notice error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "공지사항 조회 실패",
            },
            {status: 500}
        );
    }
}
