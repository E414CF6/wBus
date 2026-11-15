import {NextResponse} from "next/server";
import {WikiServiceError} from "@entities/wiki/server";

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
        return decodeURIComponent(rawSlug).trim().toLowerCase();
    } catch {
        return rawSlug.trim().toLowerCase();
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
