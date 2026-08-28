import {NextRequest, NextResponse} from "next/server";

import {addComment, deleteComment, getAllStoredComments, getComments, likeComment,} from "@lib/commentService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const showAll = request.nextUrl.searchParams.get("all") === "true";
        const forceReload = request.nextUrl.searchParams.get("force") === "true";

        const comments = await getComments(!showAll, forceReload);
        const allStored = await getAllStoredComments(forceReload);

        return NextResponse.json(
            {
                success: true,
                comments,
                totalStoredCount: allStored.length,
                recentCount: comments.length,
                isFiltered24h: !showAll,
                updatedAt: new Date().toISOString(),
            },
            {
                headers: {
                    "Cache-Control":
                        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
                    Pragma: "no-cache",
                    Expires: "0",
                },
            }
        );
    } catch (error) {
        console.error("API GET /api/comments error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "댓글 조회 실패",
            },
            {status: 500}
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {author, content, routeNo, category} = body;

        const newComment = await addComment({
            author,
            content,
            routeNo,
            category,
        });

        return NextResponse.json({
            success: true,
            comment: newComment,
        });
    } catch (error) {
        console.error("API POST /api/comments error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "댓글 등록 실패",
            },
            {status: 400}
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const id = body.id || request.nextUrl.searchParams.get("id");
        const action = body.action || request.nextUrl.searchParams.get("action") || "like";

        if (!id) {
            return NextResponse.json(
                {success: false, error: "대상 댓글 ID가 필요합니다."},
                {status: 400}
            );
        }

        if (action === "like") {
            const updated = await likeComment(id);
            if (!updated) {
                return NextResponse.json(
                    {success: false, error: "댓글을 찾을 수 없습니다."},
                    {status: 404}
                );
            }
            return NextResponse.json({success: true, comment: updated});
        }

        return NextResponse.json(
            {success: false, error: "지원하지 않는 동작입니다."},
            {status: 400}
        );
    } catch (error) {
        console.error("API PATCH /api/comments error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "댓글 수정 실패",
            },
            {status: 500}
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get("id");
        if (!id) {
            return NextResponse.json(
                {success: false, error: "삭제할 댓글 ID가 필요합니다."},
                {status: 400}
            );
        }

        await deleteComment(id);
        return NextResponse.json({success: true});
    } catch (error) {
        console.error("API DELETE /api/comments error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "댓글 삭제 실패",
            },
            {status: 500}
        );
    }
}

