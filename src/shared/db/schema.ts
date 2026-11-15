import {bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex,} from "drizzle-orm/pg-core";
import type {
    WikiBoardingStop,
    WikiCategory,
    WikiDiffStats,
    WikiLinkedRoute,
    WikiPageDocument,
    WikiRevisionDelta,
    WikiShuttleBlock,
} from "../../entities/wiki/types";

export const wikiPages = pgTable(
    "wiki_pages",
    {
        slug: text("slug").primaryKey(),
        title: text("title").notNull(),
        subtitle: text("subtitle").notNull().default(""),
        category: text("category").$type<WikiCategory>().notNull(),
        cityCode: text("city_code"),
        tags: jsonb("tags").$type<string[]>().notNull().default([]),
        tagsText: text("tags_text").notNull().default(""),
        version: integer("version").notNull().default(1),
        isProtected: boolean("is_protected").notNull().default(false),
        pinned: boolean("pinned").notNull().default(false),
        lastEditorNickname: text("last_editor_nickname").notNull(),
        lastEditorId: text("last_editor_id").notNull(),
        linkedRoutes: jsonb("linked_routes").$type<WikiLinkedRoute[]>().notNull().default([]),
        shuttle: jsonb("shuttle").$type<WikiShuttleBlock | null>(),
        boardingStops: jsonb("boarding_stops").$type<WikiBoardingStop[]>().notNull().default([]),
        markdownBody: text("markdown_body").notNull().default(""),
        createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
    },
    (table) => [
        index("wiki_pages_pinned_updated_idx").on(table.pinned, table.updatedAt),
        index("wiki_pages_category_idx").on(table.category),
        index("wiki_pages_title_trgm_idx").using("gin", table.title.op("gin_trgm_ops")),
        index("wiki_pages_tags_text_trgm_idx").using("gin", table.tagsText.op("gin_trgm_ops")),
        index("wiki_pages_markdown_trgm_idx").using("gin", table.markdownBody.op("gin_trgm_ops")),
    ]
);

export const wikiRevisions = pgTable(
    "wiki_revisions",
    {
        id: bigint("id", {mode: "number"}).generatedAlwaysAsIdentity().primaryKey(),
        slug: text("slug")
            .notNull()
            .references(() => wikiPages.slug, {onDelete: "cascade"}),
        version: integer("version").notNull(),
        baseVersion: integer("base_version").notNull(),
        summary: text("summary").notNull().default(""),
        editorNickname: text("editor_nickname").notNull(),
        editorId: text("editor_id").notNull(),
        diffStats: jsonb("diff_stats").$type<WikiDiffStats>().notNull(),
        isCheckpoint: boolean("is_checkpoint").notNull().default(false),
        snapshot: jsonb("snapshot").$type<WikiPageDocument | null>(),
        delta: jsonb("delta").$type<WikiRevisionDelta | null>(),
        createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("wiki_revisions_slug_version_uidx").on(table.slug, table.version),
        index("wiki_revisions_slug_version_desc_idx").on(table.slug, table.version),
        index("wiki_revisions_created_at_idx").on(table.createdAt),
    ]
);

export type WikiPageRow = typeof wikiPages.$inferSelect;
export type WikiPageInsert = typeof wikiPages.$inferInsert;
export type WikiRevisionRow = typeof wikiRevisions.$inferSelect;
export type WikiRevisionInsert = typeof wikiRevisions.$inferInsert;
