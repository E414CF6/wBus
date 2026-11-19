import {NextResponse} from "next/server";
import {isValidWikiSlug, type WikiEditorInfo} from "@entities/wiki";
import {enforceWikiRateLimit, isWikiAdminAuthorized, resolveEditorInfo, WikiServiceError} from "@entities/wiki/server";
import {UI_TEXT} from "@shared/config/locale";

export const WIKI_NO_STORE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0, s-maxage=0",
} as const;

export function extractClientIp(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        const first = forwarded.split(",")[0]?.trim();
        if (first) return first;
    }
    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;
    return "127.0.0.1";
}

export function decodeWikiSlug(rawSlug: string): string {
    try {
        return decodeURIComponent(rawSlug).trim();
    } catch {
        return rawSlug.trim();
    }
}

export function handleWikiApiError(err: unknown, fallbackMessage: string): NextResponse {
    if (err instanceof WikiServiceError) {
        const headers: Record<string, string> = {...WIKI_NO_STORE_HEADERS};
        if (err.status === 429 && err.payload && typeof err.payload === "object" && "retryAfter" in err.payload) {
            headers["Retry-After"] = String((err.payload as { retryAfter: number }).retryAfter);
        }
        return NextResponse.json(
            {
                error: err.message,
                ...(err.payload && typeof err.payload === "object" ? err.payload : {}),
            },
            {status: err.status, headers}
        );
    }

    console.error("[Wiki API Error]", err);
    return NextResponse.json(
        {error: fallbackMessage},
        {status: 500, headers: WIKI_NO_STORE_HEADERS}
    );
}

export function resolveValidWikiSlugOrError(rawSlug: string): { slug: string } | { response: NextResponse } {
    const slug = decodeWikiSlug(rawSlug);
    if (!isValidWikiSlug(slug)) {
        return {
            response: NextResponse.json(
                {error: UI_TEXT.WIKI.API_ERRORS.INVALID_ADDRESS},
                {status: 400, headers: WIKI_NO_STORE_HEADERS}
            ),
        };
    }
    return {slug};
}

export async function authorizeWikiMutation(
    request: Request,
    input: { nickname?: string; website?: string },
    action: "edit" | "create" | "revert" | "discussion",
): Promise<{ editor: WikiEditorInfo; isAdmin: boolean } | { response: NextResponse }> {
    if (input.website && input.website.trim().length > 0) {
        return {
            response: NextResponse.json(
                {error: UI_TEXT.WIKI.API_ERRORS.BAD_REQUEST},
                {status: 400, headers: WIKI_NO_STORE_HEADERS}
            ),
        };
    }
    const isAdmin = isWikiAdminAuthorized(request.headers.get("authorization"));
    const editor = resolveEditorInfo(input.nickname, extractClientIp(request));
    if (!isAdmin) {
        await enforceWikiRateLimit(editor.editorId, action);
    }
    return {editor, isAdmin};
}
