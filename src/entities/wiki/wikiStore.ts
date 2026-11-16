import "server-only";

import {createHash} from "crypto";
import {and, asc, count, desc, eq, gte, ilike, isNotNull, lte, or} from "drizzle-orm";
import {artifactStore} from "@shared/cache/artifactStore";
import {distributedCache} from "@shared/cache/distributedCache";
import {
    getDb,
    isDatabaseConfigured,
    type WikiDatabase,
    type WikiPageRow,
    wikiPages,
    type WikiRevisionRow,
    wikiRevisions,
} from "@shared/db";
import {applyWikiDelta, computeWikiDelta, shouldStoreCheckpoint,} from "./lib/wikiDelta";
import {computeWikiDiffStats, hasWikiContentChanged} from "./lib/wikiDiff";
import {extractWikiStructuredCounts, mergeStructuredBlocksIntoMarkdown} from "./lib/wikiMarkdown";
import {DEFAULT_WIKI_PIN_COLOR, isValidWikiSlug, normalizeWikiSlug, WikiPageDocumentSchema,} from "./schemas";
import type {
    WikiBoardingStop,
    WikiEditorInfo,
    WikiIndexData,
    WikiLinkedRoute,
    WikiPageDocument,
    WikiPageSummary,
    WikiPinColor,
    WikiRecentChangeItem,
    WikiRevision,
    WikiRevisionMeta,
    WikiShuttleBlock,
} from "./types";

const REDIS_PAGE_PREFIX = "wiki:page:";
const REDIS_RATE_PREFIX = "wiki:ratelimit:";
const REDIS_CACHE_TTL_SECONDS = 3600;

const BLOB_PAGE_PREFIX = "wiki/pages";
const BLOB_REVISION_PREFIX = "wiki/revisions";
const BLOB_INDEX_KEY = "wiki/index.json";

const EDIT_LIMIT_PER_MIN = 4;
const EDIT_LIMIT_PER_10MIN = 15;
const CREATE_LIMIT_PER_HOUR = 5;
const DEFAULT_LIST_LIMIT = 24;
const MAX_LIST_LIMIT = 100;

// Local in-memory fallback rate limiter when Redis is not configured
const localRateBuckets = new Map<string, { count: number; expiresAt: number }>();

let bootstrapPromise: Promise<void> | null = null;

export function _resetWikiBootstrapForTests(): void {
    bootstrapPromise = null;
}

export class WikiServiceError extends Error {
    status: number;
    payload?: unknown;

    constructor(message: string, status: number, payload?: unknown) {
        super(message);
        this.name = "WikiServiceError";
        this.status = status;
        this.payload = payload;
    }
}

export function hashEditorIp(rawIp: string): string {
    const salt = process.env.CRON_SECRET || process.env.ADMIN_KEY || "wbus-wiki-salt";
    return createHash("sha256").update(`${salt}:${rawIp}`).digest("hex").slice(0, 12);
}

export function resolveEditorInfo(rawNickname: string | undefined, rawIp: string): WikiEditorInfo {
    const editorId = hashEditorIp(rawIp || "anonymous");
    const trimmed = (rawNickname || "").trim().slice(0, 24);
    return {
        nickname: trimmed || `버스러#${editorId.slice(0, 4)}`,
        editorId,
    };
}

export function isWikiAdminAuthorized(authHeader: string | null): boolean {
    const secret = process.env.ADMIN_KEY?.trim() || process.env.CRON_SECRET?.trim();
    if (!secret) {
        return process.env.NODE_ENV === "development";
    }
    return authHeader === `Bearer ${secret}`;
}

async function checkRateBucket(
    bucketKey: string,
    limit: number,
    windowSeconds: number
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const redisCount = await distributedCache.incrWithWindow(bucketKey, windowSeconds);
    if (redisCount !== null) {
        return {
            allowed: redisCount <= limit,
            retryAfterSeconds: redisCount <= limit ? 0 : windowSeconds,
        };
    }

    const now = Date.now();
    const existing = localRateBuckets.get(bucketKey);
    if (!existing || existing.expiresAt <= now) {
        localRateBuckets.set(bucketKey, {
            count: 1,
            expiresAt: now + windowSeconds * 1000,
        });
        return {allowed: true, retryAfterSeconds: 0};
    }

    existing.count += 1;
    if (existing.count > limit) {
        return {
            allowed: false,
            retryAfterSeconds: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
        };
    }
    return {allowed: true, retryAfterSeconds: 0};
}

export async function enforceWikiRateLimit(
    editorId: string,
    action: "edit" | "create" | "revert"
): Promise<void> {
    if (action === "create") {
        const res = await checkRateBucket(
            `${REDIS_RATE_PREFIX}create:${editorId}`,
            CREATE_LIMIT_PER_HOUR,
            3600
        );
        if (!res.allowed) {
            throw new WikiServiceError(
                "문서 생성 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
                429,
                {retryAfter: res.retryAfterSeconds}
            );
        }
        return;
    }

    const [minRes, tenMinRes] = await Promise.all([
        checkRateBucket(`${REDIS_RATE_PREFIX}${action}:1m:${editorId}`, EDIT_LIMIT_PER_MIN, 60),
        checkRateBucket(`${REDIS_RATE_PREFIX}${action}:10m:${editorId}`, EDIT_LIMIT_PER_10MIN, 600),
    ]);

    if (!minRes.allowed || !tenMinRes.allowed) {
        const retryAfter = Math.max(minRes.retryAfterSeconds, tenMinRes.retryAfterSeconds, 30);
        throw new WikiServiceError(
            "짧은 시간에 편집이 너무 많이 요청되었습니다. 잠시 후 다시 시도해 주세요.",
            429,
            {retryAfter}
        );
    }
}

