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

export const WIKI_SLUG_REGEX = /^[a-z0-9\uAC00-\uD7A3-]+$/;
export const TIME_HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidWikiSlug(slug: string): boolean {
    if (!slug || typeof slug !== "string") return false;
    const trimmed = slug.trim().toLowerCase();
    if (trimmed.length < 2 || trimmed.length > 64) return false;
    if (RESERVED_WIKI_SLUGS.has(trimmed)) return false;
    if (trimmed.startsWith("-") || trimmed.endsWith("-")) return false;
    return WIKI_SLUG_REGEX.test(trimmed);
}

export function normalizeWikiSlug(raw: string): string {
    return raw
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\uAC00-\uD7A3-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64);
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

export const WikiPageDocumentSchema = z.object({
    slug: z.string().trim().refine(isValidWikiSlug, "유효하지 않은 위키 슬러그입니다"),
    title: z.string().trim().min(2, "제목은 2자 이상이어야 합니다").max(80),
    subtitle: z.string().trim().max(160).default(""),
    category: z.enum(["campus", "route", "stop", "terminal", "guide"]),
    cityCode: z.string().trim().regex(/^\d{2,10}$/).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
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
});

export const WikiEditPayloadSchema = z.object({
    baseVersion: z.number().int().min(1),
    title: z.string().trim().min(2, "제목은 2자 이상이어야 합니다").max(80),
    subtitle: z.string().trim().max(160).default(""),
    category: z.enum(["campus", "route", "stop", "terminal", "guide"]),
    cityCode: z.string().trim().regex(/^\d{2,10}$/).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    tags: z.array(z.string().trim().min(1).max(24)).max(12).default([]),
    linkedRoutes: z.array(WikiLinkedRouteSchema).max(20).default([]),
    shuttle: WikiShuttleBlockSchema.nullable().default(null),
    boardingStops: z.array(WikiBoardingStopSchema).max(50).default([]),
    markdownBody: z.string().max(50000).default(""),
    nickname: z.string().trim().max(24).optional().default(""),
    summary: z.string().trim().max(160).optional().default(""),
    website: z.string().optional(), // Honeypot field (must remain empty)
});

export const WikiCreatePayloadSchema = z.object({
    slug: z.string().trim().transform((s) => normalizeWikiSlug(s)).refine(isValidWikiSlug, "슬러그는 2~64자의 한글, 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다"),
    title: z.string().trim().min(2, "제목은 2자 이상이어야 합니다").max(80),
    subtitle: z.string().trim().max(160).default(""),
    category: z.enum(["campus", "route", "stop", "terminal", "guide"]),
    cityCode: z.string().trim().regex(/^\d{2,10}$/).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
    tags: z.array(z.string().trim().min(1).max(24)).max(12).default([]),
    linkedRoutes: z.array(WikiLinkedRouteSchema).max(20).default([]),
    shuttle: WikiShuttleBlockSchema.nullable().default(null),
    boardingStops: z.array(WikiBoardingStopSchema).max(50).default([]),
    markdownBody: z.string().max(50000).default(""),
    nickname: z.string().trim().max(24).optional().default(""),
    summary: z.string().trim().max(160).optional().default("새 위키 문서 생성"),
    website: z.string().optional(), // Honeypot field
});

export const WikiRevertPayloadSchema = z.object({
    targetVersion: z.number().int().min(1),
    baseVersion: z.number().int().min(1),
    nickname: z.string().trim().max(24).optional().default(""),
    summary: z.string().trim().max(160).optional().default(""),
});
