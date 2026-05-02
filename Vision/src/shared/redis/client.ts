import {CacheManager} from "@shared/cache/CacheManager";
import {createClient, type RedisClientType} from "redis";
import type {CachedData, CacheMeta, CacheStatus} from "./types";

/**
 * Redis Client for Real-Time Data Caching Only
 *
 * This Redis instance is used EXCLUSIVELY for caching real-time transit data:
 * - Bus locations (GET /api/bus/[routeId]) - 3s TTL
 * - Arrival predictions (GET /api/bus-arrival/[busStopId]) - 3s TTL
 *
 * Static data (routes, stops, polylines) bypasses Redis and uses CDN caching only.
 */

const CACHE_TTL_SECONDS = 10;
const STALE_WHILE_REVALIDATE_SECONDS = 60;
const STALE_IF_ERROR_SECONDS = 300;
const MEMORY_CACHE_MAX_KEYS = 500;

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType | null> | null = null;
let hasLoggedMissingRedisUrl = false;

const pendingRequests = new Map<string, Promise<CachedData<unknown>>>();
const memoryCache = new CacheManager<CachedData<unknown>>(MEMORY_CACHE_MAX_KEYS);

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

        const newClient = createClient({url});
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

/**
 * Get data from cache with layered Stale-While-Revalidate strategy.
 *
 * 1. Check L1 in-memory cache.
 * 2. Check L2 Redis cache.
 * 3. Fetch from origin on miss/expiration (deduplicated per key).
 * 4. If origin fails, serve stale-if-error for limited time.
 */
export async function getCachedOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number = CACHE_TTL_SECONDS): Promise<CachedData<T>> {
    const redis = await getRedisClient();
    const now = Date.now();
    const staleWindowSeconds = ttlSeconds + STALE_WHILE_REVALIDATE_SECONDS;
    const staleIfErrorSeconds = staleWindowSeconds + STALE_IF_ERROR_SECONDS;

    const memoryEntry = readMemoryEntry<T>(key);
    const memoryAgeSeconds = memoryEntry ? getAgeSeconds(memoryEntry, now) : Infinity;

    if (memoryEntry && memoryAgeSeconds < ttlSeconds) {
        return withMeta(memoryEntry, "hit", "memory", now);
    }

    if (memoryEntry && memoryAgeSeconds < staleWindowSeconds) {
        triggerBackgroundRevalidation(key, fetcher, ttlSeconds, redis);
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
            triggerBackgroundRevalidation(key, fetcher, ttlSeconds, redis);
            return withMeta(redisEntry, "stale", "redis", now);
        }
    }

    try {
        return await getOrFetchDeduplicated<T>(key, fetcher, ttlSeconds, redis);
    } catch (err) {
        const bestFallback = selectBestFallback(memoryEntry, redisEntry);
        if (bestFallback && getAgeSeconds(bestFallback, now) < staleIfErrorSeconds) {
            console.warn(`[Cache] Serving stale-if-error fallback for key=${key}.`, err);
            return withMeta(bestFallback, "fallback", memoryEntry ? "memory" : "redis", now, true);
        }
        throw err;
    }
}

/**
 * Handles fetching, caching, and request deduplication.
 */
async function getOrFetchDeduplicated<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number, redis: RedisClientType | null): Promise<CachedData<T>> {
    if (pendingRequests.has(key)) {
        return pendingRequests.get(key) as Promise<CachedData<T>>;
    }

    const promise = fetchAndCache(key, fetcher, ttlSeconds, redis)
        .finally(() => {
            pendingRequests.delete(key);
        });

    pendingRequests.set(key, promise as Promise<CachedData<unknown>>);
    return promise;
}

/**
 * Performs the actual fetch and cache update.
 */
async function fetchAndCache<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number, redis: RedisClientType | null): Promise<CachedData<T>> {
    const freshData = await fetcher();
    const entry: CachedData<T> = {
        data: freshData, timestamp: Date.now(),
    };

    memoryCache.set(key, entry as CachedData<unknown>);

    if (redis) {
        // Keep data long enough for SWR + stale-if-error fallback.
        const redisTtl = ttlSeconds + STALE_WHILE_REVALIDATE_SECONDS + STALE_IF_ERROR_SECONDS;
        try {
            await redis.set(key, JSON.stringify(entry), {EX: redisTtl});
        } catch (err) {
            console.error(`[Redis] Failed to set key: ${key}`, err);
        }
    }

    return withMeta(entry, "miss", "origin", Date.now());
}

function triggerBackgroundRevalidation<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number, redis: RedisClientType | null): void {
    getOrFetchDeduplicated<T>(key, fetcher, ttlSeconds, redis).catch((err) => {
        console.error(`[Cache] Background revalidation failed for key=${key}:`, err);
    });
}

function withMeta<T>(entry: CachedData<T>, status: CacheStatus, layer: CacheMeta["layer"], now: number, degraded = false): CachedData<T> {
    return {
        ...entry, meta: {
            status, layer, ageMs: Math.max(0, now - entry.timestamp), degraded,
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