function escapeLikePattern(raw: string): string {
    return raw.replace(/[\\%_]/g, "\\$&");
}

function rowToDocument(row: WikiPageRow): WikiPageDocument {
    const hasCoords = typeof row.lat === "number" && typeof row.lng === "number";
    return {
        slug: row.slug,
        title: row.slug,
        subtitle: row.subtitle,
        pinColor: row.pinColor ?? DEFAULT_WIKI_PIN_COLOR,
        ...(hasCoords ? {lat: row.lat as number, lng: row.lng as number} : {}),
        tags: row.tags ?? [],
        version: row.version,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
        lastEditor: {
            nickname: row.lastEditorNickname,
            editorId: row.lastEditorId,
        },
        isProtected: row.isProtected,
        markdownBody: row.markdownBody,
    };
}

function rowToSummary(row: WikiPageRow): WikiPageSummary {
    const hasCoords = typeof row.lat === "number" && typeof row.lng === "number";
    const structuredCounts = extractWikiStructuredCounts(row.markdownBody);
    return {
        slug: row.slug,
        title: row.slug,
        subtitle: row.subtitle,
        pinColor: row.pinColor ?? DEFAULT_WIKI_PIN_COLOR,
        ...(hasCoords ? {lat: row.lat as number, lng: row.lng as number} : {}),
        tags: row.tags ?? [],
        version: row.version,
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
        lastEditor: {
            nickname: row.lastEditorNickname,
            editorId: row.lastEditorId,
        },
        isProtected: row.isProtected,
        ...structuredCounts,
        pinned: row.pinned,
    };
}

function rowToRevisionMeta(row: WikiRevisionRow): WikiRevisionMeta {
    return {
        slug: row.slug,
        version: row.version,
        baseVersion: row.baseVersion,
        summary: row.summary,
        editor: {
            nickname: row.editorNickname,
            editorId: row.editorId,
        },
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
        diffStats: row.diffStats,
    };
}

function requireDb(): WikiDatabase {
    if (!isDatabaseConfigured()) {
        throw new WikiServiceError(
            "데이터베이스(DATABASE_URL)가 설정되지 않았습니다.",
            503
        );
    }
    return getDb();
}

function isPgUniqueViolation(err: unknown): boolean {
    return Boolean(
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: unknown }).code === "23505"
    );
}

async function readBlobRevisionsForSlug(slug: string): Promise<WikiRevision[]> {
    const revIndexRes = await artifactStore
        .getJson<WikiRevisionMeta[]>(`${BLOB_REVISION_PREFIX}/${slug}/index.json`, {
            bypassTmp: true,
        })
        .catch(() => null);

    if (!revIndexRes?.data?.length) return [];

    const revs = await Promise.all(
        revIndexRes.data.map((meta) =>
            artifactStore
                .getJson<WikiRevision>(`${BLOB_REVISION_PREFIX}/${slug}/v${meta.version}.json`, {
                    bypassTmp: true,
                })
                .then((res) => res?.data ?? null)
                .catch(() => null)
        )
    );

    return revs
        .filter((r): r is WikiRevision => r !== null)
        .sort((a, b) => a.version - b.version);
}

/**
 * Idempotently imports a page (from legacy Vercel Blob) into Postgres.
 */
async function importDocumentIntoDb(
    db: WikiDatabase,
    doc: WikiPageDocument,
    revisions: WikiRevision[]
): Promise<WikiPageDocument | null> {
    await db.transaction(async (tx) => {
        await tx
            .insert(wikiPages)
            .values({
                slug: doc.slug,
                subtitle: doc.subtitle,
                pinColor: doc.pinColor ?? DEFAULT_WIKI_PIN_COLOR,
                lat: doc.lat ?? null,
                lng: doc.lng ?? null,
                tags: doc.tags,
                tagsText: doc.tags.join(" "),
                version: doc.version,
                isProtected: Boolean(doc.isProtected),
                pinned: false,
                lastEditorNickname: doc.lastEditor.nickname,
                lastEditorId: doc.lastEditor.editorId,
                markdownBody: doc.markdownBody,
                createdAt: new Date(doc.createdAt),
                updatedAt: new Date(doc.updatedAt),
            })
            .onConflictDoNothing({target: wikiPages.slug});

        const revList: WikiRevision[] =
            revisions.length > 0
                ? revisions
                : [
                    {
                        slug: doc.slug,
                        version: doc.version,
                        baseVersion: Math.max(0, doc.version - 1),
                        summary: "초기 위키 문서 생성",
                        editor: doc.lastEditor,
                        createdAt: doc.updatedAt,
                        diffStats: computeWikiDiffStats(null, doc),
                        snapshot: doc,
                    },
                ];

        let previousDoc: WikiPageDocument | null = null;
        for (const rev of revList) {
            const isCp = shouldStoreCheckpoint(rev.version);
            const delta = !isCp && previousDoc ? computeWikiDelta(previousDoc, rev.snapshot) : null;

            await tx
                .insert(wikiRevisions)
                .values({
                    slug: rev.slug,
                    version: rev.version,
                    baseVersion: rev.baseVersion,
                    summary: rev.summary,
                    editorNickname: rev.editor.nickname,
                    editorId: rev.editor.editorId,
                    diffStats: rev.diffStats,
                    isCheckpoint: isCp || !previousDoc,
                    snapshot: isCp || !previousDoc ? rev.snapshot : null,
                    delta,
                    createdAt: new Date(rev.createdAt),
                })
                .onConflictDoNothing();

            previousDoc = rev.snapshot;
        }
    });

    const rows = await db
        .select()
        .from(wikiPages)
        .where(eq(wikiPages.slug, doc.slug))
        .limit(1);

    return rows[0] ? rowToDocument(rows[0]) : null;
}

