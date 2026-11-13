import {CacheManager} from "@shared/cache/CacheManager";
import {
    DEFAULT_CACHE_TTL_SECONDS,
    DEFAULT_STALE_IF_ERROR_SECONDS,
    DEFAULT_STALE_WHILE_REVALIDATE_SECONDS,
} from "@shared/cache/cachePolicy";
import {distributedCache} from "@shared/cache/distributedCache";
import type {CachedData} from "./types";

/**
 * In-Memory + Optional L2 Redis Client for Transit Telemetry Caching
 *
 * Provides ultra-fast L1 in-memory caching with request deduplication (coalescing),
 * stale-while-revalidate background fetching, stale-if-error fallback, and optional
 * distributed Upstash Redis read/write-through for cross-container sharing.
 */

export interface CacheOptions<T = unknown> {
    ttlSeconds?: number;
    staleWhileRevalidateSeconds?: number;
    staleIfErrorSeconds?: number;
    forceRefresh?: boolean;
    shouldCache?: (data: T) => boolean;
    useDistributedCache?: boolean;
}

const MEMORY_CACHE_MAX_KEYS = 2000;
const REVALIDATE_COOLDOWN_MS = 1000;
const REVALIDATE_STATE_TTL_MS = 60 * 60 * 1000;

const pendingRequests = new Map<string, Promise<CachedData<unknown>>>();
const memoryCache = new CacheManager<CachedData<unknown>>(MEMORY_CACHE_MAX_KEYS);
const revalidateState = new CacheManager<{ nextAllowedAt: number; failureCount: number }>({
    maxSize: MEMORY_CACHE_MAX_KEYS,
    ttlMs: REVALIDATE_STATE_TTL_MS,
});

/**
 * Synchronously inspect L1 Memory Cache without triggering a fetch.
 */
export function peekCached<T>(key: string, maxAgeSeconds?: number): CachedData<T> | null {
    const memEntry = memoryCache.get(key) as CachedData<T> | null;
    if (!memEntry) return null;
    const ageMs = Date.now() - memEntry.timestamp;
    if (maxAgeSeconds !== undefined && ageMs > maxAgeSeconds * 1000) {
        return null;
    }
    return {
        ...memEntry,
        meta: {status: "hit", layer: "memory", ageMs},
    };
}

/**
 * Directly seed or update L1 Memory Cache (e.g. during batch sync or cross-populating related keys).
 */
export function setCached<T>(key: string, data: T): CachedData<T> {
    const entry: CachedData<T> = {
        data,
        timestamp: Date.now(),
        meta: {
            status: "hit",
            layer: "memory",
            ageMs: 0,
        },
    };
    memoryCache.set(key, entry);
    return entry;
}

export function getL1CacheMetrics() {
    return {
        memoryKeys: memoryCache.size,
        maxMemoryKeys: MEMORY_CACHE_MAX_KEYS,
        pendingRequests: pendingRequests.size,
        revalidateTrackedKeys: revalidateState.size,
    };
}

/**
 * Invalidate all L1 cache entries whose key starts with any of the given prefixes.
 */
export function invalidateCacheByPrefix(prefixes: string | string[]): number {
    const prefixList = Array.isArray(prefixes) ? prefixes : [prefixes];
    let removed = 0;
    for (const key of memoryCache.keys()) {
        if (prefixList.some((p) => key.startsWith(p))) {
            memoryCache.delete(key);
            pendingRequests.delete(key);
            revalidateState.delete(key);
            removed++;
        }
    }
    return removed;
}

/**
 * High-performance Cache-Aside pattern with Memory LRU + SWR.
 */
