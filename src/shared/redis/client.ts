import {CacheManager} from "@shared/cache/CacheManager";
import {
    DEFAULT_CACHE_TTL_SECONDS,
    DEFAULT_STALE_IF_ERROR_SECONDS,
    DEFAULT_STALE_WHILE_REVALIDATE_SECONDS,
} from "@shared/cache/cachePolicy";
import {mapWithConcurrencyLimit} from "@shared/utils/concurrency";
import type {CachedData} from "./types";

/**
 * In-Memory Client for Transit Telemetry Caching
 *
 * Provides ultra-fast L1 in-memory caching with request deduplication (coalescing),
 * stale-while-revalidate background fetching, and stale-if-error fallback.
 * Works hand-in-hand with Vercel Edge CDN micro-caching (s-maxage).
 */

export interface CacheOptions {
    ttlSeconds?: number;
    staleWhileRevalidateSeconds?: number;
    staleIfErrorSeconds?: number;
    forceRefresh?: boolean;
}

const MEMORY_CACHE_MAX_KEYS = 500;
const REVALIDATE_COOLDOWN_MS = 1000;

const pendingRequests = new Map<string, Promise<CachedData<unknown>>>();
const memoryCache = new CacheManager<CachedData<unknown>>(MEMORY_CACHE_MAX_KEYS);
const revalidateState = new Map<string, { nextAllowedAt: number; failureCount: number }>();

/**
 * High-performance Cache-Aside pattern with Memory LRU + SWR.
 */
export async function getCachedOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
): Promise<CachedData<T>> {
    const ttlSeconds = options?.ttlSeconds ?? DEFAULT_CACHE_TTL_SECONDS;
    const swrSeconds = options?.staleWhileRevalidateSeconds ?? DEFAULT_STALE_WHILE_REVALIDATE_SECONDS;
    const staleIfErrorSeconds = options?.staleIfErrorSeconds ?? DEFAULT_STALE_IF_ERROR_SECONDS;
    const forceRefresh = options?.forceRefresh ?? false;
    const now = Date.now();

    // 1. Check L1 Memory Cache
    if (!forceRefresh) {
        const memEntry = memoryCache.get(key) as CachedData<T> | undefined;
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
                triggerBackgroundRevalidate(key, fetcher, ttlSeconds, memEntry);
                return {
                    ...memEntry,
                    meta: {status: "stale", layer: "memory", ageMs},
                };
            }
        }
    }

    // 2. Cache Miss: Fetch and store
    const memEntry = memoryCache.get(key) as CachedData<T> | undefined;
    return fetchAndStore(key, fetcher, ttlSeconds, memEntry, staleIfErrorSeconds);
}

export async function getMultipleCachedOrFetch<T>(
    items: Array<{ key: string; fetcher: () => Promise<T>; options?: CacheOptions }>,
    defaultOptions?: CacheOptions
): Promise<Map<string, CachedData<T>>> {
    const results = new Map<string, CachedData<T>>();
    const settled = await mapWithConcurrencyLimit(
        items,
        async (item) => {
            const mergedOptions = {...defaultOptions, ...item.options};
            const cached = await getCachedOrFetch(item.key, item.fetcher, mergedOptions);
            return {key: item.key, cached};
        },
        {concurrency: 5, staggerMs: 20}
    );

    for (const res of settled) {
        if (res.status === "fulfilled" && res.value) {
            results.set(res.value.key, res.value.cached);
        }
    }

    return results;
}

async function fetchAndStore<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number,
    staleFallback?: CachedData<T>,
    staleIfErrorSeconds = DEFAULT_STALE_IF_ERROR_SECONDS
): Promise<CachedData<T>> {
    const existing = pendingRequests.get(key) as Promise<CachedData<T>> | undefined;
    if (existing) return existing;

    const requestPromise = (async (): Promise<CachedData<T>> => {
        try {
            const data = await fetcher();
            const entry: CachedData<T> = {
                data,
                timestamp: Date.now(),
                meta: {
                    status: "miss",
                    layer: "origin",
                    ageMs: 0,
                },
            };

            memoryCache.set(key, entry);
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
                            layer: "memory",
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
    currentData?: CachedData<T>
) {
    const now = Date.now();
    const state = revalidateState.get(key) || {nextAllowedAt: 0, failureCount: 0};
    if (now < state.nextAllowedAt) {
        return;
    }

    state.nextAllowedAt = now + REVALIDATE_COOLDOWN_MS;
    revalidateState.set(key, state);

    fetchAndStore(key, fetcher, ttlSeconds, currentData)
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
