import {NextRequest, NextResponse} from "next/server";

import {addComment, deleteComment, getComments, likeComment} from "@lib/commentService";
import {checkLikeRateLimit, checkPostRateLimit, getClientIp, hashClientIp} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const forceReload = request.nextUrl.searchParams.get("force") === "true";
        const comments = await getComments(forceReload);

        return NextResponse.json({
            success: true,
            comments,
            totalStoredCount: comments.length,
            recentCount: comments.length,
            updatedAt: new Date().toISOString(),
        }, {
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
                Pragma: "no-cache",
                Expires: "0",
            },
        });
    } catch (error) {
        console.error("API GET /api/comments error:", error);
        return NextResponse.json({
            success: false, error: error instanceof Error ? error.message : "스퀘어 글 조회 실패",
        }, {status: 500});
    }
}

export async function POST(request: NextRequest) {
    try {
        const clientIp = getClientIp(request);
        const ipHash = hashClientIp(clientIp);

        const body = await request.json();
        const {author, content, parentId, replyToAuthor, authorTag, replyToAuthorTag} = body;

        if (!content || typeof content !== "string") {
            return NextResponse.json({success: false, error: "글 내용을 입력해주세요."}, {status: 400});
        }

        // 1. In-Memory Anti-Spam & Rate Limiting Guard
        const rateLimit = checkPostRateLimit(ipHash, content);
        if (!rateLimit.allowed) {
            return NextResponse.json({
                success: false, error: rateLimit.reason || "너무 빠르게 글을 작성하고 있습니다.",
            }, {
                status: 429, headers: {
                    "Retry-After": String(rateLimit.retryAfterSec || 3),
                },
            });
        }

        // 2. Add Comment with Content Moderation & IP Hash
        const newComment = await addComment({
            author, content, parentId, replyToAuthor, authorTag, replyToAuthorTag, ipHash,
        });

        return NextResponse.json({
            success: true, comment: newComment,
        });
    } catch (error) {
        console.error("API POST /api/comments error:", error);
        return NextResponse.json({
            success: false, error: error instanceof Error ? error.message : "스퀘어 글 등록 실패",
        }, {status: 400});
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const clientIp = getClientIp(request);
        const ipHash = hashClientIp(clientIp);

        const body = await request.json().catch(() => ({}));
        const id = body.id || request.nextUrl.searchParams.get("id");
        const action = body.action || request.nextUrl.searchParams.get("action") || "like";

        if (!id) {
            return NextResponse.json({success: false, error: "대상 글 ID가 필요합니다."}, {status: 400});
        }

        if (action === "like") {
            const likeLimit = checkLikeRateLimit(ipHash);
            if (!likeLimit.allowed) {
                return NextResponse.json({success: false, error: likeLimit.reason || "좋아요 요청이 너무 많습니다."}, {
                    status: 429, headers: {"Retry-After": String(likeLimit.retryAfterSec || 10)},
                });
            }

            const updated = await likeComment(id);
            if (!updated) {
                return NextResponse.json({success: false, error: "해당 글을 찾을 수 없습니다."}, {status: 404});
            }
            return NextResponse.json({success: true, comment: updated});
        }

        return NextResponse.json({success: false, error: "지원하지 않는 동작입니다."}, {status: 400});
    } catch (error) {
        console.error("API PATCH /api/comments error:", error);
        return NextResponse.json({
            success: false, error: error instanceof Error ? error.message : "수정 실패",
        }, {status: 500});
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const clientIp = getClientIp(request);
        const ipHash = hashClientIp(clientIp);

        const id = request.nextUrl.searchParams.get("id");
        const authorTag = request.nextUrl.searchParams.get("authorTag") || undefined;
        if (!id) {
            return NextResponse.json({success: false, error: "삭제할 글 ID가 필요합니다."}, {status: 400});
        }

        const updated = await deleteComment(id, authorTag, ipHash);
        if (!updated) {
            return NextResponse.json({success: false, error: "해당 글을 찾을 수 없거나 삭제 권한이 없습니다."}, {status: 403});
        }
        return NextResponse.json({success: true, comment: updated});
    } catch (error) {
        console.error("API DELETE /api/comments error:", error);
        return NextResponse.json({
            success: false, error: error instanceof Error ? error.message : "삭제 실패",
        }, {status: 500});
    }
}
