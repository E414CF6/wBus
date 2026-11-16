import {z} from "zod";
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
    nickname: z.string().trim().max(24).default("익명 버스러"),
    editorId: z.string().trim().min(1).max(64),
});

const OptionalLatSchema = z
    .number()
    .finite()
    .min(32, "위도는 32~39.5 범위여야 합니다")
    .max(39.5, "위도는 32~39.5 범위여야 합니다")
    .nullable()
    .optional()
    .transform((v) => (v === null ? undefined : v));

const OptionalLngSchema = z
    .number()
    .finite()
    .min(124, "경도는 124~132.5 범위여야 합니다")
    .max(132.5, "경도는 124~132.5 범위여야 합니다")
    .nullable()
    .optional()
    .transform((v) => (v === null ? undefined : v));

const hasPairedCoordinates = (d: { lat?: number; lng?: number }) =>
    (d.lat === undefined) === (d.lng === undefined);

export const WikiPageDocumentSchema = z
    .object({
        slug: z.string().trim().refine(isValidWikiSlug, "유효하지 않은 위키 슬러그입니다"),
        title: z.string().trim().min(2, "제목은 2자 이상이어야 합니다").max(80),
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
    .refine(hasPairedCoordinates, "지도 핀 좌표는 위도와 경도를 함께 지정해야 합니다");

export const WikiEditPayloadSchema = z
    .object({
        baseVersion: z.number().int().min(1),
        title: z
            .string()
            .trim()
            .min(2, "제목은 2자 이상이어야 합니다")
            .max(80)
            .refine(
                (t) => isValidWikiSlug(normalizeWikiSlug(t)),
                "제목에 사용할 수 없는 예약어이거나 슬러그(2~80자)로 변환할 수 없습니다",
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
    .refine(hasPairedCoordinates, "지도 핀 좌표는 위도와 경도를 함께 지정해야 합니다");

export const WikiCreatePayloadSchema = z
    .object({
        slug: z.string().optional(),
        title: z
            .string()
            .trim()
            .min(2, "제목은 2자 이상이어야 합니다")
            .max(80)
            .refine(
                (t) => isValidWikiSlug(normalizeWikiSlug(t)),
                "제목은 2~80자여야 하며 예약어(new, edit, api 등)나 URL 특수문자를 제외해 주세요",
            ),
        subtitle: z.string().trim().max(160).default(""),
        pinColor: WikiPinColorSchema.default(DEFAULT_WIKI_PIN_COLOR),
        lat: OptionalLatSchema,
        lng: OptionalLngSchema,
        tags: z.array(z.string().trim().min(1).max(24)).max(12).default([]),
        markdownBody: z.string().max(100000).default(""),
        nickname: z.string().trim().max(24).optional().default(""),
        summary: z.string().trim().max(160).optional().default("새 위키 문서 생성"),
        website: z.string().optional(), // Honeypot field
    })
    .refine(hasPairedCoordinates, "지도 핀 좌표는 위도와 경도를 함께 지정해야 합니다")
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
    .refine(hasPairedCoordinates, "지도 핀 좌표는 위도와 경도를 함께 지정해야 합니다")
    .refine(
        (d) => (d.lat !== undefined && d.lng !== undefined) || d.pinColor !== undefined,
        "변경할 핀 위치 또는 핀 색상을 지정해 주세요.",
    );

export const WikiRevertPayloadSchema = z.object({
    targetVersion: z.number().int().min(1),
    baseVersion: z.number().int().min(1),
    nickname: z.string().trim().max(24).optional().default(""),
    summary: z.string().trim().max(160).optional().default(""),
});
