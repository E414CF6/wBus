/**
 * Shape of cached data returned by the Redis-backed API routes.
 * Shared between server (Redis client) and client (SWR hooks).
 */
export type CacheStatus = "hit" | "stale" | "miss" | "fallback";

export interface CacheMeta {
    status: CacheStatus;
    layer: "memory" | "redis" | "origin";
    ageMs: number;
    degraded?: boolean;
}

export interface CachedData<T> {
    data: T;
    timestamp: number;
    meta?: CacheMeta;
}
