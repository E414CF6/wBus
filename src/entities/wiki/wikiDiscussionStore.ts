import "server-only";

import {and, asc, desc, eq, inArray} from "drizzle-orm";
import {
    type WikiDiscussionCommentRow,
    wikiDiscussionComments,
    type WikiDiscussionThreadRow,
    wikiDiscussionThreads,
} from "@shared/db";
import {isValidWikiSlug} from "./schemas";
import type {
    WikiDiscussionComment,
    WikiDiscussionsResponse,
    WikiDiscussionStatus,
    WikiDiscussionThread,
    WikiEditorInfo,
} from "./types";
import {getWikiPage, requireDb, WikiServiceError} from "./wikiStore";
import {UI_TEXT} from "@shared/config/locale";

function toIsoString(val: Date | string | null | undefined): string {
    if (!val) return new Date().toISOString();
    return val instanceof Date ? val.toISOString() : String(val);
}

function rowToComment(row: WikiDiscussionCommentRow): WikiDiscussionComment {
    return {
        id: row.id,
        threadId: row.threadId,
        body: row.body,
        author: {
            nickname: row.authorNickname,
            editorId: row.authorId,
        },
        createdAt: toIsoString(row.createdAt),
    };
}

function rowToThread(
    row: WikiDiscussionThreadRow,
    comments: WikiDiscussionComment[] = [],
): WikiDiscussionThread {
    return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        status: row.status,
        author: {
            nickname: row.authorNickname,
            editorId: row.authorId,
        },
        commentCount: row.commentCount,
        lastCommentAt: toIsoString(row.lastCommentAt),
        resolvedBy:
            row.resolvedByNickname && row.resolvedById
                ? {nickname: row.resolvedByNickname, editorId: row.resolvedById}
                : null,
        resolvedAt: row.resolvedAt ? toIsoString(row.resolvedAt) : null,
        createdAt: toIsoString(row.createdAt),
        comments,
    };
}

async function assertWikiPageExists(rawSlug: string): Promise<string> {
    const slug = rawSlug.trim();
    if (!isValidWikiSlug(slug)) {
        throw new WikiServiceError(UI_TEXT.WIKI.STORE_ERRORS.DISCUSSION_INVALID_SLUG, 400);
    }
    const page = await getWikiPage(slug);
    if (!page) {
        throw new WikiServiceError(UI_TEXT.WIKI.STORE_ERRORS.DISCUSSION_DOC_NOT_FOUND, 404);
    }
    return page.slug;
}

export async function listWikiDiscussions(
    rawSlug: string,
    statusFilter?: WikiDiscussionStatus | "all",
): Promise<WikiDiscussionsResponse> {
    const slug = await assertWikiPageExists(rawSlug);
    const db = requireDb();

    const allThreads = await db
        .select()
        .from(wikiDiscussionThreads)
        .where(eq(wikiDiscussionThreads.slug, slug))
        .orderBy(desc(wikiDiscussionThreads.lastCommentAt), desc(wikiDiscussionThreads.id));

    let openCount = 0;
    let resolvedCount = 0;
    for (const thread of allThreads) {
        if (thread.status === "resolved") resolvedCount++;
        else openCount++;
    }

    const filteredThreads =
        statusFilter && statusFilter !== "all"
            ? allThreads.filter((t) => t.status === statusFilter)
            : allThreads;

    // Sort open threads ahead of resolved threads when viewing all
    const orderedThreads =
        !statusFilter || statusFilter === "all"
            ? [
                ...filteredThreads.filter((t) => t.status === "open"),
                ...filteredThreads.filter((t) => t.status === "resolved"),
            ]
            : filteredThreads;

    if (orderedThreads.length === 0) {
        return {slug, openCount, resolvedCount, threads: []};
    }

    const threadIds = orderedThreads.map((t) => t.id);
    const commentRows = await db
        .select()
        .from(wikiDiscussionComments)
        .where(inArray(wikiDiscussionComments.threadId, threadIds))
        .orderBy(asc(wikiDiscussionComments.createdAt), asc(wikiDiscussionComments.id));

    const commentsByThread = new Map<number, WikiDiscussionComment[]>();
    for (const row of commentRows) {
        const list = commentsByThread.get(row.threadId) ?? [];
        list.push(rowToComment(row));
        commentsByThread.set(row.threadId, list);
    }

    return {
        slug,
        openCount,
        resolvedCount,
        threads: orderedThreads.map((row) =>
            rowToThread(row, commentsByThread.get(row.id) ?? []),
        ),
    };
}