export async function getCachedOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions<T>
): Promise<CachedData<T>> {
    const ttlSeconds = options?.ttlSeconds ?? DEFAULT_CACHE_TTL_SECONDS;
    const swrSeconds = options?.staleWhileRevalidateSeconds ?? DEFAULT_STALE_WHILE_REVALIDATE_SECONDS;
    const staleIfErrorSeconds = options?.staleIfErrorSeconds ?? DEFAULT_STALE_IF_ERROR_SECONDS;
    const forceRefresh = options?.forceRefresh ?? false;
    const shouldCache = options?.shouldCache;
    const useDistributedCache = options?.useDistributedCache ?? false;
    const now = Date.now();

    // 1. Check L1 Memory Cache
    if (!forceRefresh) {
        const memEntry = memoryCache.get(key) as CachedData<T> | null;
        if (memEntry) {
            const ageMs = now - memEntry.timestamp;
            const ttlMs = ttlSeconds * 1000;
            const swrMs = swrSeconds * 1000;

            if (ageMs <= ttlMs) {
                return {
                    ...memEntry,
                    meta: {status: "hit", layer: "memory", ageMs},
                };
            }
            if (ageMs <= ttlMs + swrMs) {
                triggerBackgroundRevalidate(key, fetcher, ttlSeconds, memEntry, shouldCache, {
                    swrSeconds,
                    staleIfErrorSeconds,
                    useDistributedCache,
                });
                return {
                    ...memEntry,
                    meta: {status: "stale", layer: "memory", ageMs},
                };
            }
        }

        // 1b. Check L2 Distributed Cache (Upstash Redis) if enabled
        let l2Fallback: CachedData<T> | undefined;
        if (useDistributedCache) {
            const l2Entry = await distributedCache.get<CachedData<T>>(key);
            if (l2Entry && l2Entry.data !== undefined && typeof l2Entry.timestamp === "number") {
                const ageMs = Date.now() - l2Entry.timestamp;
                l2Fallback = {
                    ...l2Entry,
                    meta: {
                        status: l2Entry.meta?.status ?? "hit",
                        layer: "redis",
                        ageMs,
                    },
                };
                const ttlMs = ttlSeconds * 1000;
                const swrMs = swrSeconds * 1000;

                if (ageMs <= ttlMs + swrMs) {
                    memoryCache.set(key, l2Entry);
                    if (ageMs <= ttlMs) {
                        return {
                            ...l2Entry,
                            meta: {status: "hit", layer: "redis", ageMs},
                        };
                    }
                    triggerBackgroundRevalidate(key, fetcher, ttlSeconds, l2Entry, shouldCache, {
                        swrSeconds,
                        staleIfErrorSeconds,
                        useDistributedCache,
                    });
                    return {
                        ...l2Entry,
                        meta: {status: "stale", layer: "redis", ageMs},
                    };
                }
            }
        }

        const l1Fallback = memEntry ?? undefined;
        const staleFallback =
            l1Fallback && l2Fallback
                ? (l2Fallback.timestamp > l1Fallback.timestamp ? l2Fallback : l1Fallback)
                : (l2Fallback ?? l1Fallback);

        return fetchAndStore(key, fetcher, ttlSeconds, staleFallback, staleIfErrorSeconds, shouldCache, {
            swrSeconds,
            useDistributedCache,
        });
    }

    // 2. Cache Miss: Fetch and store
    const memEntry = (memoryCache.get(key) as CachedData<T> | null) ?? undefined;
    return fetchAndStore(key, fetcher, ttlSeconds, memEntry, staleIfErrorSeconds, shouldCache, {
        swrSeconds,
        useDistributedCache,
    });
}

async function fetchAndStore<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number,
    staleFallback?: CachedData<T>,
    staleIfErrorSeconds = DEFAULT_STALE_IF_ERROR_SECONDS,
    shouldCache?: (data: T) => boolean,
    l2Options?: { swrSeconds?: number; useDistributedCache?: boolean }
): Promise<CachedData<T>> {
    const existing = pendingRequests.get(key) as Promise<CachedData<T>> | undefined;
    if (existing) return existing;

    const requestPromise = (async (): Promise<CachedData<T>> => {
        try {
            const data = await fetcher();
            const cacheable = shouldCache ? shouldCache(data) : true;
            const entry: CachedData<T> = {
                data,
                timestamp: Date.now(),
                meta: {
                    status: "miss",
                    layer: "origin",
                    ageMs: 0,
                },
            };

            if (cacheable) {
                memoryCache.set(key, entry);
                if (l2Options?.useDistributedCache) {
                    const totalL2Ttl = ttlSeconds + Math.max(l2Options.swrSeconds ?? 0, staleIfErrorSeconds);
                    await distributedCache.set(key, entry, totalL2Ttl);
                }
            }
            return entry;
        } catch (err) {
            if (staleFallback) {
                const ageMs = Date.now() - staleFallback.timestamp;
                const maxStaleMs = (ttlSeconds + staleIfErrorSeconds) * 1000;
                if (ageMs <= maxStaleMs) {
                    return {
                        ...staleFallback,
                        meta: {
                            status: "fallback",
                            layer: staleFallback.meta?.layer === "redis" ? "redis" : "memory",
                            ageMs,
                            degraded: true,
                        },
                    };
                }
            }
            throw err;
        } finally {
            pendingRequests.delete(key);
        }
    })();

    pendingRequests.set(key, requestPromise as Promise<CachedData<unknown>>);
    return requestPromise;
}

function triggerBackgroundRevalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number,
    currentData?: CachedData<T>,
    shouldCache?: (data: T) => boolean,
    l2Options?: { swrSeconds?: number; staleIfErrorSeconds?: number; useDistributedCache?: boolean }
) {
    const now = Date.now();
    const state = revalidateState.get(key) || {nextAllowedAt: 0, failureCount: 0};
    if (now < state.nextAllowedAt) {
        return;
    }

    state.nextAllowedAt = now + REVALIDATE_COOLDOWN_MS;
    revalidateState.set(key, state);

    fetchAndStore(
        key,
        fetcher,
        ttlSeconds,
        currentData,
        l2Options?.staleIfErrorSeconds ?? DEFAULT_STALE_IF_ERROR_SECONDS,
        shouldCache,
        {swrSeconds: l2Options?.swrSeconds, useDistributedCache: l2Options?.useDistributedCache}
    )
        .then(() => {
            state.failureCount = 0;
            state.nextAllowedAt = 0;
            revalidateState.set(key, state);
        })
        .catch((err) => {
            state.failureCount += 1;
            const backoffMs = Math.min(10000, 1000 * 2 ** (state.failureCount - 1));
            state.nextAllowedAt = Date.now() + backoffMs;
            revalidateState.set(key, state);
            console.warn(`[CacheManager] Background revalidation failed for '${key}':`, err);
        });
}
