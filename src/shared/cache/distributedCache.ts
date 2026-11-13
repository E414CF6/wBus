import {Redis} from "@upstash/redis";

/**
 * Distributed Cache Adapter (L2 Serverless Cache)
 *
 * Uses `@upstash/redis` when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * (or Vercel Marketplace KV_REST_API_URL + KV_REST_API_TOKEN) are configured.
 * Silently operates as a no-op / L1-only mode in local development or unprovisioned environments.
 */

let redisClient: Redis | null | undefined;

function getRedisClient(): Redis | null {
    if (redisClient !== undefined) return redisClient;

    const url = process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim();

    if (!url || !token) {
        redisClient = null;
        return null;
    }

    try {
        redisClient = new Redis({url, token});
        return redisClient;
    } catch (err) {
        console.warn("[DistributedCache] Failed to initialize Upstash Redis client:", err);
        redisClient = null;
        return null;
    }
}

export function resetDistributedCacheClientForTest(): void {
    redisClient = undefined;
}

export interface DistributedCacheStatus {
    configured: boolean;
    backend: "upstash" | "memory";
}

export const distributedCache = {
    getStatus(): DistributedCacheStatus {
        const client = getRedisClient();
        return {
            configured: Boolean(client),
            backend: client ? "upstash" : "memory",
        };
    },

    async get<T>(key: string): Promise<T | null> {
        const client = getRedisClient();
        if (!client) return null;

        try {
            const value = await client.get<T>(key);
            return value ?? null;
        } catch (err) {
            console.warn(`[DistributedCache] GET failed for '${key}':`, err instanceof Error ? err.message : err);
            return null;
        }
    },

    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
        const client = getRedisClient();
        if (!client) return false;

        try {
            if (ttlSeconds && ttlSeconds > 0) {
                await client.set(key, value, {ex: Math.ceil(ttlSeconds)});
            } else {
                await client.set(key, value);
            }
            return true;
        } catch (err) {
            console.warn(`[DistributedCache] SET failed for '${key}':`, err instanceof Error ? err.message : err);
            return false;
        }
    },

    async del(key: string): Promise<boolean> {
        const client = getRedisClient();
        if (!client) return false;

        try {
            await client.del(key);
            return true;
        } catch (err) {
            console.warn(`[DistributedCache] DEL failed for '${key}':`, err instanceof Error ? err.message : err);
            return false;
        }
    },
};
