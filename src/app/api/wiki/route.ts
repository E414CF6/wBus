import {type NextRequest, NextResponse} from "next/server";
import {WikiCreatePayloadSchema} from "@entities/wiki";
import {createWikiPage, enforceWikiRateLimit, listWikiPages, resolveEditorInfo,} from "@entities/wiki/server";
import {UI_TEXT} from "@shared/config/locale";
import {extractClientIp, handleWikiApiError, WIKI_NO_STORE_HEADERS} from "./wikiApiUtils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const query = request.nextUrl.searchParams.get("q") ?? undefined;
        const pinsOnlyParam = request.nextUrl.searchParams.get("pinsOnly");
        const pinsOnly = pinsOnlyParam === "true" || pinsOnlyParam === "1";
        const limitParam = request.nextUrl.searchParams.get("limit");
        const offsetParam = request.nextUrl.searchParams.get("offset");
        const limit = limitParam ? Number(limitParam) : undefined;
        const offset = offsetParam ? Number(offsetParam) : undefined;

        const data = await listWikiPages({
            query,
            ...(pinsOnly ? {pinsOnly: true} : {}),
            limit: Number.isFinite(limit) && (limit ?? 0) > 0 ? limit : undefined,
            offset: Number.isFinite(offset) && (offset ?? 0) >= 0 ? offset : undefined,
        });

        return NextResponse.json(data, {headers: WIKI_NO_STORE_HEADERS});
    } catch (err) {
        return handleWikiApiError(err, UI_TEXT.WIKI.API_ERRORS.LIST_FAILED);
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => null);
        const parsed = WikiCreatePayloadSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: parsed.error.issues[0]?.message || UI_TEXT.WIKI.API_ERRORS.INVALID_INPUT,
                    issues: parsed.error.issues,
                },
                {status: 400, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        // Honeypot check
        if (parsed.data.website && parsed.data.website.trim().length > 0) {
            return NextResponse.json(
                {error: UI_TEXT.WIKI.API_ERRORS.BAD_REQUEST},
                {status: 400, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        const editor = resolveEditorInfo(parsed.data.nickname, extractClientIp(request));
        await enforceWikiRateLimit(editor.editorId, "create");

        const created = await createWikiPage({
            slug: parsed.data.slug,
            title: parsed.data.title,
            subtitle: parsed.data.subtitle,
            pinColor: parsed.data.pinColor,
            lat: parsed.data.lat,
            lng: parsed.data.lng,
            tags: parsed.data.tags,
            markdownBody: parsed.data.markdownBody,
            summary: parsed.data.summary,
            editor,
        });

        return NextResponse.json(created, {status: 201, headers: WIKI_NO_STORE_HEADERS});
    } catch (err) {
        return handleWikiApiError(err, UI_TEXT.WIKI.API_ERRORS.CREATE_FAILED);
    }
}
