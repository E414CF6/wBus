import {config} from "dotenv";
import {Pool} from "@neondatabase/serverless";
import {drizzle} from "drizzle-orm/neon-serverless";
import {eq} from "drizzle-orm";
import * as schema from "../../../shared/db/schema";
import {wikiPages, wikiRevisions} from "@shared/db";
import {LEGACY_WIKI_SLUG_ALIASES, YONSEI_MIRAE_WIKI_SLUG} from "../schemas";

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
        console.log("[Wiki Migration] Normalizing wiki_pages schema (dropping duplicate title column, ensuring lat/lng & indexes)...");
        await pool.query(`ALTER TABLE wiki_pages
            ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;`);
        await pool.query(`ALTER TABLE wiki_pages
            ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;`);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS wiki_pages_lat_lng_idx
                ON wiki_pages (lat, lng);
        `);
        await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
        await pool.query(`DROP INDEX IF EXISTS wiki_pages_title_trgm_idx;`);
        await pool.query(`DROP INDEX IF EXISTS wiki_revisions_slug_version_desc_idx;`);
        await pool.query(`ALTER TABLE wiki_pages DROP COLUMN IF EXISTS title;`);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS wiki_pages_slug_trgm_idx
                ON wiki_pages USING gin (slug gin_trgm_ops);
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
                            subtitle: oldRow.subtitle,
                            category: oldRow.category,
                            cityCode: oldRow.cityCode,
                            lat: oldRow.lat ?? null,
                            lng: oldRow.lng ?? null,
                            tags: oldRow.tags,
                            tagsText: oldRow.tagsText,
                            version: oldRow.version,
                            isProtected: oldRow.isProtected,
                            pinned: canonicalSlug === YONSEI_MIRAE_WIKI_SLUG || oldRow.pinned,
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

        console.log("[Wiki Migration] Completed successfully.");
    } finally {
        await pool.end();
    }
}

void main().catch((err) => {
    console.error("[Wiki Migration] Failed:", err);
    process.exit(1);
});
