import {describe, expect, it, vi} from "vitest";
import {getRouteVariations} from "./api";

const {MockHttpError} = vi.hoisted(() => {
    class MockHttpError extends Error {
        status: number;
        constructor(msg: string, status: number) {
            super(msg);
            this.status = status;
        }
    }
    return {MockHttpError};
});

vi.mock("@shared/api/fetchAPI", () => ({
    HttpError: MockHttpError,
    fetchAPI: vi.fn().mockImplementation(async (url: string) => {
        // Mock Route 4: WJB251000042
        if (url.includes("WJB251000042")) {
            return {
                route_id: "WJB251000042",
                route_no: "4",
                stops: [
                    {id: "S1", name: "관설동", ord: 1, ud: 0, lat: 37.31, lon: 127.94},
                    {id: "S2", name: "단구동", ord: 2, ud: 0, lat: 37.33, lon: 127.94},
                    {id: "S3", name: "원주역", ord: 3, ud: 1, lat: 37.34, lon: 127.93},
                ],
                up_polyline: [],
                down_polyline: [],
            };
        }

        // Mock Route 30: WJB251000068 & WJB251000376
        if (url.includes("WJB251000068")) {
            return {
                route_id: "WJB251000068",
                route_no: "30",
                stops: [
                    {id: "W1", name: "장양리", ord: 1, ud: 0, lat: 37.40, lon: 127.94},
                    {id: "W2", name: "중앙시장", ord: 2, ud: 0, lat: 37.35, lon: 127.94},
                    {id: "W3", name: "연세대미래캠퍼스", ord: 3, ud: 0, lat: 37.28, lon: 127.90},
                    {id: "W4", name: "연세대스포츠센터", ord: 4, ud: 1, lat: 37.28, lon: 127.90},
                    {id: "W5", name: "장양리", ord: 5, ud: 1, lat: 37.40, lon: 127.94},
                ],
                up_polyline: [],
                down_polyline: [],
            };
        }
        if (url.includes("WJB251000376")) {
            return {
                route_id: "WJB251000376",
                route_no: "30",
                stops: [
                    {id: "W1", name: "장양리", ord: 1, ud: 0, lat: 37.40, lon: 127.94},
                    {id: "W2b", name: "우산동", ord: 2, ud: 0, lat: 37.36, lon: 127.94},
                    {id: "W3", name: "연세대미래캠퍼스", ord: 3, ud: 0, lat: 37.28, lon: 127.90},
                    {id: "W4", name: "연세대스포츠센터", ord: 4, ud: 1, lat: 37.28, lon: 127.90},
                    {id: "W5", name: "장양리", ord: 5, ud: 1, lat: 37.40, lon: 127.94},
                ],
                up_polyline: [],
                down_polyline: [],
            };
        }

        // Mock Route 2: 5 sub-routes
        const r2Ids = ["WJB251000036", "WJB251000215", "WJB251000256", "WJB251000257", "WJB251000391"];
        for (let i = 0; i < r2Ids.length; i++) {
            const id = r2Ids[i];
            if (url.includes(id)) {
                return {
                    route_id: id,
                    route_no: "2",
                    stops: [
                        {id: "R2_1", name: "관설동", ord: 1, ud: 0, lat: 37.31, lon: 127.94},
                        {id: `R2_2_${i}`, name: i === 0 ? "남부시장" : `경유지_${i}`, ord: 2, ud: 0, lat: 37.33, lon: 127.94},
                        {id: "R2_3", name: "삼일광장", ord: 3, ud: 0, lat: 37.35, lon: 127.95},
                        {id: "R2_4", name: "시외버스터미널", ord: 4, ud: 1, lat: 37.34, lon: 127.93},
                        {id: "R2_5", name: "관설동", ord: 5, ud: 1, lat: 37.31, lon: 127.94},
                    ],
                    up_polyline: [],
                    down_polyline: [],
                };
            }
        }

        throw new MockHttpError("Not found", 404);
    }),
}));

describe("getRouteVariations", () => {
    it("returns empty array for non-existent route", async () => {
        const variations = await getRouteVariations("INVALID_ROUTE_9999");
        expect(variations).toEqual([]);
    });

    it("loads single variation route (Route 4) with correct sequence", async () => {
        const variations = await getRouteVariations("4");
        expect(variations.length).toBe(1);
        const v = variations[0];
        expect(v.label).toBe("기본 노선");
        expect(v.stops.length).toBeGreaterThan(0);

        // Sequence must be strictly sorted by nodeord
        for (let i = 0; i < v.stops.length - 1; i++) {
            expect(v.stops[i].nodeord).toBeLessThan(v.stops[i + 1].nodeord);
        }
    });

    it("loads multi-variation route (Route 30) with distinct, non-corrupted variations", async () => {
        const variations = await getRouteVariations("30");
        expect(variations.length).toBeGreaterThan(1);

        // First variation must be the base route
        const base = variations[0];
        expect(base.label).toBe("기본 노선");
        expect(base.turningStop).not.toBeNull();
        expect(base.turningStop?.nodenm).toContain("연세대");

        // Every variation's stops must be monotonically ordered by nodeord without duplicates
        for (const variant of variations) {
            expect(variant.stops.length).toBeGreaterThan(0);
            const ords = variant.stops.map((s) => s.nodeord);
            const uniqueOrds = new Set(ords);
            expect(uniqueOrds.size).toBe(ords.length);

            for (let i = 0; i < variant.stops.length - 1; i++) {
                expect(variant.stops[i].nodeord).toBeLessThan(variant.stops[i + 1].nodeord);
            }
        }

        // Turning stop in base route transitions from ud=0 to ud=1
        if (base.turningStop) {
            const turnIndex = base.stops.findIndex(
                (s) => s.nodeid === base.turningStop?.nodeid && s.nodeord === base.turningStop?.nodeord
            );
            expect(turnIndex).toBeGreaterThan(-1);
            expect(base.stops[turnIndex].updowncd).toBe(0);
            if (turnIndex < base.stops.length - 1) {
                expect(base.stops[turnIndex + 1].updowncd).toBe(1);
            }
        }
    });

    it("loads multi-variation route (Route 2) with friendly Korean labels and turning point", async () => {
        const variations = await getRouteVariations("2");
        expect(variations.length).toBeGreaterThanOrEqual(4);

        const labels = variations.map((v) => v.label);
        expect(labels[0]).toBe("기본 노선");

        // Turning stop in Route 2 base route
        const base = variations[0];
        expect(base.turningStop).not.toBeNull();
        expect(base.turningStop?.nodenm).toBe("삼일광장");

        // All variations must have valid labels and positive stop counts
        for (const v of variations) {
            expect(v.label.length).toBeGreaterThan(0);
            expect(v.stopCount).toBe(v.stops.length);
        }
    });
});
