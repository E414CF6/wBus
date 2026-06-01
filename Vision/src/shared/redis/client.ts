import {CacheManager} from "@shared/cache/CacheManager";
import {
    DEFAULT_CACHE_TTL_SECONDS, DEFAULT_STALE_IF_ERROR_SECONDS, DEFAULT_STALE_WHILE_REVALIDATE_SECONDS
} from "@shared/cache/cachePolicy";
import {createClient, type RedisClientType} from "redis";
import type {CachedData, CacheMeta, CacheStatus} from "./types";

/**
 * Redis Client for API Response Caching
 *
 * This Redis instance is used for both:
 * - Live transit data (bus locations, arrivals, SSE snapshots)
 * - Static/slow-changing API data (route stops, stop lists)
 *
 * Static files loaded directly on the client (e.g. polylines/schedules JSON)
 * still use in-process CacheManager and CDN caching.
 */

const MEMORY_CACHE_MAX_KEYS = 500;
const REVALIDATE_COOLDOWN_MS = 1000;
const REVALIDATE_MAX_BACKOFF_MS = 15000;

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType | null> | null = null;
let hasLoggedMissingRedisUrl = false;

const pendingRequests = new Map<string, Promise<CachedData<unknown>>>();
const memoryCache = new CacheManager<CachedData<unknown>>(MEMORY_CACHE_MAX_KEYS);
const revalidateState = new Map<string, { nextAllowedAt: number; failureCount: number }>();

