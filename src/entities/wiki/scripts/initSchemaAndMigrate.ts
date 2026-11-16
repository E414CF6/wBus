import {config} from "dotenv";
import {Pool} from "@neondatabase/serverless";

config({path: ".env.local"});
config();

async function main() {
    const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
    if (!url) {
        throw new Error("DATABASE_URL or DATABASE_URL_UNPOOLED is required.");
    }

    const pool = new Pool({connectionString: url});

    try {
        console.log("[Wiki Migration] Updating wiki_pages schema (adding pin_color, dropping category, ensuring lat/lng & indexes)...");
        await pool.query(`ALTER TABLE wiki_pages
            ADD COLUMN IF NOT EXISTS pin_color TEXT NOT NULL DEFAULT 'navy';`);
        await pool.query(`DROP INDEX IF EXISTS wiki_pages_category_idx;`);
        await pool.query(`ALTER TABLE wiki_pages DROP COLUMN IF EXISTS category;`);
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

        // Remove deprecated category keys from stored revision snapshots & deltas
        await pool.query(`
            UPDATE wiki_revisions
            SET
                snapshot = CASE
                    WHEN snapshot IS NOT NULL THEN (snapshot - 'category') || jsonb_build_object('pinColor', COALESCE(snapshot->>'pinColor', 'navy'))
                    ELSE NULL
                END,
                delta = CASE
                    WHEN delta IS NOT NULL AND delta ? 'fieldsPatch' THEN jsonb_set(delta, '{fieldsPatch}', (delta->'fieldsPatch') - 'category')
                    ELSE delta
                END
            WHERE (snapshot IS NOT NULL AND (snapshot ? 'category' OR NOT (snapshot ? 'pinColor')))
               OR (delta IS NOT NULL AND delta ? 'fieldsPatch' AND (delta->'fieldsPatch') ? 'category');
        `);

        console.log("[Wiki Migration] Completed successfully.");
    } finally {
        await pool.end();
    }
}

void main().catch((err) => {
    console.error("[Wiki Migration] Failed:", err);
    process.exit(1);
});
