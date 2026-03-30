import {createClient, type RedisClientType} from "redis";
import type {CachedData} from "./types";

/**
 * Redis Client for Real-Time Data Caching Only
 * 
 * This Redis instance is used EXCLUSIVELY for caching real-time transit data:
 * - Bus locations (GET /api/bus/[routeId]) - 3s TTL
 * - Arrival predictions (GET /api/bus-arrival/[busStopId]) - 3s TTL
 * 
 * Static data (routes, stops, polylines) bypasses Redis and uses CDN caching only.
 */

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

const pendingRequests = new Map<string, Promise<unknown>>();

async function getRedisClient(): Promise<RedisClientType> {
    if (client && client.isOpen) return client;

    // Prevent race condition: concurrent requests share the same connection promise
    if (connecting) return connecting;

    connecting = (async (): Promise<RedisClientType> => {
        const url = process.env.REDIS_URL;
        if (!url) {
            throw new Error("[Redis] REDIS_URL is not set in environment variables.");
        }

        const newClient = createClient({url});
        newClient.on("error", (err) => {
            console.error("[Redis] Connection error:", err);
        });

        await newClient.connect();
        client = newClient as RedisClientType;
        return client;
    })();

    try {
        return await connecting;
    } finally {
        connecting = null;
    }
}

const CACHE_TTL_SECONDS = 10;
const STALE_WHILE_REVALIDATE_SECONDS = 60; // Keep stale data for 1 minute

/**
 * Get data from Redis cache with Stale-While-Revalidate strategy.
 * 
 * USAGE: Only for real-time data endpoints (/api/bus, /api/bus-arrival).
 * Static endpoints should use createStaticApiHandler() instead.
 *
 * 1. If fresh in Redis -> Return immediately.
 * 2. If stale in Redis (but < SWR window) -> Return stale immediately, update in background.
 * 3. If missing or expired -> Fetch, cache, and return.
 * 4. Deduplicates concurrent fetches for the same key on this instance.
 */
export async function getCachedOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = CACHE_TTL_SECONDS
): Promise<CachedData<T>> {
    const redis = await getRedisClient();

    // 1. Check Redis
    const cachedString = await redis.get(key);
    let cachedEntry: CachedData<T> | null = null;

    if (cachedString) {
        try {
            cachedEntry = JSON.parse(cachedString) as CachedData<T>;
        } catch {
            console.warn(`[Redis] Corrupted cache for key: ${key}`);
        }
    }

    const now = Date.now();

    // Calculate age in seconds
    const age = cachedEntry ? (now - cachedEntry.timestamp) / 1000 : Infinity;

    // STRATEGY: Fresh -> Return
    if (cachedEntry && age < ttlSeconds) {
        return cachedEntry;
    }

    // STRATEGY: Stale-While-Revalidate -> Return Stale, Fetch Background
    if (cachedEntry && age < (ttlSeconds + STALE_WHILE_REVALIDATE_SECONDS)) {
        // Trigger background update (fire and forget)
        // We use the deduplication logic even for background updates to prevent spamming
        fetchAndCache(key, fetcher, ttlSeconds, redis).catch(err =>
            console.error(`[Redis] Background update failed for ${key}:`, err)
        );

        return cachedEntry;
    }

    // STRATEGY: Cache Miss or Expired -> Fetch (blocking)
    // Use deduplication to prevent stampedes
    return getOrFetchDeduplicated(key, fetcher, ttlSeconds, redis);
}

/**
 * Handles fetching, caching, and request deduplication.
 */
async function getOrFetchDeduplicated<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number,
    redis: RedisClientType
): Promise<CachedData<T>> {
    // Check if there's already a pending request for this key
    if (pendingRequests.has(key)) {
        return pendingRequests.get(key) as Promise<CachedData<T>>;
    }

    const promise = fetchAndCache(key, fetcher, ttlSeconds, redis)
        .finally(() => {
            pendingRequests.delete(key);
        });

    pendingRequests.set(key, promise);
    return promise;
}

/**
 * Performs the actual fetch and cache update.
 */
async function fetchAndCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number,
    redis: RedisClientType
): Promise<CachedData<T>> {
    const freshData = await fetcher();
    const entry: CachedData<T> = {
        data: freshData,
        timestamp: Date.now(),
    };

    // Store in Redis with expiration (TTL + SWR window)
    // We keep it longer in Redis than the strict TTL to allow for SWR
    const redisTtl = ttlSeconds + STALE_WHILE_REVALIDATE_SECONDS;

    await redis.set(key, JSON.stringify(entry), {EX: redisTtl});

    return entry;
}