function resolveCanonicalSlug(rawSlug: string): string {
    return rawSlug.trim();
}

type LegacyBlobDocument = WikiPageDocument & {
    linkedRoutes?: WikiLinkedRoute[];
    shuttle?: WikiShuttleBlock | null;
    boardingStops?: WikiBoardingStop[];
};

function normalizeBlobDocument(raw: LegacyBlobDocument): WikiPageDocument {
    return {
        ...raw,
        markdownBody: mergeStructuredBlocksIntoMarkdown(raw.markdownBody, {
            linkedRoutes: raw.linkedRoutes,
            shuttle: raw.shuttle,
            boardingStops: raw.boardingStops,
        }),
    };
}

async function migrateSingleSlugFromBlob(
    db: WikiDatabase,
    slug: string
): Promise<WikiPageDocument | null> {
    const blobPageRes = await artifactStore
        .getJson<LegacyBlobDocument>(`${BLOB_PAGE_PREFIX}/${slug}.json`, {bypassTmp: true})
        .catch(() => null);

    if (blobPageRes?.data) {
        const normalized = normalizeBlobDocument(blobPageRes.data);
        const parsed = WikiPageDocumentSchema.safeParse(normalized);
        if (parsed.success) {
            const blobRevs = (await readBlobRevisionsForSlug(slug)).map((rev) => ({
                ...rev,
                snapshot: normalizeBlobDocument(rev.snapshot as LegacyBlobDocument),
            }));
            return importDocumentIntoDb(db, parsed.data, blobRevs);
        }
    }

    return null;
}

async function ensureLegacyMigrated(db: WikiDatabase): Promise<void> {
    if (bootstrapPromise) {
        return bootstrapPromise;
    }

    bootstrapPromise = (async () => {
        const existingRows = await db
            .select({
                slug: wikiPages.slug,
            })
            .from(wikiPages);
        if (existingRows.length > 0) {
            return;
        }

        const blobIndex = await artifactStore
            .getJson<WikiIndexData>(BLOB_INDEX_KEY, {bypassTmp: true})
            .catch(() => null);
        const blobSlugs = (blobIndex?.data?.pages ?? []).map((p) => p.slug);
        for (const candidateSlug of blobSlugs) {
            await migrateSingleSlugFromBlob(db, candidateSlug);
        }
    })().catch((err) => {
        bootstrapPromise = null;
        throw err;
    });

    return bootstrapPromise;
}

type DbExecutor = Pick<WikiDatabase, "select">;

async function reconstructRevision(
    executor: DbExecutor,
    slug: string,
    targetVersion: number,
    isProtected?: boolean
): Promise<WikiRevision | null> {
    const targetRows = await executor
        .select()
        .from(wikiRevisions)
        .where(and(eq(wikiRevisions.slug, slug), eq(wikiRevisions.version, targetVersion)))
        .limit(1);

    const targetRow = targetRows[0];
    if (!targetRow) return null;

    if (targetRow.isCheckpoint && targetRow.snapshot) {
        return {
            ...rowToRevisionMeta(targetRow),
            snapshot: {
                ...targetRow.snapshot,
                ...(isProtected !== undefined ? {isProtected} : {}),
            },
        };
    }

    // Locate the nearest prior checkpoint <= targetVersion
    const checkpointRows = await executor
        .select({version: wikiRevisions.version})
        .from(wikiRevisions)
        .where(
            and(
                eq(wikiRevisions.slug, slug),
                lte(wikiRevisions.version, targetVersion),
                eq(wikiRevisions.isCheckpoint, true)
            )
        )
        .orderBy(desc(wikiRevisions.version))
        .limit(1);

    const startVersion = checkpointRows[0]?.version ?? 1;

    const chainRows = await executor
        .select()
        .from(wikiRevisions)
        .where(
            and(
                eq(wikiRevisions.slug, slug),
                gte(wikiRevisions.version, startVersion),
                lte(wikiRevisions.version, targetVersion)
            )
        )
        .orderBy(asc(wikiRevisions.version));

    if (chainRows.length === 0) return null;

    let currentDoc: WikiPageDocument | null = null;
    for (const row of chainRows) {
        if (row.snapshot) {
            currentDoc = row.snapshot;
        } else if (currentDoc && row.delta) {
            currentDoc = applyWikiDelta(currentDoc, row.delta, {
                version: row.version,
                editor: {
                    nickname: row.editorNickname,
                    editorId: row.editorId,
                },
                createdAt:
                    row.createdAt instanceof Date
                        ? row.createdAt.toISOString()
                        : String(row.createdAt),
                isProtected,
            });
        } else {
            return null;
        }
    }

    if (!currentDoc) return null;

    return {
        ...rowToRevisionMeta(targetRow),
        snapshot: {
            ...currentDoc,
            slug,
            title: currentDoc.title || slug,
            ...(isProtected !== undefined ? {isProtected} : {}),
        },
    };
}

