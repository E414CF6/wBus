import {beforeEach, describe, expect, it, vi} from "vitest";
import {PgDialect} from "drizzle-orm/pg-core";
import * as realSchema from "@shared/db/schema";
import {
    addWikiDiscussionComment,
    createWikiDiscussionThread,
    listWikiDiscussions,
    updateWikiDiscussionStatus,
} from "./wikiDiscussionStore";
import {createWikiPage, saveWikiPageEdit} from "./wikiStore";

const dialect = new PgDialect();

const {
    pageRows,
    revisionRows,
    threadRows,
    commentRows,
} = vi.hoisted(() => ({
    pageRows: new Map<string, realSchema.WikiPageRow>(),
    revisionRows: [] as Array<realSchema.WikiRevisionRow>,
    threadRows: [] as Array<realSchema.WikiDiscussionThreadRow>,
    commentRows: [] as Array<realSchema.WikiDiscussionCommentRow>,
}));

let nextRevisionId = 1;
let nextThreadId = 1;
let nextCommentId = 1;

function createFakeDb() {
    const dbObj: Record<string, unknown> & {
        transaction: <T>(fn: (tx: typeof dbObj) => Promise<T>) => Promise<T>;
    } = {
        select(fields?: Record<string, unknown>) {
            return {
                from(table: unknown) {
                    let whereCond: unknown = undefined;
                    let limitVal: number | undefined;
                    const execute = () => {
                        const compiled = whereCond
                            ? dialect.sqlToQuery(whereCond as Parameters<typeof dialect.sqlToQuery>[0])
                            : {sql: "", params: []};

                        if (table === realSchema.wikiPages) {
                            let rows = [...pageRows.values()];
                            if (compiled.sql.includes('"wiki_pages"."slug" = $1')) {
                                rows = rows.filter((r) => r.slug === compiled.params[0]);
                            }
                            if (limitVal !== undefined) rows = rows.slice(0, limitVal);
                            if (fields && "slug" in fields && Object.keys(fields).length === 1) {
                                return rows.map((r) => ({slug: r.slug}));
                            }
                            return rows;
                        }

                        if (table === realSchema.wikiDiscussionThreads) {
                            let rows = threadRows.slice();
                            if (
                                compiled.sql.includes('"wiki_discussion_threads"."id" = $1') &&
                                compiled.sql.includes('"wiki_discussion_threads"."slug" = $2')
                            ) {
                                const id = Number(compiled.params[0]);
                                const slug = String(compiled.params[1]);
                                rows = rows.filter((r) => r.id === id && r.slug === slug);
                            } else if (compiled.sql.includes('"wiki_discussion_threads"."slug" = $1')) {
                                const slug = String(compiled.params[0]);
                                rows = rows.filter((r) => r.slug === slug);
                            }
                            rows.sort((a, b) => b.lastCommentAt.getTime() - a.lastCommentAt.getTime());
                            if (limitVal !== undefined) rows = rows.slice(0, limitVal);
                            return rows;
                        }

                        if (table === realSchema.wikiDiscussionComments) {
                            let rows = commentRows.slice();
                            if (compiled.sql.includes('"wiki_discussion_comments"."thread_id" in')) {
                                const allowed = new Set(compiled.params.map((p) => Number(p)));
                                rows = rows.filter((r) => allowed.has(r.threadId));
                            }
                            rows.sort((a, b) => a.id - b.id);
                            return rows;
                        }

                        return [];
                    };

                    const builder: Record<string, unknown> = {
                        where(cond: unknown) {
                            whereCond = cond;
                            return builder;
                        },
                        orderBy() {
                            return builder;
                        },
                        limit(n: number) {
                            limitVal = n;
                            return builder;
                        },
                        for() {
                            return Promise.resolve(execute());
                        },
                        then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
                            return Promise.resolve(execute()).then(onFulfilled, onRejected);
                        },
                    };
                    return builder;
                },
            };
        },
        insert(table: unknown) {
            return {
                values(val: Record<string, unknown>) {
                    const execInsert = () => {
                        if (table === realSchema.wikiPages) {
                            const slug = String(val.slug);
                            const row: realSchema.WikiPageRow = {
                                slug,
                                subtitle: String(val.subtitle ?? ""),
                                pinColor: (val.pinColor as realSchema.WikiPageRow["pinColor"]) ?? "navy",
                                lat: (val.lat as number | null) ?? null,
                                lng: (val.lng as number | null) ?? null,
                                tags: (val.tags as string[]) ?? [],
                                tagsText: String(val.tagsText ?? ""),
                                version: Number(val.version ?? 1),
                                isProtected: Boolean(val.isProtected ?? false),
                                pinned: Boolean(val.pinned ?? false),
                                lastEditorNickname: String(val.lastEditorNickname),
                                lastEditorId: String(val.lastEditorId),
                                markdownBody: String(val.markdownBody ?? ""),
                                createdAt: (val.createdAt as Date) ?? new Date(),
                                updatedAt: (val.updatedAt as Date) ?? new Date(),
                            };
                            pageRows.set(slug, row);
                            return [row];
                        }

                        if (table === realSchema.wikiRevisions) {
                            const row: realSchema.WikiRevisionRow = {
                                id: nextRevisionId++,
                                slug: String(val.slug),
                                version: Number(val.version),
                                baseVersion: Number(val.baseVersion),
                                summary: String(val.summary ?? ""),
                                editorNickname: String(val.editorNickname),
                                editorId: String(val.editorId),
                                diffStats: val.diffStats as realSchema.WikiRevisionRow["diffStats"],
                                isCheckpoint: Boolean(val.isCheckpoint),
                                snapshot: (val.snapshot as realSchema.WikiRevisionRow["snapshot"]) ?? null,
                                delta: (val.delta as realSchema.WikiRevisionRow["delta"]) ?? null,
                                createdAt: (val.createdAt as Date) ?? new Date(),
                            };
                            revisionRows.push(row);
                            return [row];
                        }

                        if (table === realSchema.wikiDiscussionThreads) {
                            const row: realSchema.WikiDiscussionThreadRow = {
                                id: nextThreadId++,
                                slug: String(val.slug),
                                title: String(val.title),
                                status: (val.status as "open" | "resolved") ?? "open",
                                authorNickname: String(val.authorNickname),
                                authorId: String(val.authorId),
                                commentCount: Number(val.commentCount ?? 1),
                                lastCommentAt: (val.lastCommentAt as Date) ?? new Date(),
                                resolvedByNickname: null,
                                resolvedById: null,
                                resolvedAt: null,
                                createdAt: (val.createdAt as Date) ?? new Date(),
                            };
                            threadRows.push(row);
                            return [row];
                        }

                        if (table === realSchema.wikiDiscussionComments) {
                            const row: realSchema.WikiDiscussionCommentRow = {
                                id: nextCommentId++,
                                threadId: Number(val.threadId),
                                body: String(val.body),
                                authorNickname: String(val.authorNickname),
                                authorId: String(val.authorId),
                                createdAt: (val.createdAt as Date) ?? new Date(),
                            };
                            commentRows.push(row);
                            return [row];
                        }

                        return [];
                    };

                    return {
                        returning() {
                            return Promise.resolve().then(execInsert);
                        },
                        then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
                            return Promise.resolve().then(execInsert).then(onFulfilled, onRejected);
                        },
                    };
                },
            };
        },
        update(table: unknown) {
            return {
                set(patch: Record<string, unknown>) {
                    return {
                        where(cond: unknown) {
                            const execUpdate = () => {
                                const compiled = dialect.sqlToQuery(
                                    cond as Parameters<typeof dialect.sqlToQuery>[0],
                                );
                                if (table === realSchema.wikiRevisions) {
                                    const oldSlug = String(compiled.params[0]);
                                    const newSlug = patch.slug ? String(patch.slug) : oldSlug;
                                    for (const rev of revisionRows) {
                                        if (rev.slug === oldSlug) rev.slug = newSlug;
                                    }
                                    return [];
                                }
                                if (table === realSchema.wikiDiscussionThreads) {
                                    if (patch.slug && compiled.sql.includes('"wiki_discussion_threads"."slug" = $1')) {
                                        const oldSlug = String(compiled.params[0]);
                                        const newSlug = String(patch.slug);
                                        const updated: realSchema.WikiDiscussionThreadRow[] = [];
                                        for (const t of threadRows) {
                                            if (t.slug === oldSlug) {
                                                t.slug = newSlug;
                                                updated.push(t);
                                            }
                                        }
                                        return updated;
                                    }
                                    if (compiled.sql.includes('"wiki_discussion_threads"."id" = $1')) {
                                        const id = Number(compiled.params[0]);
                                        const slug =
                                            compiled.params.length > 1 ? String(compiled.params[1]) : null;
                                        const updated: realSchema.WikiDiscussionThreadRow[] = [];
                                        for (const t of threadRows) {
                                            if (t.id === id && (slug === null || t.slug === slug)) {
                                                Object.assign(t, patch);
                                                updated.push(t);
                                            }
                                        }
                                        return updated;
                                    }
                                }
                                return [];
                            };
                            return {
                                returning() {
                                    return Promise.resolve().then(execUpdate);
                                },
                                then(
                                    onFulfilled: (v: unknown) => unknown,
                                    onRejected?: (e: unknown) => unknown,
                                ) {
                                    return Promise.resolve().then(execUpdate).then(onFulfilled, onRejected);
                                },
                            };
                        },
                    };
                },
            };
        },
        delete(table: unknown) {
            return {
                where(cond: unknown) {
                    const execDelete = () => {
                        const compiled = dialect.sqlToQuery(
                            cond as Parameters<typeof dialect.sqlToQuery>[0],
                        );
                        if (table === realSchema.wikiPages) {
                            const targetSlug = String(compiled.params[0]);
                            pageRows.delete(targetSlug);
                            // Simulate ON DELETE CASCADE
                            for (let i = threadRows.length - 1; i >= 0; i--) {
                                if (threadRows[i].slug === targetSlug) {
                                    threadRows.splice(i, 1);
                                }
                            }
                        }
                    };
                    return {
                        then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
                            return Promise.resolve().then(execDelete).then(onFulfilled, onRejected);
                        },
                    };
                },
            };
        },
        transaction<T>(fn: (tx: typeof dbObj) => Promise<T>): Promise<T> {
            return fn(dbObj);
        },
    };
    return dbObj;
}

