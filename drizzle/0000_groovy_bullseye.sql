CREATE TABLE "wiki_discussion_comments"
(
    "id"              bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wiki_discussion_comments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
    "thread_id"       bigint                                 NOT NULL,
    "body"            text                                   NOT NULL,
    "author_nickname" text                                   NOT NULL,
    "author_id"       text                                   NOT NULL,
    "created_at"      timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_discussion_threads"
(
    "id"                   bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wiki_discussion_threads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
    "slug"                 text                                    NOT NULL,
    "title"                text                                    NOT NULL,
    "status"               text                     DEFAULT 'open' NOT NULL,
    "author_nickname"      text                                    NOT NULL,
    "author_id"            text                                    NOT NULL,
    "comment_count"        integer                  DEFAULT 1      NOT NULL,
    "last_comment_at"      timestamp with time zone DEFAULT now()  NOT NULL,
    "resolved_by_nickname" text,
    "resolved_by_id"       text,
    "resolved_at"          timestamp with time zone,
    "created_at"           timestamp with time zone DEFAULT now()  NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_pages"
(
    "slug"                 text PRIMARY KEY                             NOT NULL,
    "subtitle"             text                     DEFAULT ''          NOT NULL,
    "pin_color"            text                     DEFAULT 'navy'      NOT NULL,
    "lat"                  double precision,
    "lng"                  double precision,
    "tags"                 jsonb                    DEFAULT '[]'::jsonb NOT NULL,
    "tags_text"            text                     DEFAULT ''          NOT NULL,
    "version"              integer                  DEFAULT 1           NOT NULL,
    "is_protected"         boolean                  DEFAULT false       NOT NULL,
    "pinned"               boolean                  DEFAULT false       NOT NULL,
    "last_editor_nickname" text                                         NOT NULL,
    "last_editor_id"       text                                         NOT NULL,
    "markdown_body"        text                     DEFAULT ''          NOT NULL,
    "created_at"           timestamp with time zone DEFAULT now()       NOT NULL,
    "updated_at"           timestamp with time zone DEFAULT now()       NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_revisions"
(
    "id"              bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wiki_revisions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
    "slug"            text                                   NOT NULL,
    "version"         integer                                NOT NULL,
    "base_version"    integer                                NOT NULL,
    "summary"         text                     DEFAULT ''    NOT NULL,
    "editor_nickname" text                                   NOT NULL,
    "editor_id"       text                                   NOT NULL,
    "diff_stats"      jsonb                                  NOT NULL,
    "is_checkpoint"   boolean                  DEFAULT false NOT NULL,
    "snapshot"        jsonb,
    "delta"           jsonb,
    "created_at"      timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wiki_discussion_comments"
    ADD CONSTRAINT "wiki_discussion_comments_thread_id_wiki_discussion_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."wiki_discussion_threads" ("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_discussion_threads"
    ADD CONSTRAINT "wiki_discussion_threads_slug_wiki_pages_slug_fk" FOREIGN KEY ("slug") REFERENCES "public"."wiki_pages" ("slug") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "wiki_revisions"
    ADD CONSTRAINT "wiki_revisions_slug_wiki_pages_slug_fk" FOREIGN KEY ("slug") REFERENCES "public"."wiki_pages" ("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wiki_discussion_comments_thread_created_idx" ON "wiki_discussion_comments" USING btree ("thread_id", "created_at");--> statement-breakpoint
CREATE INDEX "wiki_discussion_threads_slug_status_idx" ON "wiki_discussion_threads" USING btree ("slug", "status", "last_comment_at");--> statement-breakpoint
CREATE INDEX "wiki_pages_pinned_updated_idx" ON "wiki_pages" USING btree ("pinned", "updated_at");--> statement-breakpoint
CREATE INDEX "wiki_pages_lat_lng_idx" ON "wiki_pages" USING btree ("lat", "lng");--> statement-breakpoint
CREATE INDEX "wiki_pages_slug_trgm_idx" ON "wiki_pages" USING gin ("slug" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "wiki_pages_tags_text_trgm_idx" ON "wiki_pages" USING gin ("tags_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "wiki_pages_markdown_trgm_idx" ON "wiki_pages" USING gin ("markdown_body" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_revisions_slug_version_uidx" ON "wiki_revisions" USING btree ("slug", "version");--> statement-breakpoint
CREATE INDEX "wiki_revisions_created_at_idx" ON "wiki_revisions" USING btree ("created_at");