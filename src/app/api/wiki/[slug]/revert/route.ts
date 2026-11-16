import {type NextRequest, NextResponse} from "next/server";
import {isValidWikiSlug, WikiRevertPayloadSchema} from "@entities/wiki";
import {enforceWikiRateLimit, isWikiAdminAuthorized, resolveEditorInfo, revertWikiPage,} from "@entities/wiki/server";
import {decodeWikiSlug, extractClientIp, handleWikiApiError, WIKI_NO_STORE_HEADERS} from "../../wikiApiUtils";

export const dynamic = "force-dynamic";

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ slug: string }> }
) {
    try {
        const {slug: rawSlug} = await context.params;
        const slug = decodeWikiSlug(rawSlug);
        if (!isValidWikiSlug(slug)) {
            return NextResponse.json(
                {error: "올바르지 않은 위키 문서 주소입니다."},
                {status: 400, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        const body = await request.json().catch(() => null);
        const parsed = WikiRevertPayloadSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {error: parsed.error.issues[0]?.message || "되돌리기 요청이 올바르지 않습니다."},
                {status: 400, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        const isAdmin = isWikiAdminAuthorized(request.headers.get("authorization"));
        const editor = resolveEditorInfo(parsed.data.nickname, extractClientIp(request));
        if (!isAdmin) {
            await enforceWikiRateLimit(editor.editorId, "revert");
        }

        const result = await revertWikiPage({
            slug,
            targetVersion: parsed.data.targetVersion,
            baseVersion: parsed.data.baseVersion,
            editor,
            summary: parsed.data.summary,
            isAdmin,
        });

        return NextResponse.json(result, {headers: WIKI_NO_STORE_HEADERS});
    } catch (err) {
        return handleWikiApiError(err, "버전 되돌리기 중 오류가 발생했습니다.");
    }
}