export async function getWikiPage(slug: string): Promise<WikiPageDocument | null> {
    const normalized = resolveCanonicalSlug(slug);
    if (!isValidWikiSlug(normalized)) return null;

    const cached = await distributedCache.get<WikiPageDocument>(
        `${REDIS_PAGE_PREFIX}${normalized}`,
        450
    );
    if (cached) {
        const parsed = WikiPageDocumentSchema.safeParse(cached);
        if (parsed.success) return parsed.data;
    }

    if (!isDatabaseConfigured()) {
        return null;
    }

    const db = getDb();
    await ensureLegacyMigrated(db);

    const rows = await db
        .select()
        .from(wikiPages)
        .where(eq(wikiPages.slug, normalized))
        .limit(1);

    let doc: WikiPageDocument | null = rows[0] ? rowToDocument(rows[0]) : null;
    if (!doc) {
        doc = await migrateSingleSlugFromBlob(db, normalized);
    }

    if (doc) {
        void distributedCache
            .set(`${REDIS_PAGE_PREFIX}${normalized}`, doc, REDIS_CACHE_TTL_SECONDS)
            .catch(() => false);
    }

    return doc;
}

export async function listWikiPages(filters?: {
    pinsOnly?: boolean;
    query?: string;
    limit?: number;
    offset?: number;
}): Promise<WikiIndexData> {
    if (!isDatabaseConfigured()) {
        return {
            updatedAt: new Date().toISOString(),
            pages: [],
            recentChanges: [],
            totalCount: 0,
            hasMore: false,
        };
    }

    const db = getDb();
    await ensureLegacyMigrated(db);

    const conditions = [];
    if (filters?.pinsOnly) {
        conditions.push(isNotNull(wikiPages.lat), isNotNull(wikiPages.lng));
    }

    const q = filters?.query?.trim();
    if (q) {
        const pattern = `%${escapeLikePattern(q)}%`;
        conditions.push(
            or(
                ilike(wikiPages.slug, pattern),
                ilike(wikiPages.subtitle, pattern),
                ilike(wikiPages.tagsText, pattern),
                ilike(wikiPages.markdownBody, pattern)
            )
        );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = Math.max(0, filters?.offset ?? 0);
    const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, filters?.limit ?? DEFAULT_LIST_LIMIT));

    const [pageRows, totalRows, recentRows] = await Promise.all([
        db
            .select()
            .from(wikiPages)
            .where(whereClause)
            .orderBy(desc(wikiPages.pinned), desc(wikiPages.updatedAt))
            .limit(limit)
            .offset(offset),
        db
            .select({total: count()})
            .from(wikiPages)
            .where(whereClause),
        db
            .select({
                slug: wikiRevisions.slug,
                pinColor: wikiPages.pinColor,
                version: wikiRevisions.version,
                summary: wikiRevisions.summary,
                editorNickname: wikiRevisions.editorNickname,
                editorId: wikiRevisions.editorId,
                diffStats: wikiRevisions.diffStats,
                createdAt: wikiRevisions.createdAt,
            })
            .from(wikiRevisions)
            .innerJoin(wikiPages, eq(wikiRevisions.slug, wikiPages.slug))
            .orderBy(desc(wikiRevisions.createdAt))
            .limit(30),
    ]);

    const totalCount = Number(totalRows[0]?.total ?? 0);
    const pages = pageRows.map(rowToSummary);

    const recentChanges: WikiRecentChangeItem[] = recentRows.map((r) => ({
        slug: r.slug,
        title: r.slug,
        pinColor: r.pinColor ?? DEFAULT_WIKI_PIN_COLOR,
        version: r.version,
        summary: r.summary,
        editor: {
            nickname: r.editorNickname,
            editorId: r.editorId,
        },
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        diffStats: r.diffStats,
    }));

    return {
        updatedAt: pageRows[0]?.updatedAt
            ? pageRows[0].updatedAt instanceof Date
                ? pageRows[0].updatedAt.toISOString()
                : String(pageRows[0].updatedAt)
            : new Date().toISOString(),
        pages,
        recentChanges,
        totalCount,
        hasMore: offset + pages.length < totalCount,
    };
}

