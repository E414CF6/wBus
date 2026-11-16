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
                {error: "올바르지 않은 위키 문서 주소입니다."},
                {status: 400, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        const doc = await getWikiPage(slug);
        if (!doc) {
            return NextResponse.json(
                {error: "위키 문서를 찾을 수 없습니다."},
                {status: 404, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        return NextResponse.json(doc, {headers: WIKI_NO_STORE_HEADERS});
    } catch (err) {
        return handleWikiApiError(err, "위키 문서를 불러오지 못했습니다.");
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
                {error: "올바르지 않은 위키 문서 주소입니다."},
                {status: 400, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        const body = await request.json().catch(() => null);
        const parsed = WikiEditPayloadSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: parsed.error.issues[0]?.message || "편집 내용이 올바르지 않습니다.",
                    issues: parsed.error.issues,
                },
                {status: 400, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        if (parsed.data.website && parsed.data.website.trim().length > 0) {
            return NextResponse.json(
                {error: "잘못된 요청입니다."},
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
            cityCode: parsed.data.cityCode,
            lat: parsed.data.lat,
            lng: parsed.data.lng,
            tags: parsed.data.tags,
            linkedRoutes: parsed.data.linkedRoutes,
            shuttle: parsed.data.shuttle,
            boardingStops: parsed.data.boardingStops,
            markdownBody: parsed.data.markdownBody,
            summary: parsed.data.summary,
            editor,
            isAdmin,
        });

        return NextResponse.json(result, {headers: WIKI_NO_STORE_HEADERS});
    } catch (err) {
        return handleWikiApiError(err, "위키 문서 저장 중 오류가 발생했습니다.");
    }
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ slug: string }> }
) {
    try {
        if (!isWikiAdminAuthorized(request.headers.get("authorization"))) {
            return NextResponse.json(
                {error: "관리자 권한이 필요합니다."},
                {status: 401, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        const {slug: rawSlug} = await context.params;
        const slug = decodeWikiSlug(rawSlug);
        const body = (await request.json().catch(() => null)) as { isProtected?: boolean } | null;
        if (typeof body?.isProtected !== "boolean") {
            return NextResponse.json(
                {error: "isProtected(boolean) 값이 필요합니다."},
                {status: 400, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        const updated = await setWikiPageProtection(slug, body.isProtected);
        return NextResponse.json(updated, {headers: WIKI_NO_STORE_HEADERS});
    } catch (err) {
        return handleWikiApiError(err, "문서 보호 상태 변경에 실패했습니다.");
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ slug: string }> }
) {
    try {
        if (!isWikiAdminAuthorized(request.headers.get("authorization"))) {
            return NextResponse.json(
                {error: "관리자 권한이 필요합니다."},
                {status: 401, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        const {slug: rawSlug} = await context.params;
        const slug = decodeWikiSlug(rawSlug);
        await deleteWikiPage(slug);
        return NextResponse.json({deleted: true, slug}, {headers: WIKI_NO_STORE_HEADERS});
    } catch (err) {
        return handleWikiApiError(err, "문서 삭제에 실패했습니다.");
    }
}
