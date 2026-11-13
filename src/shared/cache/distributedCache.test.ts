import {afterEach, describe, expect, it, vi} from "vitest";
import {distributedCache, resetDistributedCacheClientForTest} from "./distributedCache";
import {getCachedOrFetch, invalidateCacheByPrefix} from "./client";

describe("distributedCache & L1/L2 integration", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        resetDistributedCacheClientForTest();
        invalidateCacheByPrefix("dist-test:");
    });

    it("falls back cleanly to memory backend when Redis env vars are not set", async () => {
        vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
        vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
        vi.stubEnv("KV_REST_API_URL", "");
        vi.stubEnv("KV_REST_API_TOKEN", "");
        resetDistributedCacheClientForTest();

        expect(distributedCache.getStatus()).toEqual({configured: false, backend: "memory"});
        expect(await distributedCache.get("dist-test:missing")).toBeNull();
        expect(await distributedCache.set("dist-test:k", {ok: true}, 60)).toBe(false);
        expect(await distributedCache.del("dist-test:k")).toBe(false);
    });

    it("serves L1 memory cache seamlessly even when useDistributedCache is enabled without Redis", async () => {
        resetDistributedCacheClientForTest();
        const fetcher = vi.fn().mockResolvedValue(["30", "34"]);

        const first = await getCachedOrFetch("dist-test:routes", fetcher, {
            ttlSeconds: 60,
            useDistributedCache: true,
        });
        const second = await getCachedOrFetch("dist-test:routes", fetcher, {
            ttlSeconds: 60,
            useDistributedCache: true,
        });

        expect(first.data).toEqual(["30", "34"]);
        expect(first.meta?.layer).toBe("origin");
        expect(second.meta?.status).toBe("hit");
        expect(second.meta?.layer).toBe("memory");
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("falls back to stale L2 Redis cache on cold L1 miss when upstream fails", async () => {
        const staleEntry = {
            data: ["90", "30"],
            timestamp: Date.now() - 120_000, // 2 minutes old (> ttl+swr, < ttl+staleIfError)
            meta: {status: "miss" as const, layer: "origin" as const, ageMs: 0},
        };
        const getSpy = vi.spyOn(distributedCache, "get").mockResolvedValueOnce(staleEntry);
        const failingFetcher = vi.fn().mockRejectedValue(new Error("Upstream 503"));

        const res = await getCachedOrFetch("dist-test:cold-fallback", failingFetcher, {
            ttlSeconds: 30,
            staleWhileRevalidateSeconds: 30,
            staleIfErrorSeconds: 300,
            useDistributedCache: true,
        });

        expect(res.data).toEqual(["90", "30"]);
        expect(res.meta?.status).toBe("fallback");
        expect(res.meta?.layer).toBe("redis");
        expect(res.meta?.degraded).toBe(true);
        getSpy.mockRestore();
    });
});
