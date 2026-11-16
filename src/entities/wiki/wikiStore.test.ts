import {beforeEach, describe, expect, it, vi} from "vitest";
import {PgDialect} from "drizzle-orm/pg-core";
import * as realSchema from "@shared/db/schema";
import {
    _resetWikiBootstrapForTests,
    createWikiPage,
    deleteWikiPage,
    getWikiPage,
    getWikiRevision,
    getWikiRevisionList,
    listWikiPages,
    revertWikiPage,
    saveWikiPageEdit,
    setWikiPageProtection,
    WikiServiceError,
} from "./wikiStore";

const dialect = new PgDialect();

const {
    pageRows,
    revisionRows,
    memCache,
    memBlobs,
    memRateCounts,
} = vi.hoisted(() => ({
    pageRows: new Map<string, realSchema.WikiPageRow>(),
    revisionRows: [] as Array<realSchema.WikiRevisionRow>,
    memCache: new Map<string, unknown>(),
    memBlobs: new Map<string, unknown>(),
    memRateCounts: new Map<string, number>(),
}));

let nextRevisionId = 1;

function evalPageRowPredicate(
    row: realSchema.WikiPageRow,
    sqlText: string,
    params: unknown[]
): boolean {
    if (!sqlText) return true;

    // Split top-level AND clauses when checking category + search OR
    let result = true;
    const categoryIdx = sqlText.indexOf('"wiki_pages"."category" = $');
    if (categoryIdx !== -1) {
        const m = sqlText.slice(categoryIdx).match(/\$(\d+)/);
        if (m) {
            const cat = params[Number(m[1]) - 1];
            if (row.category !== cat) result = false;
        }
    }

    const cityIdx = sqlText.indexOf('"wiki_pages"."city_code" = $');
    if (cityIdx !== -1) {
        const m = sqlText.slice(cityIdx).match(/\$(\d+)/);
        if (m) {
            const city = params[Number(m[1]) - 1];
            if (row.cityCode !== city) result = false;
        }
    }

    if (sqlText.includes('"wiki_pages"."lat" is not null') && row.lat == null) {
        result = false;
    }
    if (sqlText.includes('"wiki_pages"."lng" is not null') && row.lng == null) {
        result = false;
    }

    const slugEqMatch = sqlText.match(/^"wiki_pages"\."slug" = \$1$/);
    if (slugEqMatch) {
        return row.slug === params[0];
    }

    const ilikeMatches = [...sqlText.matchAll(/"wiki_pages"\."([^"]+)" ilike \$(\d+)/gi)];
    if (ilikeMatches.length > 0) {
        const matchedAny = ilikeMatches.some((match) => {
            const col = match[1];
            const rawPattern = String(params[Number(match[2]) - 1] ?? "");
            const needle = rawPattern.replace(/^%|%$/g, "").replace(/\\([%_\\])/g, "$1").toLowerCase();
            const val =
                col === "title"
                    ? row.title
                    : col === "subtitle"
                        ? row.subtitle
                        : col === "slug"
                            ? row.slug
                            : col === "tags_text"
                                ? row.tagsText
                                : col === "markdown_body"
                                    ? row.markdownBody
                                    : "";
            return val.toLowerCase().includes(needle);
        });
        if (!matchedAny) result = false;
    }

    return result;
}

function evalRevisionPredicate(
    row: realSchema.WikiRevisionRow,
    sqlText: string,
    params: unknown[]
): boolean {
    if (!sqlText) return true;

    // Handle parameterized comparisons in order of appearance
    const tokenRegex = /"wiki_revisions"\."([^"]+)"\s*(=|<=|>=|<|>)\s*(\$\d+|true|false)/gi;
    const matches = [...sqlText.matchAll(tokenRegex)];
    for (const m of matches) {
        const col = m[1];
        const op = m[2];
        const rawVal = m[3];
        const val =
            rawVal === "true"
                ? true
                : rawVal === "false"
                    ? false
                    : params[Number(rawVal.slice(1)) - 1];

        if (col === "slug" && op === "=") {
            if (row.slug !== val) return false;
        } else if (col === "version") {
            const target = Number(val);
            if (op === "=" && row.version !== target) return false;
            if (op === "<=" && !(row.version <= target)) return false;
            if (op === ">=" && !(row.version >= target)) return false;
        } else if (col === "is_checkpoint" && op === "=") {
            if (row.isCheckpoint !== Boolean(val)) return false;
        }
    }
    return true;
}

