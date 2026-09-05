/**
 * Shape of cached data returned by API routes.
 * Shared between server (in-memory cache client) and client (SWR hooks).
 */
export type CacheStatus = "hit" | "stale" | "miss" | "fallback";

export interface CacheMeta {
    status: CacheStatus;
    layer: "memory" | "origin";
    ageMs: number;
    degraded?: boolean;
}

export interface CachedData<T> {
    data: T;
    timestamp: number;
    meta?: CacheMeta;
}
