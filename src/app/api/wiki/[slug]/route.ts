import {type NextRequest, NextResponse} from "next/server";
import {isValidWikiSlug, WikiEditPayloadSchema} from "@entities/wiki";
import {
    deleteWikiPage,
    enforceWikiRateLimit,
    getWikiPage,
    isWikiAdminAuthorized,
    resolveEditorInfo,
    saveWikiPageEdit,
    setWikiPageProtection,
} from "@entities/wiki/server";
import {UI_TEXT} from "@shared/config/locale";
import {decodeWikiSlug, extractClientIp, handleWikiApiError, WIKI_NO_STORE_HEADERS} from "../wikiApiUtils";

export const dynamic = "force-dynamic";

export async function GET(
    _request: NextRequest,
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

        const doc = await getWikiPage(slug);
        if (!doc) {
            return NextResponse.json(
                {error: UI_TEXT.WIKI.API_ERRORS.NOT_FOUND},
                {status: 404, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        return NextResponse.json(doc, {headers: WIKI_NO_STORE_HEADERS});
    } catch (err) {
        return handleWikiApiError(err, UI_TEXT.WIKI.API_ERRORS.GET_FAILED);
    }
}

export async function PUT(
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
        const parsed = WikiEditPayloadSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: parsed.error.issues[0]?.message || UI_TEXT.WIKI.API_ERRORS.INVALID_EDIT,
                    issues: parsed.error.issues,
                },
                {status: 400, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        if (parsed.data.website && parsed.data.website.trim().length > 0) {
            return NextResponse.json(
                {error: UI_TEXT.WIKI.API_ERRORS.BAD_REQUEST},
                {status: 400, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        const isAdmin = isWikiAdminAuthorized(request.headers.get("authorization"));
        const editor = resolveEditorInfo(parsed.data.nickname, extractClientIp(request));
        if (!isAdmin) {
            await enforceWikiRateLimit(editor.editorId, "edit");
        }

        const result = await saveWikiPageEdit({
            slug,
            baseVersion: parsed.data.baseVersion,
            title: parsed.data.title,
            subtitle: parsed.data.subtitle,
            pinColor: parsed.data.pinColor,
            lat: parsed.data.lat,
            lng: parsed.data.lng,
            tags: parsed.data.tags,
            markdownBody: parsed.data.markdownBody,
            summary: parsed.data.summary,
            editor,
            isAdmin,
        });

        return NextResponse.json(result, {headers: WIKI_NO_STORE_HEADERS});
    } catch (err) {
        return handleWikiApiError(err, UI_TEXT.WIKI.API_ERRORS.SAVE_FAILED);
    }
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ slug: string }> }
) {
    try {
        if (!isWikiAdminAuthorized(request.headers.get("authorization"))) {
            return NextResponse.json(
                {error: UI_TEXT.WIKI.API_ERRORS.ADMIN_REQUIRED},
                {status: 401, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        const {slug: rawSlug} = await context.params;
        const slug = decodeWikiSlug(rawSlug);
        const body = (await request.json().catch(() => null)) as { isProtected?: boolean } | null;
        if (typeof body?.isProtected !== "boolean") {
            return NextResponse.json(
                {error: UI_TEXT.WIKI.API_ERRORS.IS_PROTECTED_REQUIRED},
                {status: 400, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        const updated = await setWikiPageProtection(slug, body.isProtected);
        return NextResponse.json(updated, {headers: WIKI_NO_STORE_HEADERS});
    } catch (err) {
        return handleWikiApiError(err, UI_TEXT.WIKI.API_ERRORS.PROTECTION_FAILED);
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ slug: string }> }
) {
    try {
        if (!isWikiAdminAuthorized(request.headers.get("authorization"))) {
            return NextResponse.json(
                {error: UI_TEXT.WIKI.API_ERRORS.ADMIN_REQUIRED},
                {status: 401, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        const {slug: rawSlug} = await context.params;
        const slug = decodeWikiSlug(rawSlug);
        await deleteWikiPage(slug);
        return NextResponse.json({deleted: true, slug}, {headers: WIKI_NO_STORE_HEADERS});
    } catch (err) {
        return handleWikiApiError(err, UI_TEXT.WIKI.API_ERRORS.DELETE_FAILED);
    }
}
