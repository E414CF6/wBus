import {ApiValidators} from "@shared/api";
import {scrapeWonjuNoticeDetail} from "@entities/notice/server";
import {UI_TEXT} from "@shared/config/locale";
import {type NextRequest, NextResponse} from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
    _request: NextRequest,
    {params}: { params: Promise<{ id: string }> }
) {
    try {
        const {id} = await params;
        if (!ApiValidators.isValidNumericId(id)) {
            return NextResponse.json(
                {success: false, error: UI_TEXT.API.NOTICE_INVALID_ID},
                {status: 400}
            );
        }

        const data = await scrapeWonjuNoticeDetail(id);
        return NextResponse.json(
            {success: true, data},
            {
                headers: {
                    "Cache-Control":
                        "public, max-age=1800, s-maxage=7200, stale-while-revalidate=86400",
                },
            }
        );
    } catch (error) {
        console.error("API GET /api/notice/[id] error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : UI_TEXT.API.NOTICE_DETAIL_FAILED,
            },
            {status: 500}
        );
    }
}
