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

    async ping(timeoutMs = 1500): Promise<{ ok: boolean; latencyMs: number; backend: "upstash" | "memory" }> {
        const start = Date.now();
        const client = getRedisClient();
        if (!client) {
            return {ok: false, latencyMs: 0, backend: "memory"};
        }

        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            await Promise.race([
                client.ping(),
                new Promise<never>((_, reject) => {
                    timer = setTimeout(() => reject(new Error("Redis ping timeout")), timeoutMs);
                }),
            ]);
            return {ok: true, latencyMs: Date.now() - start, backend: "upstash"};
        } catch {
            return {ok: false, latencyMs: Date.now() - start, backend: "upstash"};
        } finally {
            if (timer) clearTimeout(timer);
        }
    },

    async get<T>(key: string, timeoutMs?: number): Promise<T | null> {
        const client = getRedisClient();
        if (!client) return null;

        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const getPromise = client.get<T>(key);
            const value =
                timeoutMs && timeoutMs > 0
                    ? await Promise.race([
                        getPromise,
                        new Promise<null>((resolve) => {
                            timer = setTimeout(() => resolve(null), timeoutMs);
                        }),
                    ])
                    : await getPromise;
            return value ?? null;
        } catch (err) {
            console.warn(`[DistributedCache] GET failed for '${key}':`, err instanceof Error ? err.message : err);
            return null;
        } finally {
            if (timer) clearTimeout(timer);
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

    async delByPrefix(prefix: string, maxIterations = 20): Promise<number> {
        const client = getRedisClient();
        if (!client || !prefix) return 0;

        let deleted = 0;
        let cursor: string | number = 0;
        let iterations = 0;

        try {
            do {
                const res: [string | number, string[]] = await client.scan(cursor, {match: `${prefix}*`, count: 100});
                const [nextCursor, keys] = res;
                if (Array.isArray(keys) && keys.length > 0) {
                    await client.del(...keys);
                    deleted += keys.length;
                }
                cursor = nextCursor;
                iterations++;
            } while (String(cursor) !== "0" && iterations < maxIterations);
        } catch (err) {
            console.warn(`[DistributedCache] delByPrefix failed for '${prefix}':`, err instanceof Error ? err.message : err);
        }

        return deleted;
    },
};
