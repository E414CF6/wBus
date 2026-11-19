import {type NextRequest, NextResponse} from "next/server";
import {isValidWikiSlug, WikiPinPatchPayloadSchema} from "@entities/wiki";
import {
    enforceWikiRateLimit,
    isWikiAdminAuthorized,
    resolveEditorInfo,
    updateWikiPinMeta,
} from "@entities/wiki/server";
import {UI_TEXT} from "@shared/config/locale";
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
                {error: UI_TEXT.WIKI.API_ERRORS.INVALID_ADDRESS},
                {status: 400, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        const body = await request.json().catch(() => null);
        const parsed = WikiPinPatchPayloadSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: parsed.error.issues[0]?.message || UI_TEXT.WIKI.API_ERRORS.INVALID_PIN_PATCH,
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
        return handleWikiApiError(err, UI_TEXT.WIKI.API_ERRORS.PIN_UPDATE_FAILED);
    }
}
