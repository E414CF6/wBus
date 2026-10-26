import {describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {GET} from "./route";

vi.mock("@entities/route/routeSyncService", () => ({
    generateSingleRoutePolyline: vi.fn().mockImplementation(async (routeId: string, _cityCode: string) => {
        if (routeId === "INVALID_ROUTE") return null;
        return {
            route_id: routeId,
            route_no: "100",
            stops_count: 5,
            total_dist: 4500,
            up_polyline: [
                [127.91, 37.34],
                [127.92, 37.35],
            ],
            down_polyline: [
                [127.92, 37.35],
                [127.91, 37.34],
            ],
            stops: [
                {id: "STOP1", name: "Station 1", ord: 1, ud: 1, lat: 37.34, lon: 127.91, nodeno: "1001"},
                {id: "STOP2", name: "Station 2", ord: 2, ud: 1, lat: 37.35, lon: 127.92, nodeno: "1002"},
            ],
        };
    }),
}));

describe("GET /api/polyline/[routeId]", () => {
    it("returns 400 for invalid routeId parameter", async () => {
        const req = new NextRequest("http://localhost:3000/api/polyline/$$$illegal$$$");
        const res = await GET(req, {params: Promise.resolve({routeId: "$$$illegal$$$"})});
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe("Invalid routeId parameter");
    });

    it("returns 200 with generated polyline for nationwide route", async () => {
        const req = new NextRequest("http://localhost:3000/api/polyline/GNB320100020?cityCode=32010");
        const res = await GET(req, {params: Promise.resolve({routeId: "GNB320100020"})});
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.route_id).toBe("GNB320100020");
        expect(data.up_polyline.length).toBeGreaterThan(0);
        expect(data.stops.length).toBe(2);
        expect(res.headers.get("Cache-Control")).toContain("public");
    });

    it("returns 404 when route polyline cannot be found or generated", async () => {
        const req = new NextRequest("http://localhost:3000/api/polyline/INVALID_ROUTE?cityCode=99999");
        const res = await GET(req, {params: Promise.resolve({routeId: "INVALID_ROUTE"})});
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.error).toContain("Polyline not found");
    });

    it("enforces city boundary: rejects Hoengseong route for Wonju cityCode (32020)", async () => {
        const req = new NextRequest("http://localhost:3000/api/polyline/WJB258002001?cityCode=32020");
        const res = await GET(req, {params: Promise.resolve({routeId: "WJB258002001"})});
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.error).toContain("Hoengseong");
    });

    it("enforces city boundary: rejects Wonju route for Hoengseong cityCode (32320)", async () => {
        const req = new NextRequest("http://localhost:3000/api/polyline/WJB251000036?cityCode=32320");
        const res = await GET(req, {params: Promise.resolve({routeId: "WJB251000036"})});
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.error).toContain("Wonju");
    });
});
