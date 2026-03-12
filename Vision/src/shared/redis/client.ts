import { createClient, type RedisClientType } from "redis";
import type { CachedData } from "./types";

export type { CachedData } from "./types";

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
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

/**
 * Get data from Redis cache or fetch fresh data if stale/missing.
 * This is the core "smart cache" — one user's fetch refreshes data for everyone.
 */
export async function getCachedOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = CACHE_TTL_SECONDS
): Promise<CachedData<T>> {
    const redis = await getRedisClient();
    const cached = await redis.get(key);

    if (cached) {
        try {
            const parsed = JSON.parse(cached) as CachedData<T>;
            const age = (Date.now() - parsed.timestamp) / 1000;

            if (age < ttlSeconds) {
                return parsed;
            }
        } catch {
            // Corrupted cache entry — treat as cache miss
        }
    }

    // Cache miss or stale — fetch fresh data
    const freshData = await fetcher();
    const entry: CachedData<T> = {
        data: freshData,
        timestamp: Date.now(),
    };

    // Store in Redis with auto-expiry (2x TTL as a safety net)
    await redis.set(key, JSON.stringify(entry), {EX: ttlSeconds * 2});

    return entry;
}