function createFakeDb() {
    const dbObj: Record<string, unknown> & {
        transaction: <T>(fn: (tx: typeof dbObj) => Promise<T>) => Promise<T>;
    } = {
        select(fields?: Record<string, unknown>) {
            return {
                from(table: unknown) {
                    let whereCond: unknown = undefined;
                    let isInnerJoinPages = false;
                    let orderSpec: Array<{ sql: string }> = [];
                    let limitVal: number | undefined;
                    let offsetVal = 0;

                    const execute = () => {
                        const compiled = whereCond
                            ? dialect.sqlToQuery(whereCond as Parameters<typeof dialect.sqlToQuery>[0])
                            : {sql: "", params: []};

                        if (table === realSchema.wikiPages) {
                            let rows = [...pageRows.values()].filter((r) =>
                                evalPageRowPredicate(r, compiled.sql, compiled.params)
                            );

                            if (fields && "total" in fields && Object.keys(fields).length === 1) {
                                return [{total: rows.length}];
                            }

                            rows.sort((a, b) => {
                                if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                                return b.updatedAt.getTime() - a.updatedAt.getTime();
                            });

                            if (offsetVal > 0) rows = rows.slice(offsetVal);
                            if (limitVal !== undefined) rows = rows.slice(0, limitVal);

                            if (fields && "slug" in fields && Object.keys(fields).length === 1) {
                                return rows.map((r) => ({slug: r.slug}));
                            }
                            return rows;
                        }

                        if (table === realSchema.wikiRevisions) {
                            if (isInnerJoinPages) {
                                let joined = revisionRows
                                    .filter((rev) => pageRows.has(rev.slug))
                                    .map((rev) => {
                                        const page = pageRows.get(rev.slug)!;
                                        return {
                                            slug: rev.slug,
                                            title: page.title,
                                            category: page.category,
                                            version: rev.version,
                                            summary: rev.summary,
                                            editorNickname: rev.editorNickname,
                                            editorId: rev.editorId,
                                            diffStats: rev.diffStats,
                                            createdAt: rev.createdAt,
                                        };
                                    })
                                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                                if (limitVal !== undefined) joined = joined.slice(0, limitVal);
                                return joined;
                            }

                            let rows = revisionRows.filter((r) =>
                                evalRevisionPredicate(r, compiled.sql, compiled.params)
                            );

                            const orderSql = orderSpec.map((o) => o.sql).join(",");
                            if (orderSql.includes("asc")) {
                                rows.sort((a, b) => a.version - b.version);
                            } else {
                                rows.sort((a, b) => b.version - a.version);
                            }

                            if (limitVal !== undefined) rows = rows.slice(0, limitVal);

                            if (fields && "version" in fields && Object.keys(fields).length === 1) {
                                return rows.map((r) => ({version: r.version}));
                            }
                            return rows;
                        }

                        return [];
                    };

                    const builder: Record<string, unknown> = {
                        innerJoin() {
                            isInnerJoinPages = true;
                            return builder;
                        },
                        where(cond: unknown) {
                            whereCond = cond;
                            return builder;
                        },
                        orderBy(...orders: unknown[]) {
                            orderSpec = orders.map((o) => ({
                                sql: dialect.sqlToQuery(o as Parameters<typeof dialect.sqlToQuery>[0]).sql,
                            }));
                            return builder;
                        },
                        limit(n: number) {
                            limitVal = n;
                            return builder;
                        },
                        offset(n: number) {
                            offsetVal = n;
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
                    let ignoreConflict = false;
                    const execInsert = () => {
                        if (table === realSchema.wikiPages) {
                            const slug = String(val.slug);
                            if (pageRows.has(slug)) {
                                if (ignoreConflict) return;
                                const err = new Error("duplicate key") as Error & { code: string };
                                err.code = "23505";
                                throw err;
                            }
                            const row: realSchema.WikiPageRow = {
                                slug,
                                title: String(val.title),
                                subtitle: String(val.subtitle ?? ""),
                                category: val.category as realSchema.WikiPageRow["category"],
                                cityCode: (val.cityCode as string | null) ?? null,
                                lat: (val.lat as number | null) ?? null,
                                lng: (val.lng as number | null) ?? null,
                                tags: (val.tags as string[]) ?? [],
                                tagsText: String(val.tagsText ?? ""),
                                version: Number(val.version ?? 1),
                                isProtected: Boolean(val.isProtected ?? false),
                                pinned: Boolean(val.pinned ?? false),
                                lastEditorNickname: String(val.lastEditorNickname),
                                lastEditorId: String(val.lastEditorId),
                                linkedRoutes: (val.linkedRoutes as realSchema.WikiPageRow["linkedRoutes"]) ?? [],
                                shuttle: (val.shuttle as realSchema.WikiPageRow["shuttle"]) ?? null,
                                boardingStops: (val.boardingStops as realSchema.WikiPageRow["boardingStops"]) ?? [],
                                markdownBody: String(val.markdownBody ?? ""),
                                createdAt: (val.createdAt as Date) ?? new Date(),
                                updatedAt: (val.updatedAt as Date) ?? new Date(),
                            };
                            pageRows.set(slug, row);
                            return;
                        }

                        if (table === realSchema.wikiRevisions) {
                            const slug = String(val.slug);
                            const version = Number(val.version);
                            const exists = revisionRows.some(
                                (r) => r.slug === slug && r.version === version
                            );
                            if (exists) {
                                if (ignoreConflict) return;
                                const err = new Error("duplicate revision") as Error & { code: string };
                                err.code = "23505";
                                throw err;
                            }
                            revisionRows.push({
                                id: nextRevisionId++,
                                slug,
                                version,
                                baseVersion: Number(val.baseVersion),
                                summary: String(val.summary ?? ""),
                                editorNickname: String(val.editorNickname),
                                editorId: String(val.editorId),
                                diffStats: val.diffStats as realSchema.WikiRevisionRow["diffStats"],
                                isCheckpoint: Boolean(val.isCheckpoint),
                                snapshot: (val.snapshot as realSchema.WikiRevisionRow["snapshot"]) ?? null,
                                delta: (val.delta as realSchema.WikiRevisionRow["delta"]) ?? null,
                                createdAt: (val.createdAt as Date) ?? new Date(),
                            });
                        }
                    };

                    return {
                        onConflictDoNothing() {
                            ignoreConflict = true;
                            return Promise.resolve().then(execInsert);
                        },
                        returning() {
                            return Promise.resolve().then(() => {
                                execInsert();
                                const row = pageRows.get(String(val.slug));
                                return row ? [row] : [];
                            });
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
                                    cond as Parameters<typeof dialect.sqlToQuery>[0]
                                );
                                if (table === realSchema.wikiRevisions) {
                                    const oldSlug = String(compiled.params[0]);
                                    const newSlug = patch.slug ? String(patch.slug) : oldSlug;
                                    const updatedRevs: realSchema.WikiRevisionRow[] = [];
                                    for (const rev of revisionRows) {
                                        if (rev.slug === oldSlug) {
                                            rev.slug = newSlug;
                                            updatedRevs.push(rev);
                                        }
                                    }
                                    return updatedRevs;
                                }
                                if (table !== realSchema.wikiPages) return [];
                                const slug = String(compiled.params[0]);
                                const row = pageRows.get(slug);
                                if (!row) return [];
                                // Check optional version CAS in params[1]
                                if (compiled.sql.includes('"version"') && compiled.params.length >= 2) {
                                    if (row.version !== Number(compiled.params[1])) {
                                        return [];
                                    }
                                }
                                const updated: realSchema.WikiPageRow = {
                                    ...row,
                                    ...(patch as Partial<realSchema.WikiPageRow>),
                                };
                                pageRows.set(slug, updated);
                                return [updated];
                            };
                            return {
                                returning() {
                                    return Promise.resolve().then(execUpdate);
                                },
                                then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
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
                    return Promise.resolve().then(() => {
                        if (table !== realSchema.wikiPages) return;
                        const compiled = dialect.sqlToQuery(
                            cond as Parameters<typeof dialect.sqlToQuery>[0]
                        );
                        const slug = String(compiled.params[0]);
                        pageRows.delete(slug);
                        for (let i = revisionRows.length - 1; i >= 0; i--) {
                            if (revisionRows[i].slug === slug) {
                                revisionRows.splice(i, 1);
                            }
                        }
                    });
                },
            };
        },
        transaction: <T>(fn: (tx: typeof dbObj) => Promise<T>): Promise<T> => {
            return fn(dbObj);
        },
    };
    return dbObj;
}

vi.mock("@shared/db", () => ({
    ...realSchema,
    isDatabaseConfigured: vi.fn(() => true),
    getDb: vi.fn(() => createFakeDb()),
}));

vi.mock("@shared/cache/distributedCache", () => ({
    distributedCache: {
        get: vi.fn(async (key: string) => memCache.get(key) ?? null),
        set: vi.fn(async (key: string, value: unknown) => {
            memCache.set(key, structuredClone(value));
            return true;
        }),
        del: vi.fn(async (key: string) => {
            memCache.delete(key);
            return true;
        }),
        incrWithWindow: vi.fn(async (key: string) => {
            const next = (memRateCounts.get(key) ?? 0) + 1;
            memRateCounts.set(key, next);
            return next;
        }),
    },
}));

vi.mock("@shared/cache/artifactStore", () => ({
    artifactStore: {
        getJson: vi.fn(async (relativeKey: string) => {
            const data = memBlobs.get(relativeKey);
            if (!data) return null;
            return {data: structuredClone(data), source: "blob"};
        }),
        putJson: vi.fn(async (relativeKey: string, data: unknown) => {
            memBlobs.set(relativeKey, structuredClone(data));
        }),
        deleteJson: vi.fn(async (relativeKey: string) => {
            memBlobs.delete(relativeKey);
        }),
    },
}));

describe("wikiStore Postgres + Delta integration", () => {
    beforeEach(() => {
        pageRows.clear();
        revisionRows.length = 0;
        nextRevisionId = 1;
        memCache.clear();
        memBlobs.clear();
        memRateCounts.clear();
        _resetWikiBootstrapForTests();
    });

    it("bootstraps seed, stores delta revisions with checkpoints every 10th version, and reverts losslessly", async () => {
        const canonicalSlug = "연세대학교 미래캠퍼스";
        const initial = await getWikiPage("yonsei-mirae");
        expect(initial).not.toBeNull();
        expect(initial?.slug).toBe(canonicalSlug);
        expect(initial?.version).toBe(1);

        // Edit sequentially v1 -> v11 (v1 and v10 checkpoints, v2..v9 & v11 deltas)
        let currentDoc = initial!;
        for (let v = 2; v <= 11; v++) {
            const editRes = await saveWikiPageEdit({
                slug: canonicalSlug,
                baseVersion: currentDoc.version,
                title: currentDoc.title,
                subtitle: currentDoc.subtitle,
                category: currentDoc.category,
                cityCode: currentDoc.cityCode,
                tags: currentDoc.tags,
                linkedRoutes: currentDoc.linkedRoutes,
                shuttle: currentDoc.shuttle,
                boardingStops: currentDoc.boardingStops,
                markdownBody: `${currentDoc.markdownBody}\n- v${v} 학우 제보 팁`,
                summary: `v${v} 팁 추가`,
                editor: {nickname: `학우${v}`, editorId: `ed-${v}`},
            });
            currentDoc = editRes.document;
        }

        expect(currentDoc.version).toBe(11);

        // Verify checkpoint flags in Postgres revisions table
        const rev5Row = revisionRows.find((r) => r.slug === canonicalSlug && r.version === 5);
        const rev10Row = revisionRows.find((r) => r.slug === canonicalSlug && r.version === 10);
        expect(rev5Row?.isCheckpoint).toBe(false);
        expect(rev5Row?.snapshot).toBeNull();
        expect(rev5Row?.delta).not.toBeNull();
        expect(rev10Row?.isCheckpoint).toBe(true);
        expect(rev10Row?.snapshot).not.toBeNull();

        // Reconstruct v5 (from v1) and v11 (from v10) cleanly
        const rev5 = await getWikiRevision(canonicalSlug, 5);
        const rev11 = await getWikiRevision(canonicalSlug, 11);
        expect(rev5?.snapshot.markdownBody).toContain("- v5 학우 제보 팁");
        expect(rev5?.snapshot.markdownBody).not.toContain("- v6 학우 제보 팁");
        expect(rev11?.snapshot.markdownBody).toContain("- v11 학우 제보 팁");

        // Stale baseVersion -> 409 Conflict
        await expect(
            saveWikiPageEdit({
                slug: canonicalSlug,
                baseVersion: 4,
                title: currentDoc.title,
                subtitle: currentDoc.subtitle,
                category: currentDoc.category,
                cityCode: currentDoc.cityCode,
                tags: currentDoc.tags,
                linkedRoutes: currentDoc.linkedRoutes,
                shuttle: currentDoc.shuttle,
                boardingStops: currentDoc.boardingStops,
                markdownBody: "충돌 시도",
                summary: "충돌",
                editor: {nickname: "학우X", editorId: "ed-x"},
            })
        ).rejects.toMatchObject({status: 409});

        const revisions = await getWikiRevisionList(canonicalSlug);
        expect(revisions[0].version).toBe(11);
        expect(revisions[revisions.length - 1].version).toBe(1);

        // Revert to v1 -> v12 checkpoint
        const revertRes = await revertWikiPage({
            slug: canonicalSlug,
            targetVersion: 1,
            baseVersion: 11,
            summary: "초기 버전 복구",
            editor: {nickname: "관리자", editorId: "ed-admin"},
        });
        expect(revertRes.document.version).toBe(12);
        expect(revertRes.document.markdownBody).toBe(initial!.markdownBody);
        const rev12Row = revisionRows.find((r) => r.slug === canonicalSlug && r.version === 12);
        expect(rev12Row?.isCheckpoint).toBe(true);
    });

    it("migrates existing Vercel Blob pages/revisions lazily into Postgres without data loss", async () => {
        const legacyDoc = {
            slug: "legacy-blob-hub",
            title: "기존 Blob 정류장 문서",
            subtitle: "마이그레이션 검증",
            category: "stop" as const,
            cityCode: "32020",
            tags: ["기존블롭"],
            version: 2,
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-02T00:00:00.000Z",
            lastEditor: {nickname: "기존기여자", editorId: "ed-blob"},
            linkedRoutes: [],
            shuttle: null,
            boardingStops: [],
            markdownBody: "## 기존 내용\nBlob에서 Postgres로 자동 이관됩니다.",
        };

        memBlobs.set("wiki/pages/legacy-blob-hub.json", legacyDoc);
        memBlobs.set("wiki/revisions/legacy-blob-hub/index.json", [
            {
                slug: "legacy-blob-hub",
                version: 2,
                baseVersion: 1,
                summary: "v2 업데이트",
                editor: {nickname: "기존기여자", editorId: "ed-blob"},
                createdAt: "2026-03-02T00:00:00.000Z",
                diffStats: {added: 1, removed: 0, structuredChanges: []},
            },
            {
                slug: "legacy-blob-hub",
                version: 1,
                baseVersion: 0,
                summary: "최초 생성",
                editor: {nickname: "기존기여자", editorId: "ed-blob"},
                createdAt: "2026-03-01T00:00:00.000Z",
                diffStats: {added: 2, removed: 0, structuredChanges: ["문서 최초 생성"]},
            },
        ]);
        memBlobs.set("wiki/revisions/legacy-blob-hub/v1.json", {
            slug: "legacy-blob-hub",
            version: 1,
            baseVersion: 0,
            summary: "최초 생성",
            editor: {nickname: "기존기여자", editorId: "ed-blob"},
            createdAt: "2026-03-01T00:00:00.000Z",
            diffStats: {added: 2, removed: 0, structuredChanges: ["문서 최초 생성"]},
            snapshot: {...legacyDoc, version: 1, markdownBody: "## 초기 내용"},
        });
        memBlobs.set("wiki/revisions/legacy-blob-hub/v2.json", {
            slug: "legacy-blob-hub",
            version: 2,
            baseVersion: 1,
            summary: "v2 업데이트",
            editor: {nickname: "기존기여자", editorId: "ed-blob"},
            createdAt: "2026-03-02T00:00:00.000Z",
            diffStats: {added: 1, removed: 0, structuredChanges: []},
            snapshot: legacyDoc,
        });

        const migrated = await getWikiPage("legacy-blob-hub");
        expect(migrated?.version).toBe(2);
        expect(pageRows.has("legacy-blob-hub")).toBe(true);

        const rev1 = await getWikiRevision("legacy-blob-hub", 1);
        expect(rev1?.snapshot.markdownBody).toBe("## 초기 내용");
    });

    it("supports markdown body search, pagination, protection locks, and deletion", async () => {
        const created = await createWikiPage({
            slug: "custom-stop-guide",
            title: "남원주역 정류장 가이드",
            subtitle: "KTX 환승 버스 안내",
            category: "terminal",
            cityCode: "32020",
            tags: ["남원주역"],
            linkedRoutes: [],
            shuttle: null,
            boardingStops: [],
            markdownBody: "## 위치\n남원주역 광장 앞 유니크키워드XY123 탑승장",
            summary: "문서 개설",
            editor: {nickname: "개설자", editorId: "ed-3"},
        });

        expect(created.slug).toBe("남원주역 정류장 가이드");

        // Search inside markdownBody directly
        const bodySearch = await listWikiPages({query: "유니크키워드XY123"});
        expect(bodySearch.pages.map((p) => p.slug)).toEqual(["남원주역 정류장 가이드"]);
        expect(bodySearch.totalCount).toBe(1);
        expect(bodySearch.hasMore).toBe(false);

        // Lock page
        await setWikiPageProtection("남원주역 정류장 가이드", true);
        await expect(
            saveWikiPageEdit({
                slug: "남원주역 정류장 가이드",
                baseVersion: 1,
                title: created.title,
                subtitle: created.subtitle,
                category: created.category,
                cityCode: created.cityCode,
                tags: created.tags,
                linkedRoutes: [],
                shuttle: null,
                boardingStops: [],
                markdownBody: "비관리자 수정 시도",
                summary: "차단 대상",
                editor: {nickname: "일반", editorId: "ed-4"},
                isAdmin: false,
            })
        ).rejects.toBeInstanceOf(WikiServiceError);

        // Unlock & rename title -> updates slug atomically and preserves revision chain
        await setWikiPageProtection("남원주역 정류장 가이드", false);
        const renamed = await saveWikiPageEdit({
            slug: "남원주역 정류장 가이드",
            baseVersion: 1,
            title: "남원주역 KTX 버스 승강장",
            subtitle: created.subtitle,
            category: created.category,
            cityCode: created.cityCode,
            tags: created.tags,
            linkedRoutes: [],
            shuttle: null,
            boardingStops: [],
            markdownBody: created.markdownBody,
            summary: "제목 및 슬러그 통일",
            editor: {nickname: "편집자", editorId: "ed-5"},
        });
        expect(renamed.document.slug).toBe("남원주역 KTX 버스 승강장");
        expect(pageRows.has("남원주역 정류장 가이드")).toBe(false);
        expect(pageRows.has("남원주역 KTX 버스 승강장")).toBe(true);
        const renamedRevs = await getWikiRevisionList("남원주역 KTX 버스 승강장");
        expect(renamedRevs.length).toBe(2);

        // Pinned hubs cannot be deleted
        await expect(deleteWikiPage("연세대학교 미래캠퍼스")).rejects.toMatchObject({status: 400});

        // Custom page can be deleted
        await deleteWikiPage("남원주역 KTX 버스 승강장");
        expect(pageRows.has("남원주역 KTX 버스 승강장")).toBe(false);
    });

    it("stores map pin coordinates and filters geolocated wiki pins via pinsOnly", async () => {
        const pinnedDoc = await createWikiPage({
            slug: "단계동-정류장-핀",
            title: "단계동 정류장 핀",
            subtitle: "터미널 사거리 탑승 안내",
            category: "stop",
            cityCode: "32020",
            lat: 37.3456,
            lng: 127.9311,
            tags: ["단계동"],
            linkedRoutes: [],
            shuttle: null,
            boardingStops: [],
            markdownBody: "단계동 정류장 설명",
            summary: "핀 추가",
            editor: {nickname: "핀작성자", editorId: "ed-pin-1"},
        });
        expect(pinnedDoc.lat).toBe(37.3456);
        expect(pinnedDoc.lng).toBe(127.9311);

        await createWikiPage({
            slug: "좌표없는-가이드",
            title: "좌표없는 가이드",
            subtitle: "일반 안내",
            category: "guide",
            cityCode: "32020",
            tags: [],
            linkedRoutes: [],
            shuttle: null,
            boardingStops: [],
            markdownBody: "일반 팁",
            summary: "생성",
            editor: {nickname: "작성자", editorId: "ed-pin-2"},
        });

        const pinsList = await listWikiPages({pinsOnly: true, cityCode: "32020"});
        const slugs = pinsList.pages.map((p) => p.slug);
        expect(slugs).toContain("단계동 정류장 핀");
        expect(slugs).toContain("연세대학교 미래캠퍼스");
        expect(slugs).not.toContain("좌표없는 가이드");
    });
});