export async function createWikiPage(input: {
    slug: string;
    title: string;
    subtitle: string;
    pinColor?: WikiPinColor;
    lat?: number;
    lng?: number;
    tags: string[];
    markdownBody: string;
    summary: string;
    editor: WikiEditorInfo;
}): Promise<WikiPageDocument> {
    const canonicalTitle = normalizeWikiSlug(input.title);
    const slug = canonicalTitle || normalizeWikiSlug(input.slug);
    if (!isValidWikiSlug(slug)) {
        throw new WikiServiceError("유효하지 않은 문서 슬러그입니다.", 400);
    }
    const title = slug;

    const db = requireDb();
    const now = new Date();
    const nowIso = now.toISOString();
    const dedupedTags = Array.from(new Set(input.tags));
    const hasCoords = typeof input.lat === "number" && typeof input.lng === "number";
    const pinColor = input.pinColor ?? DEFAULT_WIKI_PIN_COLOR;

    const doc: WikiPageDocument = {
        slug,
        title,
        subtitle: input.subtitle,
        pinColor,
        ...(hasCoords ? {lat: input.lat, lng: input.lng} : {}),
        tags: dedupedTags,
        version: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastEditor: input.editor,
        isProtected: false,
        markdownBody: input.markdownBody,
    };

    const diffStats = computeWikiDiffStats(null, doc);
    const summary = input.summary.trim() || "새 위키 문서 생성";

    try {
        await db.transaction(async (tx) => {
            const existing = await tx
                .select({slug: wikiPages.slug})
                .from(wikiPages)
                .where(eq(wikiPages.slug, slug))
                .limit(1);

            if (existing.length > 0) {
                throw new WikiServiceError("이미 존재하는 위키 문서 주소(슬러그)입니다.", 409);
            }

            await tx.insert(wikiPages).values({
                slug,
                subtitle: doc.subtitle,
                pinColor: doc.pinColor,
                lat: doc.lat ?? null,
                lng: doc.lng ?? null,
                tags: dedupedTags,
                tagsText: dedupedTags.join(" "),
                version: 1,
                isProtected: false,
                pinned: false,
                lastEditorNickname: input.editor.nickname,
                lastEditorId: input.editor.editorId,
                markdownBody: doc.markdownBody,
                createdAt: now,
                updatedAt: now,
            });

            await tx.insert(wikiRevisions).values({
                slug,
                version: 1,
                baseVersion: 0,
                summary,
                editorNickname: input.editor.nickname,
                editorId: input.editor.editorId,
                diffStats,
                isCheckpoint: true,
                snapshot: doc,
                delta: null,
                createdAt: now,
            });
        });
    } catch (err) {
        if (isPgUniqueViolation(err)) {
            throw new WikiServiceError("이미 존재하는 위키 문서 주소(슬러그)입니다.", 409);
        }
        throw err;
    }

    await distributedCache
        .set(`${REDIS_PAGE_PREFIX}${slug}`, doc, REDIS_CACHE_TTL_SECONDS)
        .catch(() => false);

    return doc;
}

