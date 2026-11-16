import {config} from "dotenv";
import {Pool} from "@neondatabase/serverless";
import {mergeStructuredBlocksIntoMarkdown} from "../lib/wikiMarkdown";
import type {WikiBoardingStop, WikiLinkedRoute, WikiShuttleBlock} from "../types";

config({path: ".env.local"});
config();

interface LegacyPageRow {
    slug: string;
    markdown_body: string;
    linked_routes?: WikiLinkedRoute[] | null;
    shuttle?: WikiShuttleBlock | null;
    boarding_stops?: WikiBoardingStop[] | null;
}

interface RevisionCleanupRow {
    id: number;
    snapshot: Record<string, unknown> | null;
    delta: {
        fieldsPatch?: Record<string, unknown>;
        markdownPatch?: unknown;
    } | null;
}

async function main() {
    const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
    if (!url) {
        throw new Error("DATABASE_URL or DATABASE_URL_UNPOOLED is required.");
    }

    const pool = new Pool({connectionString: url});

    try {
        console.log("[Wiki Migration] Checking legacy structured columns on wiki_pages...");
        const colRes = await pool.query<{ column_name: string }>(
            `SELECT column_name
             FROM information_schema.columns
             WHERE table_name = 'wiki_pages'`,
        );
        const existingCols = new Set(colRes.rows.map((r) => r.column_name));

        // 1. Fold any remaining structured JSON columns (linked_routes, shuttle, boarding_stops) into markdown_body
        if (
            existingCols.has("linked_routes") ||
            existingCols.has("shuttle") ||
            existingCols.has("boarding_stops")
        ) {
            const selectParts = [
                "slug",
                "markdown_body",
                existingCols.has("linked_routes") ? "linked_routes" : "NULL AS linked_routes",
                existingCols.has("shuttle") ? "shuttle" : "NULL AS shuttle",
                existingCols.has("boarding_stops") ? "boarding_stops" : "NULL AS boarding_stops",
            ];
            const pagesRes = await pool.query<LegacyPageRow>(
                `SELECT ${selectParts.join(", ")}
                 FROM wiki_pages`,
            );

            for (const row of pagesRes.rows) {
                const merged = mergeStructuredBlocksIntoMarkdown(row.markdown_body || "", {
                    linkedRoutes: row.linked_routes,
                    shuttle: row.shuttle,
                    boardingStops: row.boarding_stops,
                });
                if (merged !== (row.markdown_body || "")) {
                    await pool.query(
                        `UPDATE wiki_pages
                         SET markdown_body = $1
                         WHERE slug = $2`,
                        [merged, row.slug],
                    );
                    console.log(`[Wiki Migration] Folded structured blocks into markdown_body for '${row.slug}'`);
                }
            }
        }

        // 2. Ensure target columns & drop legacy city_code / category / linked_routes / shuttle / boarding_stops
        console.log("[Wiki Migration] Dropping deprecated columns & indexes and verifying indexes...");
        await pool.query(`ALTER TABLE wiki_pages
            ADD COLUMN IF NOT EXISTS pin_color TEXT NOT NULL DEFAULT 'navy';`);
        await pool.query(`ALTER TABLE wiki_pages
            ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;`);
        await pool.query(`ALTER TABLE wiki_pages
            ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;`);

        await pool.query(`DROP INDEX IF EXISTS wiki_pages_category_idx;`);
        await pool.query(`DROP INDEX IF EXISTS wiki_pages_city_code_idx;`);
        await pool.query(`DROP INDEX IF EXISTS wiki_pages_title_trgm_idx;`);
        await pool.query(`DROP INDEX IF EXISTS wiki_revisions_slug_version_desc_idx;`);

        await pool.query(`ALTER TABLE wiki_pages DROP COLUMN IF EXISTS category;`);
        await pool.query(`ALTER TABLE wiki_pages DROP COLUMN IF EXISTS city_code;`);
        await pool.query(`ALTER TABLE wiki_pages DROP COLUMN IF EXISTS title;`);
        await pool.query(`ALTER TABLE wiki_pages DROP COLUMN IF EXISTS linked_routes;`);
        await pool.query(`ALTER TABLE wiki_pages DROP COLUMN IF EXISTS shuttle;`);
        await pool.query(`ALTER TABLE wiki_pages DROP COLUMN IF EXISTS boarding_stops;`);

        await pool.query(`CREATE INDEX IF NOT EXISTS wiki_pages_lat_lng_idx ON wiki_pages (lat, lng);`);
        await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
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

        // 3. Migrate stored revision snapshots & deltas to unified markdown format
        const revRes = await pool.query<RevisionCleanupRow>(
            `SELECT id, snapshot, delta FROM wiki_revisions`,
        );

        for (const rev of revRes.rows) {
            let changed = false;
            let nextSnapshot = rev.snapshot;
            let nextDelta = rev.delta;

            if (nextSnapshot && typeof nextSnapshot === "object") {
                const cloned = {...nextSnapshot};
                const legacyRoutes = cloned.linkedRoutes as WikiLinkedRoute[] | undefined;
                const legacyShuttle = cloned.shuttle as WikiShuttleBlock | null | undefined;
                const legacyStops = cloned.boardingStops as WikiBoardingStop[] | undefined;

                if (legacyRoutes?.length || legacyShuttle || legacyStops?.length) {
                    cloned.markdownBody = mergeStructuredBlocksIntoMarkdown(
                        String(cloned.markdownBody || ""),
                        {
                            linkedRoutes: legacyRoutes,
                            shuttle: legacyShuttle,
                            boardingStops: legacyStops,
                        },
                    );
                    changed = true;
                }

                for (const obsoleteKey of [
                    "category",
                    "cityCode",
                    "linkedRoutes",
                    "shuttle",
                    "boardingStops",
                ]) {
                    if (obsoleteKey in cloned) {
                        delete cloned[obsoleteKey];
                        changed = true;
                    }
                }
                if (!cloned.pinColor) {
                    cloned.pinColor = "navy";
                    changed = true;
                }
                nextSnapshot = cloned;
            }

            if (nextDelta?.fieldsPatch && typeof nextDelta.fieldsPatch === "object") {
                const fp = {...nextDelta.fieldsPatch};
                let fpChanged = false;
                for (const obsoleteKey of [
                    "category",
                    "cityCode",
                    "linkedRoutes",
                    "shuttle",
                    "boardingStops",
                ]) {
                    if (obsoleteKey in fp) {
                        delete fp[obsoleteKey];
                        fpChanged = true;
                    }
                }
                if (fpChanged) {
                    changed = true;
                    const updatedDelta = {...nextDelta};
                    if (Object.keys(fp).length > 0) {
                        updatedDelta.fieldsPatch = fp;
                    } else {
                        delete updatedDelta.fieldsPatch;
                    }
                    nextDelta = Object.keys(updatedDelta).length > 0 ? updatedDelta : null;
                }
            }

            if (changed) {
                await pool.query(
                    `UPDATE wiki_revisions SET snapshot = $1, delta = $2 WHERE id = $3`,
                    [
                        nextSnapshot ? JSON.stringify(nextSnapshot) : null,
                        nextDelta ? JSON.stringify(nextDelta) : null,
                        rev.id,
                    ],
                );
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
