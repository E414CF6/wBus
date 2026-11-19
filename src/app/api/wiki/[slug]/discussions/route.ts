import {type NextRequest, NextResponse} from "next/server";
import {WikiDiscussionCreateSchema, WikiDiscussionStatusSchema} from "@entities/wiki";
import {createWikiDiscussionThread, listWikiDiscussions} from "@entities/wiki/server";
import {UI_TEXT} from "@shared/config/locale";
import {
    authorizeWikiMutation,
    handleWikiApiError,
    resolveValidWikiSlugOrError,
    WIKI_NO_STORE_HEADERS,
} from "../../wikiApiUtils";

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ slug: string }> },
) {
    try {
        const {slug: rawSlug} = await context.params;
        const slugCheck = resolveValidWikiSlugOrError(rawSlug);
        if ("response" in slugCheck) return slugCheck.response;

        const rawStatus = request.nextUrl.searchParams.get("status");
        let statusFilter: "open" | "resolved" | "all" = "all";
        if (rawStatus && rawStatus !== "all") {
            const parsedStatus = WikiDiscussionStatusSchema.safeParse(rawStatus);
            if (!parsedStatus.success) {
                return NextResponse.json(
                    {error: UI_TEXT.WIKI.API_ERRORS.DISCUSSION_INVALID_STATUS_FILTER},
                    {status: 400, headers: WIKI_NO_STORE_HEADERS},
                );
            }
            statusFilter = parsedStatus.data;
        }

        const data = await listWikiDiscussions(slugCheck.slug, statusFilter);
        return NextResponse.json(data, {headers: WIKI_NO_STORE_HEADERS});
    } catch (err) {
        return handleWikiApiError(err, UI_TEXT.WIKI.API_ERRORS.DISCUSSION_LIST_FAILED);
    }
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ slug: string }> },
) {
    try {
        const {slug: rawSlug} = await context.params;
        const slugCheck = resolveValidWikiSlugOrError(rawSlug);
        if ("response" in slugCheck) return slugCheck.response;

        const body = await request.json().catch(() => null);
        const parsed = WikiDiscussionCreateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: parsed.error.issues[0]?.message || UI_TEXT.WIKI.API_ERRORS.DISCUSSION_INVALID_CREATE,
                    issues: parsed.error.issues,
                },
                {status: 400, headers: WIKI_NO_STORE_HEADERS},
            );
        }

        const auth = await authorizeWikiMutation(request, parsed.data, "discussion");
        if ("response" in auth) return auth.response;

        const thread = await createWikiDiscussionThread({
            slug: slugCheck.slug,
            title: parsed.data.title,
            body: parsed.data.body,
            editor: auth.editor,
        });

        return NextResponse.json({thread}, {status: 201, headers: WIKI_NO_STORE_HEADERS});
    } catch (err) {
        return handleWikiApiError(err, UI_TEXT.WIKI.API_ERRORS.DISCUSSION_CREATE_FAILED);
    }
}
