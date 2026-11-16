import {type NextRequest, NextResponse} from "next/server";
import {isValidWikiSlug, WikiPinPatchPayloadSchema} from "@entities/wiki";
import {
    enforceWikiRateLimit,
    isWikiAdminAuthorized,
    resolveEditorInfo,
    updateWikiPinMeta,
} from "@entities/wiki/server";
import {decodeWikiSlug, extractClientIp, handleWikiApiError, WIKI_NO_STORE_HEADERS} from "../../wikiApiUtils";

export const dynamic = "force-dynamic";

export async function PATCH(
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
        const parsed = WikiPinPatchPayloadSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: parsed.error.issues[0]?.message || "핀 수정 요청 형식이 올바르지 않습니다.",
                    issues: parsed.error.issues,
                },
                {status: 400, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        const isAdmin = isWikiAdminAuthorized(request.headers.get("authorization"));
        const editor = resolveEditorInfo(parsed.data.nickname, extractClientIp(request));
        if (!isAdmin) {
            await enforceWikiRateLimit(editor.editorId, "edit");
        }

        const result = await updateWikiPinMeta({
            slug,
            baseVersion: parsed.data.baseVersion,
            lat: parsed.data.lat,
            lng: parsed.data.lng,
            pinColor: parsed.data.pinColor,
            summary: parsed.data.summary,
            editor,
            isAdmin,
        });

        return NextResponse.json(result, {headers: WIKI_NO_STORE_HEADERS});
    } catch (err) {
        return handleWikiApiError(err, "지도 핀 정보 수정 중 오류가 발생했습니다.");
    }
}