const fakeDb = createFakeDb();

vi.mock("@shared/db", async () => {
    const actualSchema = await vi.importActual<typeof import("@shared/db/schema")>("@shared/db/schema");
    return {
        ...actualSchema,
        isDatabaseConfigured: () => true,
        getDb: () => fakeDb,
    };
});

vi.mock("@shared/cache/distributedCache", () => ({
    distributedCache: {
        get: vi.fn(async () => null),
        set: vi.fn(async () => true),
        del: vi.fn(async () => true),
        incrWithWindow: vi.fn(async () => null),
    },
}));

vi.mock("@shared/cache/artifactStore", () => ({
    artifactStore: {
        getJson: vi.fn(async () => null),
    },
}));

describe("wikiDiscussionStore", () => {
    beforeEach(() => {
        pageRows.clear();
        revisionRows.length = 0;
        threadRows.length = 0;
        commentRows.length = 0;
        nextRevisionId = 1;
        nextThreadId = 1;
        nextCommentId = 1;
    });

    it("creates threads, appends replies, enforces resolved lock, and reopens", async () => {
        await createWikiPage({
            slug: "원주역 광장",
            title: "원주역 광장",
            subtitle: "",
            pinColor: "navy",
            tags: [],
            markdownBody: "본문",
            summary: "생성",
            editor: {nickname: "작성자", editorId: "ed-1"},
        });

        const thread = await createWikiDiscussionThread({
            slug: "원주역 광장",
            title: "승강장 위치 확인",
            body: "2번 출구 앞이 맞나요?",
            editor: {nickname: "질문자", editorId: "ed-2"},
        });

        expect(thread.status).toBe("open");
        expect(thread.commentCount).toBe(1);
        expect(thread.comments).toHaveLength(1);

        const reply = await addWikiDiscussionComment({
            slug: "원주역 광장",
            threadId: thread.id,
            body: "네, 2번 출구 오른쪽 정류장입니다.",
            editor: {nickname: "답변자", editorId: "ed-3"},
        });
        expect(reply.commentCount).toBe(2);

        const resolvedMeta = await updateWikiDiscussionStatus({
            slug: "원주역 광장",
            threadId: thread.id,
            status: "resolved",
            editor: {nickname: "정리자", editorId: "ed-4"},
        });
        expect(resolvedMeta.status).toBe("resolved");
        expect(resolvedMeta.resolvedBy?.nickname).toBe("정리자");

        await expect(
            addWikiDiscussionComment({
                slug: "원주역 광장",
                threadId: thread.id,
                body: "닫힌 스레드 댓글",
                editor: {nickname: "후발", editorId: "ed-5"},
            }),
        ).rejects.toMatchObject({status: 409});

        const list = await listWikiDiscussions("원주역 광장");
        expect(list.openCount).toBe(0);
        expect(list.resolvedCount).toBe(1);
        expect(list.threads[0].comments).toHaveLength(2);
    });

    it("preserves discussion threads when page slug/title is renamed", async () => {
        await createWikiPage({
            slug: "구 문서명",
            title: "구 문서명",
            subtitle: "",
            pinColor: "navy",
            tags: [],
            markdownBody: "본문",
            summary: "생성",
            editor: {nickname: "작성자", editorId: "ed-1"},
        });

        await createWikiDiscussionThread({
            slug: "구 문서명",
            title: "제목 변경 건의",
            body: "새 이름 적용 필요",
            editor: {nickname: "제안자", editorId: "ed-2"},
        });

        await saveWikiPageEdit({
            slug: "구 문서명",
            baseVersion: 1,
            title: "신 문서명",
            subtitle: "",
            pinColor: "navy",
            tags: [],
            markdownBody: "본문",
            summary: "제목 변경",
            editor: {nickname: "편집자", editorId: "ed-3"},
        });

        const list = await listWikiDiscussions("신 문서명");
        expect(list.openCount).toBe(1);
        expect(list.threads[0].title).toBe("제목 변경 건의");
    });
});
