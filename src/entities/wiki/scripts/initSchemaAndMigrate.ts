import {config} from "dotenv";
import {Pool} from "@neondatabase/serverless";
import {drizzle} from "drizzle-orm/neon-serverless";
import {eq} from "drizzle-orm";
import * as schema from "../../../shared/db/schema";
import {wikiPages, wikiRevisions} from "../../../shared/db/schema";
import {computeWikiDelta, shouldStoreCheckpoint} from "../lib/wikiDelta";
import {computeWikiDiffStats} from "../lib/wikiDiff";
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
        console.log("[Wiki Migration] Ensuring pg_trgm extension and GIN trigram indexes...");
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

        const seeds = getSeedWikiPages();
        for (const seed of seeds) {
            const existing = await db
                .select({slug: wikiPages.slug})
                .from(wikiPages)
                .where(eq(wikiPages.slug, seed.slug))
                .limit(1);

            if (existing.length > 0) {
                console.log(`[Wiki Migration] '${seed.slug}' already present in Postgres, skipping.`);
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
