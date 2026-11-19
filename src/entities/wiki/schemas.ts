import {z} from "zod";
import {UI_TEXT} from "@shared/config/locale";
import type {WikiPinColor} from "./types";

export const WIKI_PIN_COLORS: readonly WikiPinColor[] = [
    "navy",
    "blue",
    "emerald",
    "teal",
    "indigo",
    "violet",
    "amber",
    "rose",
] as const;

export const DEFAULT_WIKI_PIN_COLOR: WikiPinColor = "navy";

export const WikiPinColorSchema = z.enum(WIKI_PIN_COLORS);

export const RESERVED_WIKI_SLUGS = new Set([
    "new",
    "edit",
    "history",
    "api",
    "admin",
    "login",
    "settings",
    "search",
]);

export const WIKI_SLUG_MAX_LENGTH = 80;
export const WIKI_SLUG_DISALLOWED_CHARS_REGEX = /[\\/?#%<>"`]/;
export const TIME_HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function hasControlChar(str: string): boolean {
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code <= 0x1f || code === 0x7f) return true;
    }
    return false;
}

function stripControlChars(str: string): string {
    let out = "";
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code > 0x1f && code !== 0x7f) {
            out += str[i];
        }
    }
    return out;
}

export function normalizeWikiSlug(raw: string): string {
    return stripControlChars(raw)
        .replace(/[\\/?#%<>"`]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, WIKI_SLUG_MAX_LENGTH);
}

export function isValidWikiSlug(slug: string): boolean {
    if (!slug || typeof slug !== "string") return false;
    const trimmed = slug.trim();
    if (trimmed.length < 2 || trimmed.length > WIKI_SLUG_MAX_LENGTH) return false;
    if (trimmed === "." || trimmed === "..") return false;
    if (RESERVED_WIKI_SLUGS.has(trimmed.toLowerCase())) return false;
    if (hasControlChar(trimmed) || WIKI_SLUG_DISALLOWED_CHARS_REGEX.test(trimmed)) return false;
    return !/\s{2,}/.test(trimmed);
}

export const WikiEditorInfoSchema = z.object({
    nickname: z.string().trim().max(24).default(UI_TEXT.WIKI.VALIDATION.DEFAULT_NICKNAME),
    editorId: z.string().trim().min(1).max(64),
});

const OptionalLatSchema = z
    .number()
    .finite()
    .min(32, UI_TEXT.WIKI.VALIDATION.LAT_RANGE)
    .max(39.5, UI_TEXT.WIKI.VALIDATION.LAT_RANGE)
    .nullable()
    .optional()
    .transform((v) => (v === null ? undefined : v));

const OptionalLngSchema = z
    .number()
    .finite()
    .min(124, UI_TEXT.WIKI.VALIDATION.LNG_RANGE)
    .max(132.5, UI_TEXT.WIKI.VALIDATION.LNG_RANGE)
    .nullable()
    .optional()
    .transform((v) => (v === null ? undefined : v));

const hasPairedCoordinates = (d: { lat?: number; lng?: number }) =>
    (d.lat === undefined) === (d.lng === undefined);

export const WikiPageDocumentSchema = z
    .object({
        slug: z.string().trim().refine(isValidWikiSlug, UI_TEXT.WIKI.VALIDATION.INVALID_SLUG),
        title: z.string().trim().min(2, UI_TEXT.WIKI.VALIDATION.TITLE_MIN_LEN).max(80),
        subtitle: z.string().trim().max(160).default(""),
        pinColor: WikiPinColorSchema.default(DEFAULT_WIKI_PIN_COLOR),
        lat: OptionalLatSchema,
        lng: OptionalLngSchema,
        tags: z.array(z.string().trim().min(1).max(24)).max(12).default([]),
        version: z.number().int().min(1),
        createdAt: z.string().min(1),
        updatedAt: z.string().min(1),
        lastEditor: WikiEditorInfoSchema,
        isProtected: z.boolean().optional(),
        markdownBody: z.string().max(100000).default(""),
    })
    .refine(hasPairedCoordinates, UI_TEXT.WIKI.VALIDATION.PAIRED_COORDS);

export const WikiEditPayloadSchema = z
    .object({
        baseVersion: z.number().int().min(1),
        title: z
            .string()
            .trim()
            .min(2, UI_TEXT.WIKI.VALIDATION.TITLE_MIN_LEN)
            .max(80)
            .refine(
                (t) => isValidWikiSlug(normalizeWikiSlug(t)),
                UI_TEXT.WIKI.VALIDATION.TITLE_EDIT_INVALID,
            ),
        subtitle: z.string().trim().max(160).default(""),
        pinColor: WikiPinColorSchema.default(DEFAULT_WIKI_PIN_COLOR),
        lat: OptionalLatSchema,
        lng: OptionalLngSchema,
        tags: z.array(z.string().trim().min(1).max(24)).max(12).default([]),
        markdownBody: z.string().max(100000).default(""),
        nickname: z.string().trim().max(24).optional().default(""),
        summary: z.string().trim().max(160).optional().default(""),
        website: z.string().optional(), // Honeypot field (must remain empty)
    })
    .refine(hasPairedCoordinates, UI_TEXT.WIKI.VALIDATION.PAIRED_COORDS);

export const WikiCreatePayloadSchema = z
    .object({
        slug: z.string().optional(),
        title: z
            .string()
            .trim()
            .min(2, UI_TEXT.WIKI.VALIDATION.TITLE_MIN_LEN)
            .max(80)
            .refine(
                (t) => isValidWikiSlug(normalizeWikiSlug(t)),
                UI_TEXT.WIKI.VALIDATION.TITLE_CREATE_INVALID,
            ),
        subtitle: z.string().trim().max(160).default(""),
        pinColor: WikiPinColorSchema.default(DEFAULT_WIKI_PIN_COLOR),
        lat: OptionalLatSchema,
        lng: OptionalLngSchema,
        tags: z.array(z.string().trim().min(1).max(24)).max(12).default([]),
        markdownBody: z.string().max(100000).default(""),
        nickname: z.string().trim().max(24).optional().default(""),
        summary: z.string().trim().max(160).optional().default(UI_TEXT.WIKI.VALIDATION.DEFAULT_CREATE_SUMMARY),
        website: z.string().optional(), // Honeypot field
    })
    .refine(hasPairedCoordinates, UI_TEXT.WIKI.VALIDATION.PAIRED_COORDS)
    .transform((data) => {
        const derivedSlug = normalizeWikiSlug(data.title);
        const derivedTitle = derivedSlug || data.title;
        return {
            ...data,
            title: derivedTitle,
            slug: derivedSlug,
        };
    });

export const WikiPinPatchPayloadSchema = z
    .object({
        baseVersion: z.number().int().min(1),
        lat: OptionalLatSchema,
        lng: OptionalLngSchema,
        pinColor: WikiPinColorSchema.optional(),
        nickname: z.string().trim().max(24).optional().default(""),
        summary: z.string().trim().max(160).optional().default(""),
    })
    .refine(hasPairedCoordinates, UI_TEXT.WIKI.VALIDATION.PAIRED_COORDS)
    .refine(
        (d) => (d.lat !== undefined && d.lng !== undefined) || d.pinColor !== undefined,
        UI_TEXT.WIKI.VALIDATION.PIN_PATCH_REQUIRED,
    );

export const WikiRevertPayloadSchema = z.object({
    targetVersion: z.number().int().min(1),
    baseVersion: z.number().int().min(1),
    nickname: z.string().trim().max(24).optional().default(""),
    summary: z.string().trim().max(160).optional().default(""),
});

export const WikiDiscussionStatusSchema = z.enum(["open", "resolved"]);

export const WikiDiscussionCreateSchema = z.object({
    title: z
        .string()
        .trim()
        .min(2, UI_TEXT.WIKI.VALIDATION.DISCUSSION_TITLE_MIN)
        .max(120, UI_TEXT.WIKI.VALIDATION.DISCUSSION_TITLE_MAX),
    body: z
        .string()
        .trim()
        .min(2, UI_TEXT.WIKI.VALIDATION.DISCUSSION_BODY_MIN)
        .max(4000, UI_TEXT.WIKI.VALIDATION.DISCUSSION_BODY_MAX),
    nickname: z.string().trim().max(24).optional().default(""),
    website: z.string().optional(),
});

export const WikiDiscussionCommentCreateSchema = z.object({
    body: z
        .string()
        .trim()
        .min(1, UI_TEXT.WIKI.VALIDATION.DISCUSSION_COMMENT_REQUIRED)
        .max(4000, UI_TEXT.WIKI.VALIDATION.DISCUSSION_COMMENT_MAX),
    nickname: z.string().trim().max(24).optional().default(""),
    website: z.string().optional(),
});

export const WikiDiscussionStatusPatchSchema = z.object({
    status: WikiDiscussionStatusSchema,
    nickname: z.string().trim().max(24).optional().default(""),
});
