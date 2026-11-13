export const APP_PAGE_QUERY_KEY = "page";

/**
 * Extensible registry of dedicated sub-pages rendered via `/?page=<id>`.
 * Add new campus/hub page IDs here to route them cleanly without creating
 * separate top-level App Router segments.
 */
export const SPECIAL_PAGE_IDS = {
    YONSEI_MIRAE: "yonsei_mirae",
} as const;

export type SpecialPageId = (typeof SPECIAL_PAGE_IDS)[keyof typeof SPECIAL_PAGE_IDS];

export interface SpecialPageMeta {
    id: SpecialPageId;
    title: string;
    description: string;
    cityCode?: string;
}

export const SPECIAL_PAGE_REGISTRY: Record<SpecialPageId, SpecialPageMeta> = {
    [SPECIAL_PAGE_IDS.YONSEI_MIRAE]: {
        id: SPECIAL_PAGE_IDS.YONSEI_MIRAE,
        title: "연세대학교 미래캠퍼스 버스·셔틀 시간표",
        description:
            "연세대학교 미래캠퍼스 무료 셔틀버스(여주역·만종역·원주역·터미널) 및 시내버스 30번·34번·34-1번 실시간 위치·운행 시간표",
        cityCode: "32020",
    },
};

export function isValidSpecialPageId(value: string | null | undefined): value is SpecialPageId {
    if (!value) return false;
    return Object.prototype.hasOwnProperty.call(SPECIAL_PAGE_REGISTRY, value);
}

/**
 * Resolves a query-based special page ID from raw URLSearchParams or query string.
 */
export function resolveSpecialPageFromSearch(
    search: URLSearchParams | string | null | undefined
): SpecialPageId | null {
    if (!search) return null;
    const params = typeof search === "string" ? new URLSearchParams(search) : search;
    const raw = params.get(APP_PAGE_QUERY_KEY);
    return isValidSpecialPageId(raw) ? raw : null;
}

/**
 * Builds an internal Next.js href for a special page (e.g. `/?page=yonsei_mirae`).
 */
export function buildPageHref(
    pageId: SpecialPageId,
    extraParams?: Record<string, string | undefined>
): string {
    const params = new URLSearchParams();
    params.set(APP_PAGE_QUERY_KEY, pageId);
    if (extraParams) {
        for (const [key, val] of Object.entries(extraParams)) {
            if (val !== undefined && val !== "") {
                params.set(key, val);
            }
        }
    }
    return `/?${params.toString()}`;
}
