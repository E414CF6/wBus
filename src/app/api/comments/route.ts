import { NextRequest, NextResponse } from "next/server";
import { getComments, addComment, deleteComment } from "@/lib/commentService";

export async function GET() {
  try {
    const comments = await getComments();
    return NextResponse.json(
      { success: true, comments },
      {
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=60",
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
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { author, content, routeNo } = body;

    const newComment = await addComment({
      author,
      content,
      routeNo,
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
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, error: "삭제할 댓글 ID가 필요합니다." },
        { status: 400 }
      );
    }

    await deleteComment(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API DELETE /api/comments error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "댓글 삭제 실패",
      },
      { status: 500 }
    );
  }
}
