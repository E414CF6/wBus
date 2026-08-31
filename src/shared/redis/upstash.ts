import {Redis} from "@upstash/redis";

let upstashClient: Redis | null = null;
let isUpstashConfigured: boolean | null = null;

/**
 * Returns an instance of Upstash Redis REST client if credentials exist in environment variables.
 * Falls back gracefully to null if not configured.
 */
export function getUpstashRedis(): Redis | null {
    if (isUpstashConfigured === false) {
        return null;
    }

    if (upstashClient) {
        return upstashClient;
    }

    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
        isUpstashConfigured = false;
        return null;
    }

    try {
        upstashClient = new Redis({
            url, token,
        });
        isUpstashConfigured = true;
        return upstashClient;
    } catch (e) {
        console.warn("[Upstash] Failed to initialize Redis client:", e);
        isUpstashConfigured = false;
        return null;
    }
}
