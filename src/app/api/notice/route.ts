import { NextRequest, NextResponse } from "next/server";
import { scrapeWonjuNoticeList } from "@/lib/noticeScraper";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const searchText = (searchParams.get("searchText") || "").trim();
    const searchGb = (searchParams.get("searchGb") || "title").trim();

    const data = await scrapeWonjuNoticeList(page, searchText, searchGb);

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
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
      { status: 500 }
    );
  }
}
