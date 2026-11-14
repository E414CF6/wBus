import {afterEach, describe, expect, it, vi} from "vitest";
import {computeStopsHash, refreshRouteData} from "./routeSyncService";

const {
    mockFetchCityRoutes,
    mockFetchRouteStops,
    mockGetJson,
    mockPutJson,
    mockDistributedSet,
    mockDistributedGet
} = vi.hoisted(() => ({
    mockFetchCityRoutes: vi.fn(),
    mockFetchRouteStops: vi.fn(),
    mockGetJson: vi.fn(),
    mockPutJson: vi.fn(),
    mockDistributedSet: vi.fn().mockResolvedValue(true),
    mockDistributedGet: vi.fn().mockResolvedValue(null),
}));

vi.mock("@entities/bus", () => ({
    fetchCityRoutes: mockFetchCityRoutes,
    fetchRouteStops: mockFetchRouteStops,
}));

vi.mock("@shared/cache/artifactStore", () => ({
    artifactStore: {
        getJson: mockGetJson,
        putJson: mockPutJson,
    },
}));

vi.mock("@shared/cache/distributedCache", () => ({
    distributedCache: {
        get: mockDistributedGet,
        set: mockDistributedSet,
        del: vi.fn().mockResolvedValue(false),
        delByPrefix: vi.fn().mockResolvedValue(0),
        getStatus: vi.fn().mockReturnValue({configured: false, backend: "memory"}),
    },
}));

describe("routeSyncService incremental sync & cursor pagination", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.clearAllMocks();
    });

    it("computes deterministic stop digests that change when stop order or coords change", () => {
        const stopsA = [
            {nodeid: "S1", nodeord: 1, updowncd: 0, gpslati: 37.341, gpslong: 127.912},
            {nodeid: "S2", nodeord: 2, updowncd: 0, gpslati: 37.345, gpslong: 127.918},
        ];
        const stopsB = [
            {nodeid: "S1", nodeord: 1, updowncd: 0, gpslati: 37.341, gpslong: 127.912},
            {nodeid: "S2", nodeord: 2, updowncd: 0, gpslati: 37.349, gpslong: 127.918},
        ];

        expect(computeStopsHash(stopsA)).toBe(computeStopsHash([...stopsA]));
        expect(computeStopsHash(stopsA)).not.toBe(computeStopsHash(stopsB));
    });

    it("skips routes whose existing artifact stops_hash matches without calling OSRM", async () => {
        vi.stubEnv("DATA_GO_KR_SERVICE_KEY", "test-key");
        const stops = [
            {nodeid: "S1", nodenm: "기점", nodeord: 1, nodeno: "101", gpslati: 37.341, gpslong: 127.912, updowncd: 0},
            {nodeid: "S2", nodenm: "종점", nodeord: 2, nodeno: "102", gpslati: 37.345, gpslong: 127.918, updowncd: 0},
        ];
        const expectedHash = computeStopsHash(stops);

        mockFetchCityRoutes.mockResolvedValueOnce([{routeid: "WJB30", routeno: "30"}]);
        mockFetchRouteStops.mockResolvedValueOnce(stops);
        mockGetJson.mockResolvedValueOnce({
            source: "blob",
            data: {route_id: "WJB30", route_no: "30", stops_hash: expectedHash},
        });

        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const res = await refreshRouteData({cityCode: "32020", mode: "quick"});

        expect(res.success).toBe(true);
        expect(res.skippedUnchanged).toBe(1);
        expect(res.totalRoutesProcessed).toBe(0);
        expect(mockPutJson).not.toHaveBeenCalled();
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });

    it("supports cursor & maxRoutes batching and returns nextCursor when candidates remain", async () => {
        vi.stubEnv("DATA_GO_KR_SERVICE_KEY", "test-key");
        const routes = [
            {routeid: "WJB1", routeno: "1"},
            {routeid: "WJB2", routeno: "2"},
            {routeid: "WJB3", routeno: "3"},
        ];
        const stops = [
            {nodeid: "S1", nodenm: "기점", nodeord: 1, nodeno: "101", gpslati: 37.341, gpslong: 127.912, updowncd: 0},
            {nodeid: "S2", nodenm: "종점", nodeord: 2, nodeno: "102", gpslati: 37.345, gpslong: 127.918, updowncd: 0},
        ];
        const hash = computeStopsHash(stops);

        mockFetchCityRoutes.mockResolvedValueOnce(routes);
        mockFetchRouteStops.mockResolvedValue(stops);
        mockGetJson.mockResolvedValue({source: "blob", data: {stops_hash: hash}});

        const page1 = await refreshRouteData({cityCode: "32020", cursor: 0, maxRoutes: 2});
        expect(page1.success).toBe(true);
        expect(page1.totalCandidates).toBe(3);
        expect(page1.skippedUnchanged).toBe(2);
        expect(page1.nextCursor).toBe(2);
    });
});