export async function createWikiDiscussionThread(input: {
    slug: string;
    title: string;
    body: string;
    editor: WikiEditorInfo;
}): Promise<WikiDiscussionThread> {
    const slug = await assertWikiPageExists(input.slug);
    const db = requireDb();
    const now = new Date();

    return db.transaction(async (tx) => {
        const insertedThreads = await tx
            .insert(wikiDiscussionThreads)
            .values({
                slug,
                title: input.title.trim(),
                status: "open",
                authorNickname: input.editor.nickname,
                authorId: input.editor.editorId,
                commentCount: 1,
                lastCommentAt: now,
                createdAt: now,
            })
            .returning();

        const threadRow = insertedThreads[0];
        if (!threadRow) {
            throw new WikiServiceError(UI_TEXT.WIKI.STORE_ERRORS.DISCUSSION_CREATE_FAILED, 500);
        }

        const insertedComments = await tx
            .insert(wikiDiscussionComments)
            .values({
                threadId: threadRow.id,
                body: input.body.trim(),
                authorNickname: input.editor.nickname,
                authorId: input.editor.editorId,
                createdAt: now,
            })
            .returning();

        const firstComment = insertedComments[0]
            ? [rowToComment(insertedComments[0])]
            : [];

        return rowToThread(threadRow, firstComment);
    });
}

export async function addWikiDiscussionComment(input: {
    slug: string;
    threadId: number;
    body: string;
    editor: WikiEditorInfo;
}): Promise<{
    comment: WikiDiscussionComment;
    commentCount: number;
    lastCommentAt: string;
}> {
    const slug = await assertWikiPageExists(input.slug);
    if (!Number.isInteger(input.threadId) || input.threadId <= 0) {
        throw new WikiServiceError(UI_TEXT.WIKI.STORE_ERRORS.DISCUSSION_INVALID_THREAD_ID, 400);
    }

    const db = requireDb();
    const now = new Date();

    return db.transaction(async (tx) => {
        const threadRows = await tx
            .select()
            .from(wikiDiscussionThreads)
            .where(
                and(
                    eq(wikiDiscussionThreads.id, input.threadId),
                    eq(wikiDiscussionThreads.slug, slug),
                ),
            )
            .for("update");

        const threadRow = threadRows[0];
        if (!threadRow) {
            throw new WikiServiceError(UI_TEXT.WIKI.STORE_ERRORS.DISCUSSION_THREAD_NOT_FOUND, 404);
        }

        if (threadRow.status === "resolved") {
            throw new WikiServiceError(
                UI_TEXT.WIKI.STORE_ERRORS.DISCUSSION_CLOSED_FOR_COMMENT,
                409,
            );
        }

        const insertedComments = await tx
            .insert(wikiDiscussionComments)
            .values({
                threadId: threadRow.id,
                body: input.body.trim(),
                authorNickname: input.editor.nickname,
                authorId: input.editor.editorId,
                createdAt: now,
            })
            .returning();

        const commentRow = insertedComments[0];
        if (!commentRow) {
            throw new WikiServiceError(UI_TEXT.WIKI.STORE_ERRORS.DISCUSSION_COMMENT_FAILED, 500);
        }

        const nextCount = threadRow.commentCount + 1;
        await tx
            .update(wikiDiscussionThreads)
            .set({
                commentCount: nextCount,
                lastCommentAt: now,
            })
            .where(eq(wikiDiscussionThreads.id, threadRow.id));

        return {
            comment: rowToComment(commentRow),
            commentCount: nextCount,
            lastCommentAt: now.toISOString(),
        };
    });
}

export async function updateWikiDiscussionStatus(input: {
    slug: string;
    threadId: number;
    status: WikiDiscussionStatus;
    editor: WikiEditorInfo;
}): Promise<Omit<WikiDiscussionThread, "comments">> {
    const slug = await assertWikiPageExists(input.slug);
    if (!Number.isInteger(input.threadId) || input.threadId <= 0) {
        throw new WikiServiceError(UI_TEXT.WIKI.STORE_ERRORS.DISCUSSION_INVALID_THREAD_ID, 400);
    }

    const db = requireDb();
    const now = new Date();
    const isResolved = input.status === "resolved";

    const updatedRows = await db
        .update(wikiDiscussionThreads)
        .set({
            status: input.status,
            resolvedByNickname: isResolved ? input.editor.nickname : null,
            resolvedById: isResolved ? input.editor.editorId : null,
            resolvedAt: isResolved ? now : null,
        })
        .where(
            and(
                eq(wikiDiscussionThreads.id, input.threadId),
                eq(wikiDiscussionThreads.slug, slug),
            ),
        )
        .returning();

    const updated = updatedRows[0];
    if (!updated) {
        throw new WikiServiceError(UI_TEXT.WIKI.STORE_ERRORS.DISCUSSION_THREAD_NOT_FOUND, 404);
    }

    const {comments: _unused, ...meta} = rowToThread(updated);
    void _unused;
    return meta;
}