export async function saveWikiPageEdit(input: {
    slug: string;
    baseVersion: number;
    title: string;
    subtitle: string;
    pinColor?: WikiPinColor;
    lat?: number;
    lng?: number;
    tags: string[];
    markdownBody: string;
    summary: string;
    editor: WikiEditorInfo;
    isAdmin?: boolean;
}): Promise<{ document: WikiPageDocument; revision: WikiRevision }> {
    const slug = resolveCanonicalSlug(input.slug);
    if (!isValidWikiSlug(slug)) {
        throw new WikiServiceError("유효하지 않은 문서 슬러그입니다.", 400);
    }

    const nextSlug = normalizeWikiSlug(input.title);
    if (!isValidWikiSlug(nextSlug)) {
        throw new WikiServiceError("제목은 2~80자의 유효한 위키 슬러그여야 합니다.", 400);
    }

    const db = requireDb();

    // Ensure seed or legacy Blob doc exists in DB before opening row lock TX
    await getWikiPage(slug);

    const result = await db.transaction(async (tx) => {
        const lockedRows = await tx
            .select()
            .from(wikiPages)
            .where(eq(wikiPages.slug, slug))
            .for("update");

        if (!lockedRows[0]) {
            throw new WikiServiceError("편집할 위키 문서를 찾을 수 없습니다.", 404);
        }

        const currentRow = lockedRows[0];
        const current = rowToDocument(currentRow);

        if (current.isProtected && !input.isAdmin) {
            throw new WikiServiceError(
                "이 문서는 현재 보호 잠금 상태입니다. 관리자만 편집할 수 있습니다.",
                403
            );
        }

        if (input.baseVersion !== current.version) {
            throw new WikiServiceError(
                `다른 사용자가 먼저 문서를 수정했습니다. (현재 v${current.version}, 편집 기준 v${input.baseVersion})`,
                409,
                {currentVersion: current.version, latestDocument: current}
            );
        }

        const slugChanged = nextSlug !== slug;
        if (slugChanged) {
            const existingTarget = await tx
                .select({slug: wikiPages.slug})
                .from(wikiPages)
                .where(eq(wikiPages.slug, nextSlug))
                .limit(1);
            if (existingTarget.length > 0) {
                throw new WikiServiceError("같은 제목(슬러그)의 위키 문서가 이미 존재합니다.", 409);
            }
        }

        const now = new Date();
        const nowIso = now.toISOString();
        const nextVersion = current.version + 1;
        const dedupedTags = Array.from(new Set(input.tags));

        const hasCoords = typeof input.lat === "number" && typeof input.lng === "number";
        const nextDoc: WikiPageDocument = {
            ...current,
            slug: nextSlug,
            title: nextSlug,
            subtitle: input.subtitle,
            pinColor: input.pinColor ?? current.pinColor ?? DEFAULT_WIKI_PIN_COLOR,
            ...(hasCoords ? {lat: input.lat, lng: input.lng} : {lat: undefined, lng: undefined}),
            tags: dedupedTags,
            version: nextVersion,
            updatedAt: nowIso,
            lastEditor: input.editor,
            markdownBody: input.markdownBody,
        };

        if (!hasWikiContentChanged(current, nextDoc)) {
            throw new WikiServiceError("변경된 내용이 없습니다.", 400);
        }

        const diffStats = computeWikiDiffStats(current, nextDoc);
        const summary =
            input.summary.trim() ||
            diffStats.structuredChanges.join(", ") ||
            "문서 내용 수정";

        let savedRow: WikiPageRow;
        if (slugChanged) {
            const insertedRows = await tx
                .insert(wikiPages)
                .values({
                    slug: nextSlug,
                    subtitle: nextDoc.subtitle,
                    pinColor: nextDoc.pinColor,
                    lat: nextDoc.lat ?? null,
                    lng: nextDoc.lng ?? null,
                    tags: dedupedTags,
                    tagsText: dedupedTags.join(" "),
                    version: nextVersion,
                    isProtected: Boolean(currentRow.isProtected),
                    pinned: Boolean(currentRow.pinned),
                    lastEditorNickname: input.editor.nickname,
                    lastEditorId: input.editor.editorId,
                    markdownBody: nextDoc.markdownBody,
                    createdAt: currentRow.createdAt,
                    updatedAt: now,
                })
                .returning();

            if (!insertedRows[0]) {
                throw new WikiServiceError("문서 주소 변경 중 오류가 발생했습니다.", 500);
            }

            await tx
                .update(wikiRevisions)
                .set({slug: nextSlug})
                .where(eq(wikiRevisions.slug, slug));

            await tx.delete(wikiPages).where(eq(wikiPages.slug, slug));
            savedRow = insertedRows[0];
        } else {
            const updatedRows = await tx
                .update(wikiPages)
                .set({
                    subtitle: nextDoc.subtitle,
                    pinColor: nextDoc.pinColor,
                    lat: nextDoc.lat ?? null,
                    lng: nextDoc.lng ?? null,
                    tags: dedupedTags,
                    tagsText: dedupedTags.join(" "),
                    version: nextVersion,
                    lastEditorNickname: input.editor.nickname,
                    lastEditorId: input.editor.editorId,
                    markdownBody: nextDoc.markdownBody,
                    updatedAt: now,
                })
                .where(and(eq(wikiPages.slug, slug), eq(wikiPages.version, current.version)))
                .returning();

            if (!updatedRows[0]) {
                throw new WikiServiceError("동시 편집 충돌이 발생했습니다. 다시 시도해 주세요.", 409);
            }
            savedRow = updatedRows[0];
        }

        const isCheckpoint = shouldStoreCheckpoint(nextVersion);
        const delta = isCheckpoint ? null : computeWikiDelta(current, nextDoc);

        await tx.insert(wikiRevisions).values({
            slug: nextSlug,
            version: nextVersion,
            baseVersion: current.version,
            summary,
            editorNickname: input.editor.nickname,
            editorId: input.editor.editorId,
            diffStats,
            isCheckpoint,
            snapshot: isCheckpoint ? nextDoc : null,
            delta,
            createdAt: now,
        });

        const revision: WikiRevision = {
            slug: nextSlug,
            version: nextVersion,
            baseVersion: current.version,
            summary,
            editor: input.editor,
            createdAt: nowIso,
            diffStats,
            snapshot: nextDoc,
        };

        return {document: rowToDocument(savedRow), revision};
    });

    if (result.document.slug !== slug) {
        await distributedCache.del(`${REDIS_PAGE_PREFIX}${slug}`).catch(() => false);
    }
    await distributedCache
        .set(`${REDIS_PAGE_PREFIX}${result.document.slug}`, result.document, REDIS_CACHE_TTL_SECONDS)
        .catch(() => false);

    return result;
}

export async function getWikiRevisionList(slug: string): Promise<WikiRevisionMeta[]> {
    const normalized = resolveCanonicalSlug(slug);
    if (!isValidWikiSlug(normalized)) return [];

    const page = await getWikiPage(normalized);
    if (!page) return [];

    if (!isDatabaseConfigured()) {
        return [
            {
                slug: page.slug,
                version: page.version,
                baseVersion: 0,
                summary: "초기 위키 문서 생성",
                editor: page.lastEditor,
                createdAt: page.updatedAt,
                diffStats: computeWikiDiffStats(null, page),
            },
        ];
    }

    const db = getDb();
    const rows = await db
        .select()
        .from(wikiRevisions)
        .where(eq(wikiRevisions.slug, page.slug))
        .orderBy(desc(wikiRevisions.version));

    return rows.map(rowToRevisionMeta);
}

