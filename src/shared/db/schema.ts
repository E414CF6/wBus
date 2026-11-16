import {
    bigint,
    boolean,
    doublePrecision,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
} from "drizzle-orm/pg-core";
import type {WikiDiffStats, WikiPageDocument, WikiPinColor, WikiRevisionDelta,} from "../../entities/wiki/types";

export const wikiPages = pgTable(
    "wiki_pages",
    {
        slug: text("slug").primaryKey(),
        subtitle: text("subtitle").notNull().default(""),
        pinColor: text("pin_color").$type<WikiPinColor>().notNull().default("navy"),
        lat: doublePrecision("lat"),
        lng: doublePrecision("lng"),
        tags: jsonb("tags").$type<string[]>().notNull().default([]),
        tagsText: text("tags_text").notNull().default(""),
        version: integer("version").notNull().default(1),
        isProtected: boolean("is_protected").notNull().default(false),
        pinned: boolean("pinned").notNull().default(false),
        lastEditorNickname: text("last_editor_nickname").notNull(),
        lastEditorId: text("last_editor_id").notNull(),
        markdownBody: text("markdown_body").notNull().default(""),
        createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow(),
    },
    (table) => [
        index("wiki_pages_pinned_updated_idx").on(table.pinned, table.updatedAt),
        index("wiki_pages_lat_lng_idx").on(table.lat, table.lng),
        index("wiki_pages_slug_trgm_idx").using("gin", table.slug.op("gin_trgm_ops")),
        index("wiki_pages_tags_text_trgm_idx").using("gin", table.tagsText.op("gin_trgm_ops")),
        index("wiki_pages_markdown_trgm_idx").using("gin", table.markdownBody.op("gin_trgm_ops")),
    ],
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
        index("wiki_revisions_created_at_idx").on(table.createdAt),
    ],
);

export type WikiPageRow = typeof wikiPages.$inferSelect;
export type WikiPageInsert = typeof wikiPages.$inferInsert;
export type WikiRevisionRow = typeof wikiRevisions.$inferSelect;
export type WikiRevisionInsert = typeof wikiRevisions.$inferInsert;
