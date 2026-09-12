import {describe, expect, it} from "vitest";
import {getCacheMetadata, MIN_REFRESH_INTERVAL_DAYS, MIN_REFRESH_INTERVAL_MS,} from "./scheduleService";
import type {RouteDataset} from "./types";

describe("scheduleService caching and refresh interval", () => {
    it("has MIN_REFRESH_INTERVAL_DAYS set to 3", () => {
        expect(MIN_REFRESH_INTERVAL_DAYS).toBe(3);
        expect(MIN_REFRESH_INTERVAL_MS).toBe(3 * 24 * 60 * 60 * 1000);
    });

    it("returns correct metadata with 3-day refresh interval", () => {
        const dummyData: RouteDataset = {
            updatedAt: new Date().toISOString(),
            sourceUrl: "http://its.wonju.go.kr/bus/bus04.do",
            totalRoutes: 5,
            routes: [],
        };

        const meta = getCacheMetadata(dummyData);
        expect(meta.minRefreshIntervalDays).toBe(3);
        expect(meta.canRefresh).toBe(false);

        const updatedMs = new Date(dummyData.updatedAt).getTime();
        const nextMs = new Date(meta.nextRefreshAvailableAt!).getTime();
        expect(nextMs - updatedMs).toBe(3 * 24 * 60 * 60 * 1000);
    });

    it("allows refresh when updatedAt is older than 3 days", () => {
        const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
        const dummyData: RouteDataset = {
            updatedAt: fourDaysAgo,
            sourceUrl: "http://its.wonju.go.kr/bus/bus04.do",
            totalRoutes: 5,
            routes: [],
        };

        const meta = getCacheMetadata(dummyData);
        expect(meta.canRefresh).toBe(true);
    });

    it("disallows refresh when updatedAt is within 3 days (e.g. 2 days ago)", () => {
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
        const dummyData: RouteDataset = {
            updatedAt: twoDaysAgo,
            sourceUrl: "http://its.wonju.go.kr/bus/bus04.do",
            totalRoutes: 5,
            routes: [],
        };

        const meta = getCacheMetadata(dummyData);
        expect(meta.canRefresh).toBe(false);
    });
});
