/**
 * Shape of cached data returned by the Redis-backed API routes.
 * Shared between server (Redis client) and client (SWR hooks).
 */
export interface CachedData<T> {
    data: T;
    timestamp: number;
}
