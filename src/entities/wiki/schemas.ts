import {z} from "zod";
import type {WikiCategory} from "./types";

export const WIKI_CATEGORIES: readonly WikiCategory[] = [
    "campus",
    "route",
    "stop",
    "terminal",
    "guide",
] as const;

export const WIKI_CATEGORY_LABELS: Record<WikiCategory, string> = {
    campus: "캠퍼스 허브",
    route: "노선 가이드",
    stop: "정류장 · 환승",
    terminal: "터미널 · 역",
    guide: "이용 팁 · 안내",
};

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

export const YONSEI_MIRAE_WIKI_SLUG = "연세대학교 미래캠퍼스";

export const LEGACY_WIKI_SLUG_ALIASES: Record<string, string> = {
    "yonsei-mirae": YONSEI_MIRAE_WIKI_SLUG,
};

export function resolveLegacyWikiSlug(rawSlug: string): string | null {
    if (!rawSlug || typeof rawSlug !== "string") return null;
    const key = rawSlug.trim().toLowerCase();
    return LEGACY_WIKI_SLUG_ALIASES[key] ?? null;
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

const ShuttleViaStopSchema = z.object({
    name: z.string().trim().min(1).max(60),
    time: z.union([z.string().trim().regex(TIME_HH_MM_REGEX, "HH:MM 형식이어야 합니다"), z.literal(""), z.null()]).optional().transform((v) => (v === "" ? null : v ?? null)),
    is_fixed_time: z.boolean().optional(),
});

const ShuttleInboundItemSchema = z.object({
    operation_type: z.string().trim().min(1).max(40),
    departure_point: z.string().trim().min(1).max(80),
    departure_time: z.string().trim().regex(TIME_HH_MM_REGEX, "출발 시각은 HH:MM 형식이어야 합니다"),
    via: z.array(ShuttleViaStopSchema).max(20).default([]),
    destination: z.string().trim().min(1).max(80),
    note: z.string().trim().max(200).nullable().optional().transform((v) => (v === "" ? null : v ?? null)),
});

const ShuttleOutboundItemSchema = z.object({
    operation_type: z.string().trim().min(1).max(40),
    departure_point: z.string().trim().min(1).max(80),
    departure_time: z.string().trim().regex(TIME_HH_MM_REGEX, "출발 시각은 HH:MM 형식이어야 합니다"),
    destination: z.string().trim().min(1).max(80),
    via: z.array(ShuttleViaStopSchema).max(20).default([]),
    note: z.string().trim().max(200).nullable().optional().transform((v) => (v === "" ? null : v ?? null)),
});

const ShuttleStopLocationSchema = z.object({
    name: z.string().trim().min(1).max(80),
    location_description: z.string().trim().max(240),
});

export const WikiShuttleBlockSchema = z.object({
    enabled: z.boolean(),
    title: z.string().trim().min(1).max(80),
    stop_locations: z.array(ShuttleStopLocationSchema).max(40).default([]),
    inbound_to_campus: z.array(ShuttleInboundItemSchema).max(120).default([]),
    outbound_from_campus: z.array(ShuttleOutboundItemSchema).max(120).default([]),
    guidelines: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
});

export const WikiLinkedRouteSchema = z.object({
    routeNo: z.string().trim().min(1).max(30),
    cityCode: z.string().trim().regex(/^\d{2,10}$/, "올바른 도시 코드여야 합니다"),
    label: z.string().trim().max(60).optional(),
    description: z.string().trim().max(200).optional(),
    destLabel: z.string().trim().max(60).optional(),
    originLabel: z.string().trim().max(60).optional(),
    viaStops: z.string().trim().max(600).optional(),
    note: z.string().trim().max(300).optional(),
});

export const WikiBoardingStopSchema = z.object({
    id: z.string().trim().min(1).max(60),
    number: z.number().int().min(0).max(999).optional(),
    name: z.string().trim().min(1).max(80),
    shortName: z.string().trim().max(40).optional(),
    lat: z.number().min(32).max(39.5),
    lng: z.number().min(124).max(132.5),
    locationDescription: z.string().trim().min(1).max(300),
    directionTag: z.enum(["시내방면", "학교방면", "공통"]),
    tips: z.string().trim().max(400).optional(),
});

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

export const WikiPageDocumentSchema = z.object({
    slug: z.string().trim().refine(isValidWikiSlug, "유효하지 않은 위키 슬러그입니다"),
    title: z.string().trim().min(2, "제목은 2자 이상이어야 합니다").max(80),
    subtitle: z.string().trim().max(160).default(""),
    category: z.enum(["campus", "route", "stop", "terminal", "guide"]),
    cityCode: z.string().trim().regex(/^\d{2,10}$/).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    lat: OptionalLatSchema,
    lng: OptionalLngSchema,
    tags: z.array(z.string().trim().min(1).max(24)).max(12).default([]),
    version: z.number().int().min(1),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    lastEditor: WikiEditorInfoSchema,
    isProtected: z.boolean().optional(),
    linkedRoutes: z.array(WikiLinkedRouteSchema).max(20).default([]),
    shuttle: WikiShuttleBlockSchema.nullable().default(null),
    boardingStops: z.array(WikiBoardingStopSchema).max(50).default([]),
    markdownBody: z.string().max(50000).default(""),
}).refine(hasPairedCoordinates, "지도 핀 좌표는 위도와 경도를 함께 지정해야 합니다");

export const WikiEditPayloadSchema = z.object({
    baseVersion: z.number().int().min(1),
    title: z
        .string()
        .trim()
        .min(2, "제목은 2자 이상이어야 합니다")
        .max(80)
        .refine(
            (t) => isValidWikiSlug(normalizeWikiSlug(t)),
            "제목에 사용할 수 없는 예약어이거나 슬러그(2~80자)로 변환할 수 없습니다"
        ),
    subtitle: z.string().trim().max(160).default(""),
    category: z.enum(["campus", "route", "stop", "terminal", "guide"]),
    cityCode: z.string().trim().regex(/^\d{2,10}$/).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    lat: OptionalLatSchema,
    lng: OptionalLngSchema,
    tags: z.array(z.string().trim().min(1).max(24)).max(12).default([]),
    linkedRoutes: z.array(WikiLinkedRouteSchema).max(20).default([]),
    shuttle: WikiShuttleBlockSchema.nullable().default(null),
    boardingStops: z.array(WikiBoardingStopSchema).max(50).default([]),
    markdownBody: z.string().max(50000).default(""),
    nickname: z.string().trim().max(24).optional().default(""),
    summary: z.string().trim().max(160).optional().default(""),
    website: z.string().optional(), // Honeypot field (must remain empty)
}).refine(hasPairedCoordinates, "지도 핀 좌표는 위도와 경도를 함께 지정해야 합니다");

export const WikiCreatePayloadSchema = z.object({
    slug: z.string().optional(),
    title: z
        .string()
        .trim()
        .min(2, "제목은 2자 이상이어야 합니다")
        .max(80)
        .refine(
            (t) => isValidWikiSlug(normalizeWikiSlug(t)),
            "제목은 2~80자여야 하며 예약어(new, edit, api 등)나 URL 특수문자를 제외해 주세요"
        ),
    subtitle: z.string().trim().max(160).default(""),
    category: z.enum(["campus", "route", "stop", "terminal", "guide"]),
    cityCode: z.string().trim().regex(/^\d{2,10}$/).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    lat: OptionalLatSchema,
    lng: OptionalLngSchema,
    tags: z.array(z.string().trim().min(1).max(24)).max(12).default([]),
    linkedRoutes: z.array(WikiLinkedRouteSchema).max(20).default([]),
    shuttle: WikiShuttleBlockSchema.nullable().default(null),
    boardingStops: z.array(WikiBoardingStopSchema).max(50).default([]),
    markdownBody: z.string().max(50000).default(""),
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

export const WikiRevertPayloadSchema = z.object({
    targetVersion: z.number().int().min(1),
    baseVersion: z.number().int().min(1),
    nickname: z.string().trim().max(24).optional().default(""),
    summary: z.string().trim().max(160).optional().default(""),
});
