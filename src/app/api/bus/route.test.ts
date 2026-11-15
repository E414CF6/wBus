import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {GET} from "./route";

const mockGetCachedCityRoutes = vi.fn();
const mockFetchBusLocations = vi.fn();

vi.mock("@entities/bus", () => ({
    fetchBusLocations: (...args: unknown[]) => mockFetchBusLocations(...args),
    getAdaptiveTtlSeconds: () => 8,
    getCachedCityRoutes: (...args: unknown[]) => mockGetCachedCityRoutes(...args),
}));

vi.mock("@entities/bus/api/routeWindow", () => ({
    getClientPollHint: () => ({inService: true}),
    warmRouteWindowResources: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@shared/cache", () => ({
    getCachedOrFetch: async (_key: string, fetcher: () => Promise<unknown>) => ({
        data: await fetcher(),
        timestamp: Date.now(),
        meta: {status: "miss", layer: "origin", ageMs: 0},
    }),
}));

describe("GET /api/bus", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 400 when neither routeName nor routeIds is provided", async () => {
        const req = new NextRequest("http://localhost:3000/api/bus?cityCode=32020");
        const res = await GET(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain("routeName");
    });

    it("returns 400 for invalid routeName parameter", async () => {
        const req = new NextRequest("http://localhost:3000/api/bus?routeName=$$$bad$$$&cityCode=32020");
        const res = await GET(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe("Invalid routeName parameter");
    });

    it("resolves routeName to city-filtered routeIds and batches bus locations", async () => {
        mockGetCachedCityRoutes.mockResolvedValue({
            data: [
                {routeid: "WJB251000068", routeno: "30"},
                {routeid: "WJB251000376", routeno: "30"},
                {routeid: "WJB251000999", routeno: "34"},
            ],
            timestamp: Date.now(),
        });

        mockFetchBusLocations.mockImplementation(async (routeId: string) => [
            {
                routeid: routeId,
                routenm: "30",
                vehicleno: `V-${routeId.slice(-3)}`,
                nodenm: "Station",
                gpslati: 37.34,
                gpslong: 127.92,
            },
        ]);

        const req = new NextRequest("http://localhost:3000/api/bus?routeName=30&cityCode=32020");
        const res = await GET(req);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(mockGetCachedCityRoutes).toHaveBeenCalledWith("32020", "30");
        expect(body.data).toHaveLength(2);
        expect(body.meta.routeName).toBe("30");
        expect(body.meta.routes).toEqual(["WJB251000068", "WJB251000376"]);
        expect(res.headers.get("Cache-Control")).toContain("s-maxage=10");
        expect(res.headers.get("X-Batch-Routes-Count")).toBe("2");
    });

    it("returns empty 200 with no-store when routeName has no matching routes", async () => {
        mockGetCachedCityRoutes.mockResolvedValue({
            data: [{routeid: "WJB251000068", routeno: "30"}],
            timestamp: Date.now(),
        });

        const req = new NextRequest("http://localhost:3000/api/bus?routeName=99999&cityCode=32020");
        const res = await GET(req);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data).toEqual([]);
        expect(body.meta.routes).toEqual([]);
        expect(body.meta.routeName).toBe("99999");
        expect(body.meta.degraded).toBe(false);
        expect(res.headers.get("Cache-Control")).toBe("no-store");
    });

    it("preserves backward compatibility for explicit routeIds query", async () => {
        mockFetchBusLocations.mockImplementation(async (routeId: string) => [
            {
                routeid: routeId,
                routenm: "30",
                vehicleno: "1234",
                nodenm: "Stop",
                gpslati: 37.34,
                gpslong: 127.92,
            },
        ]);

        const req = new NextRequest(
            "http://localhost:3000/api/bus?routeIds=WJB251000068,WJB251000376&cityCode=32020"
        );
        const res = await GET(req);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.data).toHaveLength(2);
        expect(body.meta.routes).toEqual(["WJB251000068", "WJB251000376"]);
        expect(mockGetCachedCityRoutes).not.toHaveBeenCalled();
    });
});