export async function getWikiRevision(slug: string, version: number): Promise<WikiRevision | null> {
    const normalized = resolveCanonicalSlug(slug);
    if (!isValidWikiSlug(normalized) || version < 1) return null;

    if (!isDatabaseConfigured()) {
        return null;
    }

    const db = getDb();
    // Ensure legacy Blob/slug is migrated if this is the very first request
    const page = await getWikiPage(normalized);
    const targetSlug = page?.slug ?? normalized;
    return reconstructRevision(db, targetSlug, version, page?.isProtected);
}

export async function revertWikiPage(input: {
    slug: string;
    targetVersion: number;
    baseVersion: number;
    editor: WikiEditorInfo;
    summary?: string;
    isAdmin?: boolean;
}): Promise<{ document: WikiPageDocument; revision: WikiRevision }> {
    const slug = resolveCanonicalSlug(input.slug);
    if (!isValidWikiSlug(slug)) {
        throw new WikiServiceError("유효하지 않은 문서 슬러그입니다.", 400);
    }

    const db = requireDb();
    await getWikiPage(slug);

    const result = await db.transaction(async (tx) => {
        const lockedRows = await tx
            .select()
            .from(wikiPages)
            .where(eq(wikiPages.slug, slug))
            .for("update");

        if (!lockedRows[0]) {
            throw new WikiServiceError("문서를 찾을 수 없습니다.", 404);
        }

        const current = rowToDocument(lockedRows[0]);

        if (current.isProtected && !input.isAdmin) {
            throw new WikiServiceError("보호 잠금된 문서는 관리자만 되돌릴 수 있습니다.", 403);
        }

        if (input.baseVersion !== current.version) {
            throw new WikiServiceError(
                `다른 사용자가 먼저 문서를 수정했습니다. (현재 v${current.version})`,
                409,
                {currentVersion: current.version, latestDocument: current}
            );
        }

        const targetRevision = await reconstructRevision(
            tx,
            slug,
            input.targetVersion,
            current.isProtected
        );
        if (!targetRevision) {
            throw new WikiServiceError(`v${input.targetVersion} 리비전을 찾을 수 없습니다.`, 404);
        }

        const now = new Date();
        const nowIso = now.toISOString();
        const nextVersion = current.version + 1;
        const restored = targetRevision.snapshot;

        const nextDoc: WikiPageDocument = {
            ...restored,
            slug: current.slug,
            title: current.title,
            createdAt: current.createdAt,
            isProtected: current.isProtected,
            version: nextVersion,
            updatedAt: nowIso,
            lastEditor: input.editor,
        };

        if (!hasWikiContentChanged(current, nextDoc)) {
            throw new WikiServiceError("현재 버전과 동일한 내용입니다.", 400);
        }

        const diffStats = computeWikiDiffStats(current, nextDoc);
        const summary =
            input.summary?.trim() || `v${input.targetVersion} 버전으로 되돌리기`;

        const updatedRows = await tx
            .update(wikiPages)
            .set({
                subtitle: nextDoc.subtitle,
                pinColor: nextDoc.pinColor ?? DEFAULT_WIKI_PIN_COLOR,
                lat: nextDoc.lat ?? null,
                lng: nextDoc.lng ?? null,
                tags: nextDoc.tags,
                tagsText: nextDoc.tags.join(" "),
                version: nextVersion,
                lastEditorNickname: input.editor.nickname,
                lastEditorId: input.editor.editorId,
                markdownBody: nextDoc.markdownBody,
                updatedAt: now,
            })
            .where(and(eq(wikiPages.slug, slug), eq(wikiPages.version, current.version)))
            .returning();

        if (!updatedRows[0]) {
            throw new WikiServiceError("동시 편집 충돌이 발생했습니다. 다시 시도해 주세요.", 409);
        }

        // Always persist full checkpoint on revert for fast recovery chains
        await tx.insert(wikiRevisions).values({
            slug,
            version: nextVersion,
            baseVersion: current.version,
            summary,
            editorNickname: input.editor.nickname,
            editorId: input.editor.editorId,
            diffStats,
            isCheckpoint: true,
            snapshot: nextDoc,
            delta: null,
            createdAt: now,
        });

        const revision: WikiRevision = {
            slug,
            version: nextVersion,
            baseVersion: current.version,
            summary,
            editor: input.editor,
            createdAt: nowIso,
            diffStats,
            snapshot: nextDoc,
        };

        return {document: rowToDocument(updatedRows[0]), revision};
    });

    await distributedCache
        .set(`${REDIS_PAGE_PREFIX}${slug}`, result.document, REDIS_CACHE_TTL_SECONDS)
        .catch(() => false);

    return result;
}

