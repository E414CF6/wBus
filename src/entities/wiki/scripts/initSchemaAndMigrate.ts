import {config} from "dotenv";
import {Pool} from "@neondatabase/serverless";
import {drizzle} from "drizzle-orm/neon-serverless";
import {eq} from "drizzle-orm";
import * as schema from "../../../shared/db/schema";
import {wikiPages, wikiRevisions} from "../../../shared/db/schema";
import {computeWikiDelta, shouldStoreCheckpoint} from "../lib/wikiDelta";
import {computeWikiDiffStats} from "../lib/wikiDiff";
import {LEGACY_WIKI_SLUG_ALIASES} from "../schemas";
import {getSeedWikiPages, PINNED_WIKI_SLUGS} from "../seeds";
import type {WikiPageDocument, WikiRevision} from "../types";

config({path: ".env.local"});
config();

async function main() {
    const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
    if (!url) {
        throw new Error("DATABASE_URL or DATABASE_URL_UNPOOLED is required.");
    }

    const pool = new Pool({connectionString: url});
    const db = drizzle(pool, {schema});

    try {
        console.log("[Wiki Migration] Ensuring lat/lng columns, pg_trgm extension and indexes...");
        await pool.query(`ALTER TABLE wiki_pages ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;`);
        await pool.query(`ALTER TABLE wiki_pages ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;`);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS wiki_pages_lat_lng_idx
                ON wiki_pages (lat, lng);
        `);
        await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS wiki_pages_title_trgm_idx
                ON wiki_pages USING gin (title gin_trgm_ops);
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS wiki_pages_tags_text_trgm_idx
                ON wiki_pages USING gin (tags_text gin_trgm_ops);
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS wiki_pages_markdown_trgm_idx
                ON wiki_pages USING gin (markdown_body gin_trgm_ops);
        `);

        for (const [legacySlug, canonicalSlug] of Object.entries(LEGACY_WIKI_SLUG_ALIASES)) {
            const legacyRows = await db
                .select()
                .from(wikiPages)
                .where(eq(wikiPages.slug, legacySlug))
                .limit(1);
            const canonicalRows = await db
                .select({slug: wikiPages.slug})
                .from(wikiPages)
                .where(eq(wikiPages.slug, canonicalSlug))
                .limit(1);
            const oldRow = legacyRows[0];
            if (oldRow && canonicalRows.length === 0) {
                await db.transaction(async (tx) => {
                    await tx
                        .insert(wikiPages)
                        .values({
                            slug: canonicalSlug,
                            title: oldRow.title,
                            subtitle: oldRow.subtitle,
                            category: oldRow.category,
                            cityCode: oldRow.cityCode,
                            lat: oldRow.lat ?? getSeedWikiPages().find((s) => s.slug === canonicalSlug)?.lat ?? null,
                            lng: oldRow.lng ?? getSeedWikiPages().find((s) => s.slug === canonicalSlug)?.lng ?? null,
                            tags: oldRow.tags,
                            tagsText: oldRow.tagsText,
                            version: oldRow.version,
                            isProtected: oldRow.isProtected,
                            pinned: PINNED_WIKI_SLUGS.has(canonicalSlug) || oldRow.pinned,
                            lastEditorNickname: oldRow.lastEditorNickname,
                            lastEditorId: oldRow.lastEditorId,
                            linkedRoutes: oldRow.linkedRoutes,
                            shuttle: oldRow.shuttle,
                            boardingStops: oldRow.boardingStops,
                            markdownBody: oldRow.markdownBody,
                            createdAt: oldRow.createdAt,
                            updatedAt: oldRow.updatedAt,
                        })
                        .onConflictDoNothing({target: wikiPages.slug});

                    await tx
                        .update(wikiRevisions)
                        .set({slug: canonicalSlug})
                        .where(eq(wikiRevisions.slug, legacySlug));

                    await tx.delete(wikiPages).where(eq(wikiPages.slug, legacySlug));
                });
                console.log(`[Wiki Migration] Migrated legacy slug '${legacySlug}' -> '${canonicalSlug}'.`);
            }
        }

        const seeds = getSeedWikiPages();
        const seedSlugSet = new Set(seeds.map((s) => s.slug));

        const allExisting = await db
            .select({
                slug: wikiPages.slug,
                lastEditorId: wikiPages.lastEditorId,
            })
            .from(wikiPages);
        for (const row of allExisting) {
            if (row.lastEditorId === "seed-system" && !seedSlugSet.has(row.slug)) {
                await db.delete(wikiPages).where(eq(wikiPages.slug, row.slug));
                console.log(`[Wiki Migration] Removed obsolete seed '${row.slug}'.`);
            }
        }

        for (const seed of seeds) {
            const existing = await db
                .select({
                    slug: wikiPages.slug,
                    lat: wikiPages.lat,
                    lng: wikiPages.lng,
                    lastEditorId: wikiPages.lastEditorId,
                    lastEditorNickname: wikiPages.lastEditorNickname,
                })
                .from(wikiPages)
                .where(eq(wikiPages.slug, seed.slug))
                .limit(1);

            if (existing.length > 0) {
                const row = existing[0];
                const needsCoords =
                    (row.lat === null || row.lng === null) &&
                    typeof seed.lat === "number" &&
                    typeof seed.lng === "number";
                const needsAuthorSync =
                    row.lastEditorId === "seed-system" &&
                    row.lastEditorNickname !== seed.lastEditor.nickname;

                if (needsCoords || needsAuthorSync) {
                    await db
                        .update(wikiPages)
                        .set({
                            ...(needsCoords ? {lat: seed.lat, lng: seed.lng} : {}),
                            ...(needsAuthorSync ? {lastEditorNickname: seed.lastEditor.nickname} : {}),
                        })
                        .where(eq(wikiPages.slug, seed.slug));
                    console.log(`[Wiki Migration] Synced seed metadata for '${seed.slug}'.`);
                } else {
                    console.log(`[Wiki Migration] '${seed.slug}' already present in Postgres, skipping.`);
                }
                continue;
            }

            await db.transaction(async (tx) => {
                const revs: WikiRevision[] = [
                    {
                        slug: seed.slug,
                        version: seed.version,
                        baseVersion: 0,
                        summary: "초기 위키 문서 생성",
                        editor: seed.lastEditor,
                        createdAt: seed.createdAt,
                        diffStats: computeWikiDiffStats(null, seed),
                        snapshot: seed,
                    },
                ];

                await tx
                    .insert(wikiPages)
                    .values({
                        slug: seed.slug,
                        title: seed.title,
                        subtitle: seed.subtitle,
                        category: seed.category,
                        cityCode: seed.cityCode ?? null,
                        lat: seed.lat ?? null,
                        lng: seed.lng ?? null,
                        tags: seed.tags,
                        tagsText: seed.tags.join(" "),
                        version: seed.version,
                        isProtected: Boolean(seed.isProtected),
                        pinned: PINNED_WIKI_SLUGS.has(seed.slug),
                        lastEditorNickname: seed.lastEditor.nickname,
                        lastEditorId: seed.lastEditor.editorId,
                        linkedRoutes: seed.linkedRoutes,
                        shuttle: seed.shuttle,
                        boardingStops: seed.boardingStops,
                        markdownBody: seed.markdownBody,
                        createdAt: new Date(seed.createdAt),
                        updatedAt: new Date(seed.updatedAt),
                    })
                    .onConflictDoNothing({target: wikiPages.slug});

                let prevDoc: WikiPageDocument | null = null;
                for (const rev of revs) {
                    const isCp = shouldStoreCheckpoint(rev.version);
                    const delta = !isCp && prevDoc ? computeWikiDelta(prevDoc, rev.snapshot) : null;
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
                            isCheckpoint: isCp || !prevDoc,
                            snapshot: isCp || !prevDoc ? rev.snapshot : null,
                            delta,
                            createdAt: new Date(rev.createdAt),
                        })
                        .onConflictDoNothing();
                    prevDoc = rev.snapshot;
                }
            });

            console.log(`[Wiki Migration] Bootstrapped seed '${seed.slug}' into Postgres.`);
        }

        console.log("[Wiki Migration] Completed successfully.");
    } finally {
        await pool.end();
    }
}

void main().catch((err) => {
    console.error("[Wiki Migration] Failed:", err);
    process.exit(1);
});
