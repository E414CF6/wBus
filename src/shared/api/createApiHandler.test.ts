import {beforeEach, describe, expect, it, vi} from "vitest";
import {createApiHandler} from "./createApiHandler";
import {invalidateCacheByPrefix, setCached} from "@shared/cache";

describe("createApiHandler hardening", () => {
    beforeEach(() => {
        invalidateCacheByPrefix("handler-test:");
    });

    it("does not store uncacheable responses when shouldCache returns false", async () => {
        const fetcher = vi.fn().mockResolvedValue([]);
        const handler = createApiHandler<string[]>({
            paramKey: "id",
            cacheKey: (id) => `handler-test:${id}`,
            fetcher,
            ttl: 3600,
            errorMessage: "Failed",
            cacheControl: "public, s-maxage=3600",
            shouldCache: (data) => data.length > 0,
            resolveCacheControl: (res) => (res.data.length === 0 ? "no-store" : "public, s-maxage=3600"),
            loggerPrefix: "/test",
        });

        const req = new Request("http://localhost/api/test/empty");
        const res1 = await handler(req, {params: Promise.resolve({id: "empty"})});
        const res2 = await handler(req, {params: Promise.resolve({id: "empty"})});

        expect(res1.headers.get("Cache-Control")).toBe("no-store");
        expect(res2.headers.get("Cache-Control")).toBe("no-store");
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it("serves fallback data with Cache-Control: no-store when upstream fails during stale window", async () => {
        setCached("handler-test:stale-item", ["cached-value"]);
        // Force stale fallback by backdating entry isn't needed when forceRefresh=true throws and memory has fresh/stale entry
        const fetcher = vi.fn().mockRejectedValue(new Error("Upstream 502"));
        const handler = createApiHandler<string[]>({
            paramKey: "id",
            cacheKey: (id) => `handler-test:${id}`,
            fetcher,
            ttl: 60,
            errorMessage: "Failed",
            cacheControl: "public, s-maxage=60",
            loggerPrefix: "/test",
        });

        const req = new Request("http://localhost/api/test/stale-item?refresh=true");
        const res = await handler(req, {params: Promise.resolve({id: "stale-item"})});
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toEqual(["cached-value"]);
        expect(body.meta?.degraded).toBe(true);
        expect(res.headers.get("X-Cache-Degraded")).toBe("true");
        expect(res.headers.get("Cache-Control")).toBe("no-store");
    });
});