export async function setWikiPageProtection(
    slug: string,
    isProtected: boolean
): Promise<WikiPageDocument> {
    const normalized = resolveCanonicalSlug(slug);
    const db = requireDb();
    await getWikiPage(normalized);

    const updatedRows = await db
        .update(wikiPages)
        .set({isProtected})
        .where(eq(wikiPages.slug, normalized))
        .returning();

    if (!updatedRows[0]) {
        throw new WikiServiceError("문서를 찾을 수 없습니다.", 404);
    }

    const updated = rowToDocument(updatedRows[0]);
    await distributedCache
        .set(`${REDIS_PAGE_PREFIX}${normalized}`, updated, REDIS_CACHE_TTL_SECONDS)
        .catch(() => false);

    return updated;
}

export async function updateWikiPinMeta(input: {
    slug: string;
    baseVersion: number;
    lat?: number;
    lng?: number;
    pinColor?: WikiPinColor;
    editor: WikiEditorInfo;
    summary?: string;
    isAdmin?: boolean;
}): Promise<{ document: WikiPageDocument; revision: WikiRevision }> {
    const slug = resolveCanonicalSlug(input.slug);
    if (!isValidWikiSlug(slug)) {
        throw new WikiServiceError("유효하지 않은 문서 슬러그입니다.", 400);
    }

    const db = requireDb();
    await getWikiPage(slug);

    const result = await db.transaction(async (tx) => {
        const lockedRows = await tx
            .select()
            .from(wikiPages)
            .where(eq(wikiPages.slug, slug))
            .for("update");

        if (!lockedRows[0]) {
            throw new WikiServiceError("핀 문서를 찾을 수 없습니다.", 404);
        }

        const current = rowToDocument(lockedRows[0]);
        if (current.isProtected && !input.isAdmin) {
            throw new WikiServiceError(
                "이 문서는 현재 보호 잠금 상태입니다. 관리자만 수정할 수 있습니다.",
                403
            );
        }

        if (input.baseVersion !== current.version) {
            throw new WikiServiceError(
                `다른 사용자가 먼저 문서를 수정했습니다. (현재 v${current.version}, 편집 기준 v${input.baseVersion})`,
                409,
                {currentVersion: current.version, latestDocument: current}
            );
        }

        const hasCoords = typeof input.lat === "number" && typeof input.lng === "number";
        const now = new Date();
        const nowIso = now.toISOString();
        const nextVersion = current.version + 1;

        const nextDoc: WikiPageDocument = {
            ...current,
            pinColor: input.pinColor ?? current.pinColor ?? DEFAULT_WIKI_PIN_COLOR,
            ...(hasCoords ? {lat: input.lat, lng: input.lng} : {}),
            version: nextVersion,
            updatedAt: nowIso,
            lastEditor: input.editor,
        };

        if (!hasWikiContentChanged(current, nextDoc)) {
            throw new WikiServiceError("변경된 내용이 없습니다.", 400);
        }

        const diffStats = computeWikiDiffStats(current, nextDoc);
        const summary =
            input.summary?.trim() ||
            diffStats.structuredChanges.join(", ") ||
            "지도 핀 정보 수정";

        const updatedRows = await tx
            .update(wikiPages)
            .set({
                pinColor: nextDoc.pinColor,
                lat: nextDoc.lat ?? null,
                lng: nextDoc.lng ?? null,
                version: nextVersion,
                lastEditorNickname: input.editor.nickname,
                lastEditorId: input.editor.editorId,
                updatedAt: now,
            })
            .where(and(eq(wikiPages.slug, slug), eq(wikiPages.version, current.version)))
            .returning();

        if (!updatedRows[0]) {
            throw new WikiServiceError("동시 편집 충돌이 발생했습니다. 다시 시도해 주세요.", 409);
        }

        const isCheckpoint = shouldStoreCheckpoint(nextVersion);
        const delta = isCheckpoint ? null : computeWikiDelta(current, nextDoc);

        await tx.insert(wikiRevisions).values({
            slug,
            version: nextVersion,
            baseVersion: current.version,
            summary,
            editorNickname: input.editor.nickname,
            editorId: input.editor.editorId,
            diffStats,
            isCheckpoint,
            snapshot: isCheckpoint ? nextDoc : null,
            delta,
            createdAt: now,
        });

        const revision: WikiRevision = {
            slug,
            version: nextVersion,
            baseVersion: current.version,
            summary,
            editor: input.editor,
            createdAt: nowIso,
            diffStats,
            snapshot: nextDoc,
        };

        return {document: rowToDocument(updatedRows[0]), revision};
    });

    await distributedCache
        .set(`${REDIS_PAGE_PREFIX}${slug}`, result.document, REDIS_CACHE_TTL_SECONDS)
        .catch(() => false);

    return result;
}

export async function deleteWikiPage(slug: string): Promise<void> {
    const normalized = resolveCanonicalSlug(slug);
    const db = requireDb();

    const existing = await db
        .select({pinned: wikiPages.pinned})
        .from(wikiPages)
        .where(eq(wikiPages.slug, normalized))
        .limit(1);

    if (existing[0]?.pinned) {
        throw new WikiServiceError("핵심 고정 문서는 삭제할 수 없습니다.", 400);
    }

    await db.delete(wikiPages).where(eq(wikiPages.slug, normalized));
    await distributedCache.del(`${REDIS_PAGE_PREFIX}${normalized}`).catch(() => false);
}
