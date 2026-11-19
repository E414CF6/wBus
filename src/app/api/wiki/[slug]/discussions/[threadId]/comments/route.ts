import {type NextRequest, NextResponse} from "next/server";
import {WikiDiscussionCommentCreateSchema} from "@entities/wiki";
import {addWikiDiscussionComment} from "@entities/wiki/server";
import {UI_TEXT} from "@shared/config/locale";
import {
    authorizeWikiMutation,
    handleWikiApiError,
    resolveValidWikiSlugOrError,
    WIKI_NO_STORE_HEADERS,
} from "../../../../wikiApiUtils";

export const dynamic = "force-dynamic";

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ slug: string; threadId: string }> },
) {
    try {
        const {slug: rawSlug, threadId: rawThreadId} = await context.params;
        const slugCheck = resolveValidWikiSlugOrError(rawSlug);
        if ("response" in slugCheck) return slugCheck.response;

        const threadId = Number(rawThreadId);
        if (!Number.isInteger(threadId) || threadId <= 0) {
            return NextResponse.json(
                {error: UI_TEXT.WIKI.API_ERRORS.DISCUSSION_INVALID_THREAD_ID},
                {status: 400, headers: WIKI_NO_STORE_HEADERS},
            );
        }

        const body = await request.json().catch(() => null);
        const parsed = WikiDiscussionCommentCreateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: parsed.error.issues[0]?.message || UI_TEXT.WIKI.API_ERRORS.DISCUSSION_INVALID_COMMENT,
                    issues: parsed.error.issues,
                },
                {status: 400, headers: WIKI_NO_STORE_HEADERS},
            );
        }

        const auth = await authorizeWikiMutation(request, parsed.data, "discussion");
        if ("response" in auth) return auth.response;

        const result = await addWikiDiscussionComment({
            slug: slugCheck.slug,
            threadId,
            body: parsed.data.body,
            editor: auth.editor,
        });

        return NextResponse.json(result, {status: 201, headers: WIKI_NO_STORE_HEADERS});
    } catch (err) {
        return handleWikiApiError(err, UI_TEXT.WIKI.API_ERRORS.DISCUSSION_COMMENT_CREATE_FAILED);
    }
}