async function getRedisClient(): Promise<RedisClientType | null> {
    if (client?.isOpen) return client;

    // Prevent race condition: concurrent requests share the same connection promise
    if (connecting) return connecting;

    connecting = (async () => {
        const url = process.env.REDIS_URL;
        if (!url) {
            if (!hasLoggedMissingRedisUrl) {
                hasLoggedMissingRedisUrl = true;
                console.warn("[Redis] REDIS_URL is not set. Falling back to in-memory cache only.");
            }
            return null;
        }

        const newClient = createClient({
            url, socket: {
                keepAlive: true, reconnectStrategy: (retries) => Math.min(retries * 50, 500),
            }
        });
        newClient.on("error", (err) => {
            console.error("[Redis] Connection error:", err);
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

export interface CacheOptions {
    ttlSeconds?: number;
    staleWhileRevalidateSeconds?: number;
    staleIfErrorSeconds?: number;
}

type ResolvedCacheOptions = Required<CacheOptions>;

function resolveCacheOptions(options?: CacheOptions): ResolvedCacheOptions {
    const ttlSeconds = Math.max(1, Math.round(options?.ttlSeconds ?? DEFAULT_CACHE_TTL_SECONDS));
    const staleWhileRevalidateSeconds = Math.max(0, Math.round(options?.staleWhileRevalidateSeconds ?? DEFAULT_STALE_WHILE_REVALIDATE_SECONDS));
    const staleIfErrorSeconds = Math.max(0, Math.round(options?.staleIfErrorSeconds ?? DEFAULT_STALE_IF_ERROR_SECONDS));

    return {ttlSeconds, staleWhileRevalidateSeconds, staleIfErrorSeconds};
}

/**
 * Get data from the cache with a layered Stale-While-Revalidate strategy.
 *
 * 1. Check L1 in-memory cache.
 * 2. Check L2 Redis cache.
 * 3. Fetch from origin on miss/expiration (deduplicated per key).
 * 4. If origin fails, serve stale-if-error for limited time.
 */
export async function getCachedOrFetch<T>(key: string, fetcher: () => Promise<T>, options?: CacheOptions): Promise<CachedData<T>> {
    const resolvedOptions = resolveCacheOptions(options);
    const {ttlSeconds, staleWhileRevalidateSeconds, staleIfErrorSeconds} = resolvedOptions;
    const redis = await getRedisClient();
    const now = Date.now();
    const staleWindowSeconds = ttlSeconds + staleWhileRevalidateSeconds;
    const maxStaleIfErrorSeconds = staleWindowSeconds + staleIfErrorSeconds;

    const memoryEntry = readMemoryEntry<T>(key);
    const memoryAgeSeconds = memoryEntry ? getAgeSeconds(memoryEntry, now) : Infinity;

    if (memoryEntry && memoryAgeSeconds < ttlSeconds) {
        return withMeta(memoryEntry, "hit", "memory", now);
    }

    if (memoryEntry && memoryAgeSeconds < staleWindowSeconds) {
        triggerBackgroundRevalidation(key, fetcher, resolvedOptions, redis);
        return withMeta(memoryEntry, "stale", "memory", now);
    }

    const redisEntry = await readRedisEntry<T>(key, redis);
    const redisAgeSeconds = redisEntry ? getAgeSeconds(redisEntry, now) : Infinity;

    if (redisEntry) {
        memoryCache.set(key, redisEntry as CachedData<unknown>);

        if (redisAgeSeconds < ttlSeconds) {
            return withMeta(redisEntry, "hit", "redis", now);
        }

        if (redisAgeSeconds < staleWindowSeconds) {
            triggerBackgroundRevalidation(key, fetcher, resolvedOptions, redis);
            return withMeta(redisEntry, "stale", "redis", now);
        }
    }

    try {
        return await getOrFetchDeduplicated<T>(key, fetcher, resolvedOptions, redis);
    } catch (err) {
        const bestFallback = selectBestFallback(memoryEntry, redisEntry);
        if (bestFallback && getAgeSeconds(bestFallback, now) < maxStaleIfErrorSeconds) {
            console.warn(`[Cache] Serving stale-if-error fallback for key=${key}.`, err);
            return withMeta(bestFallback, "fallback", memoryEntry ? "memory" : "redis", now, true);
        }
        throw err;
    }
}

/**
 * Handles fetching, caching, and request deduplication.
 */
async function getOrFetchDeduplicated<T>(key: string, fetcher: () => Promise<T>, options: ResolvedCacheOptions, redis: RedisClientType | null): Promise<CachedData<T>> {
    if (pendingRequests.has(key)) {
        return pendingRequests.get(key) as Promise<CachedData<T>>;
    }

    const promise = fetchAndCache(key, fetcher, options, redis)
        .finally(() => {
            pendingRequests.delete(key);
        });

    pendingRequests.set(key, promise as Promise<CachedData<unknown>>);
    return promise;
}

/**
 * Performs the actual fetch and cache update.
 */
async function fetchAndCache<T>(key: string, fetcher: () => Promise<T>, options: ResolvedCacheOptions, redis: RedisClientType | null): Promise<CachedData<T>> {
    const {ttlSeconds, staleWhileRevalidateSeconds, staleIfErrorSeconds} = options;
    const freshData = await fetcher();
    const entry: CachedData<T> = {
        data: freshData, timestamp: Date.now(),
    };

    memoryCache.set(key, entry as CachedData<unknown>);

    if (redis) {
        // Keep data long enough for SWR + stale-if-error fallback.
        const redisTtl = ttlSeconds + staleWhileRevalidateSeconds + staleIfErrorSeconds;
        try {
            await redis.set(key, JSON.stringify(entry), {EX: redisTtl});
        } catch (err) {
            console.error(`[Redis] Failed to set key: ${key}`, err);
        }
    }

    return withMeta(entry, "miss", "origin", Date.now());
}

function triggerBackgroundRevalidation<T>(key: string, fetcher: () => Promise<T>, options: ResolvedCacheOptions, redis: RedisClientType | null): void {
    const {ttlSeconds} = options;
    const now = Date.now();
    const currentState = revalidateState.get(key);
    if (currentState && now < currentState.nextAllowedAt) {
        return;
    }

    const cooldownMs = getRevalidateCooldownMs(ttlSeconds);
    revalidateState.set(key, {
        nextAllowedAt: now + cooldownMs, failureCount: currentState?.failureCount ?? 0,
    });

    getOrFetchDeduplicated<T>(key, fetcher, options, redis)
        .then(() => {
            revalidateState.set(key, {
                nextAllowedAt: Date.now() + cooldownMs, failureCount: 0,
            });
        })
        .catch((err) => {
            const previousFailures = revalidateState.get(key)?.failureCount ?? 0;
            const nextFailures = Math.min(previousFailures + 1, 6);
            const backoffMs = getRevalidateBackoffMs(ttlSeconds, nextFailures);
            revalidateState.set(key, {
                nextAllowedAt: Date.now() + backoffMs, failureCount: nextFailures,
            });
            console.error(`[Cache] Background revalidation failed for key=${key}:`, err);
        });
}

function withMeta<T>(entry: CachedData<T>, status: CacheStatus, layer: CacheMeta["layer"], now: number, degraded = false): CachedData<T> {
    const isDegraded = degraded || status === "stale" || status === "fallback";
    return {
        ...entry, meta: {
            status, layer, ageMs: Math.max(0, now - entry.timestamp), degraded: isDegraded,
        },
    };
}

function readMemoryEntry<T>(key: string): CachedData<T> | null {
    return (memoryCache.get(key) as CachedData<T> | null) ?? null;
}

async function readRedisEntry<T>(key: string, redis: RedisClientType | null): Promise<CachedData<T> | null> {
    if (!redis) return null;

    let cachedString: string | null = null;
    try {
        cachedString = await redis.get(key);
    } catch (err) {
        console.error(`[Redis] Failed to read key: ${key}`, err);
        return null;
    }

    if (!cachedString) return null;

    try {
        return JSON.parse(cachedString) as CachedData<T>;
    } catch {
        console.warn(`[Redis] Corrupted cache for key: ${key}`);
        return null;
    }
}

function selectBestFallback<T>(memoryEntry: CachedData<T> | null, redisEntry: CachedData<T> | null): CachedData<T> | null {
    if (memoryEntry && redisEntry) {
        return memoryEntry.timestamp >= redisEntry.timestamp ? memoryEntry : redisEntry;
    }

    return memoryEntry ?? redisEntry;
}

function getAgeSeconds(entry: CachedData<unknown>, now: number): number {
    return (now - entry.timestamp) / 1000;
}

function getRevalidateCooldownMs(ttlSeconds: number): number {
    return Math.min(3000, Math.max(REVALIDATE_COOLDOWN_MS, ttlSeconds * 250));
}

function getRevalidateBackoffMs(ttlSeconds: number, failureCount: number): number {
    const baseMs = Math.max(1500, ttlSeconds * 1000);
    const backoffMs = baseMs * (2 ** Math.max(0, failureCount - 1));
    return Math.min(REVALIDATE_MAX_BACKOFF_MS, backoffMs);
}
