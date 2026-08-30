export const DEFAULT_CACHE_TTL_SECONDS = 10;
export const DEFAULT_STALE_WHILE_REVALIDATE_SECONDS = 60;
export const DEFAULT_STALE_IF_ERROR_SECONDS = 300;

export interface CacheControlOptions {
    ttlSeconds: number;
    staleWhileRevalidateSeconds?: number;
    staleIfErrorSeconds?: number;
    scope?: "public" | "private";
    maxAgeSeconds?: number;
    sMaxAgeSeconds?: number;
}

function normalizeSeconds(value: number | undefined, fallback: number, minimum = 0): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return fallback;
    }
    return Math.max(minimum, Math.round(value));
}

export function buildCacheControl(options: CacheControlOptions): string {
    const scope = options.scope ?? "public";
    const ttlSeconds = normalizeSeconds(options.ttlSeconds, DEFAULT_CACHE_TTL_SECONDS, 0);
    const maxAgeSeconds = normalizeSeconds(options.maxAgeSeconds, ttlSeconds, 0);
    const sMaxAgeSeconds = normalizeSeconds(options.sMaxAgeSeconds, ttlSeconds, 0);
    const staleWhileRevalidateSeconds = normalizeSeconds(options.staleWhileRevalidateSeconds, DEFAULT_STALE_WHILE_REVALIDATE_SECONDS, 0);
    const staleIfErrorSeconds = normalizeSeconds(options.staleIfErrorSeconds, DEFAULT_STALE_IF_ERROR_SECONDS, 0);

    const parts = [scope, `max-age=${maxAgeSeconds}`, `s-maxage=${sMaxAgeSeconds}`,];

    if (staleWhileRevalidateSeconds > 0) {
        parts.push(`stale-while-revalidate=${staleWhileRevalidateSeconds}`);
    }
    if (staleIfErrorSeconds > 0) {
        parts.push(`stale-if-error=${staleIfErrorSeconds}`);
    }

    return parts.join(", ");
}
