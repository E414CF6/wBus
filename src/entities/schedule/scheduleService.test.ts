import {describe, expect, it} from "vitest";
import {
    getCacheMetadata,
    mergeRouteDatasets,
    MIN_REFRESH_INTERVAL_DAYS,
    MIN_REFRESH_INTERVAL_MS,
} from "./scheduleService";
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

    it("merges partial datasets into base without losing existing routes", () => {
        const base: RouteDataset = {
            updatedAt: "2026-01-01T00:00:00.000Z",
            sourceUrl: "http://its.wonju.go.kr",
            totalRoutes: 2,
            routes: [
                {
                    id: "1",
                    rawNo: "2",
                    routeNo: "2",
                    dayType: "매일",
                    origin: "관설동",
                    destination: "태장동",
                    firstBus: "06:00",
                    lastBus: "22:00",
                    runCount: "20",
                    interval: "15",
                    timetable: [],
                },
                {
                    id: "2",
                    rawNo: "30",
                    routeNo: "30",
                    dayType: "매일",
                    origin: "장양리",
                    destination: "연세대",
                    firstBus: "06:00",
                    lastBus: "22:00",
                    runCount: "10",
                    interval: "30",
                    timetable: [],
                },
            ],
        };

        const partial: RouteDataset = {
            updatedAt: "2026-01-02T00:00:00.000Z",
            sourceUrl: "http://its.wonju.go.kr",
            totalRoutes: 1,
            routes: [
                {
                    id: "2-updated",
                    rawNo: "30",
                    routeNo: "30",
                    dayType: "매일",
                    origin: "장양리",
                    destination: "연세대",
                    firstBus: "05:50",
                    lastBus: "22:10",
                    runCount: "12",
                    interval: "25",
                    timetable: [{seq: 1, originDepTime: "05:50", destDepTime: "06:30", type: "일반", notes: ""}],
                },
            ],
        };

        const merged = mergeRouteDatasets(base, partial);
        expect(merged.totalRoutes).toBe(2);
        expect(merged.routes.length).toBe(2);

        // Route 2 preserved
        const route2 = merged.routes.find((r) => r.routeNo === "2");
        expect(route2).toBeDefined();
        expect(route2?.origin).toBe("관설동");

        // Route 30 updated with partial data
        const route30 = merged.routes.find((r) => r.routeNo === "30");
        expect(route30).toBeDefined();
        expect(route30?.firstBus).toBe("05:50");
        expect(route30?.timetable.length).toBe(1);
    });
});

