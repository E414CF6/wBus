import {CacheManager} from "@shared/cache/CacheManager";
import {
    DEFAULT_CACHE_TTL_SECONDS,
    DEFAULT_STALE_IF_ERROR_SECONDS,
    DEFAULT_STALE_WHILE_REVALIDATE_SECONDS,
} from "@shared/cache/cachePolicy";
import {mapWithConcurrencyLimit} from "@shared/utils/concurrency";
import {createClient, type RedisClientType} from "redis";
import type {CachedData} from "./types";

/**
 * Redis Client for Live Transit Telemetry Caching
 *
 * This Redis instance is dedicated strictly to high-frequency live transit data:
 * - Live bus locations (bus:${routeId})
 * - Real-time arrival predictions (arrival:${busStopId})
 *
 * All static/slow-changing data (route stops, station maps, polylines, notices, schedules)
 * uses in-process JSON CacheManager, Vercel Blob, and CDN caching.
 */

export interface CacheOptions {
    ttlSeconds?: number;
    staleWhileRevalidateSeconds?: number;
    staleIfErrorSeconds?: number;
    forceRefresh?: boolean;
}

const MEMORY_CACHE_MAX_KEYS = 500;
const REVALIDATE_COOLDOWN_MS = 1000;
const REVALIDATE_MAX_BACKOFF_MS = 15000;

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType | null> | null = null;
let hasLoggedMissingRedisUrl = false;

const pendingRequests = new Map<string, Promise<CachedData<unknown>>>();
const memoryCache = new CacheManager<CachedData<unknown>>(MEMORY_CACHE_MAX_KEYS);
const revalidateState = new Map<string, { nextAllowedAt: number; failureCount: number }>();

export function getRedisUrl(): string | undefined {
    return (
        process.env.REDIS_URL ||
        process.env.KV_URL ||
        process.env.UPSTASH_REDIS_URL ||
        process.env.STORAGE_REDIS_URL ||
        process.env.REDIS_TLS_URL ||
        process.env.REDIS_URI
    );
}

export async function getRedisClient(): Promise<RedisClientType | null> {
    if (client?.isOpen) return client;

    // Prevent race condition: concurrent requests share the same connection promise
    if (connecting) return connecting;

    connecting = (async () => {
        const url = getRedisUrl();
        if (!url) {
            if (!hasLoggedMissingRedisUrl) {
                hasLoggedMissingRedisUrl = true;
                console.warn("[Redis] REDIS_URL/KV_URL is not set. Falling back to in-memory cache only.");
            }
            return null;
        }

        const newClient = createClient({
            url,
            socket: {
                keepAlive: true,
                connectTimeout: 5000, // Important for serverless
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        return new Error("Max Redis retries reached");
                    }
                    return Math.min(retries * 50, 500);
                },
            },
        });

        newClient.on("error", (err) => {
            console.error("[Redis] Connection error:", err);
            // If the socket dies, we want the next request to attempt a fresh connection
            if (!newClient.isOpen && client === newClient) {
                client = null;
            }
        });

        try {
            await newClient.connect();
            client = newClient as RedisClientType;
            return client;
        } catch (err) {
            console.error("[Redis] Failed to connect. Falling back to in-memory cache.", err);
            return null;
        }
    })();

    try {
        return await connecting;
    } finally {
        connecting = null;
    }
}

/**
 * High-performance Cache-Aside pattern with Memory L1 + Redis L2 fallback.
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

        // 2. Check L2 Redis Cache
        const redis = await getRedisClient();
        if (redis?.isOpen) {
            try {
                const raw = await redis.get(key);
                if (raw) {
                    const redisEntry: CachedData<T> = JSON.parse(raw);
                    const ageMs = now - redisEntry.timestamp;
                    const ttlMs = ttlSeconds * 1000;
                    const swrMs = swrSeconds * 1000;

                    memoryCache.set(key, redisEntry);

                    if (ageMs <= ttlMs) {
                        return {
                            ...redisEntry,
                            meta: {status: "hit", layer: "redis", ageMs},
                        };
                    }
                    if (ageMs <= ttlMs + swrMs) {
                        triggerBackgroundRevalidate(key, fetcher, ttlSeconds, redisEntry);
                        return {
                            ...redisEntry,
                            meta: {status: "stale", layer: "redis", ageMs},
                        };
                    }
                }
            } catch (e) {
                console.warn(`[Redis] Failed to read key '${key}':`, e);
            }
        }
    }

    // 3. Cache Miss: Fetch and store
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

            const redis = await getRedisClient();
            if (redis?.isOpen) {
                const expireSec = ttlSeconds + DEFAULT_STALE_WHILE_REVALIDATE_SECONDS;
                await redis.set(key, JSON.stringify(entry), {EX: expireSec}).catch((err) => {
                    console.warn(`[Redis] Failed to write key '${key}':`, err);
                });
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

    fetchAndStore(key, fetcher, ttlSeconds, currentData).catch((err) => {
        console.warn(`[Cache] Background revalidation failed for '${key}':`, err);
    });
}
