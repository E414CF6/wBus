import {describe, expect, it, vi} from "vitest";
import {CacheManager} from "./CacheManager";

describe("CacheManager", () => {
    it("stores and retrieves cached values", () => {
        const cache = new CacheManager<string>(5);
        cache.set("key1", "value1");
        expect(cache.get("key1")).toBe("value1");
        expect(cache.get("nonexistent")).toBeNull();
    });

    it("evicts least recently used items when exceeding maxSize", () => {
        const cache = new CacheManager<number>(3);
        cache.set("a", 1);
        cache.set("b", 2);
        cache.set("c", 3);

        // Access 'a' so 'b' becomes the oldest
        cache.get("a");

        // Insert 'd', should evict 'b'
        cache.set("d", 4);

        expect(cache.get("b")).toBeNull();
        expect(cache.get("a")).toBe(1);
        expect(cache.get("c")).toBe(3);
        expect(cache.get("d")).toBe(4);
    });

    it("deduplicates concurrent calls using getOrFetch", async () => {
        const cache = new CacheManager<string>(10);
        const fetcher = vi.fn(async () => {
            await new Promise((resolve) => setTimeout(resolve, 30));
            return "fetched-result";
        });

        // Launch 3 simultaneous requests for the same key
        const [res1, res2, res3] = await Promise.all([cache.getOrFetch("test-key", fetcher), cache.getOrFetch("test-key", fetcher), cache.getOrFetch("test-key", fetcher),]);

        expect(res1).toBe("fetched-result");
        expect(res2).toBe("fetched-result");
        expect(res3).toBe("fetched-result");
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("clears cache completely on clear()", () => {
        const cache = new CacheManager<string>(5);
        cache.set("a", "1");
        cache.set("b", "2");
        expect(cache.size()).toBe(2);

        cache.clear();
        expect(cache.size()).toBe(0);
        expect(cache.get("a")).toBeNull();
    });

    it("clears except specified keys with clearExcept()", () => {
        const cache = new CacheManager<string>(5);
        cache.set("k1", "v1");
        cache.set("k2", "v2");
        cache.set("k3", "v3");

        cache.clearExcept(["k2"]);
        expect(cache.get("k1")).toBeNull();
        expect(cache.get("k2")).toBe("v2");
        expect(cache.get("k3")).toBeNull();
    });
});
