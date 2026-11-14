import {describe, expect, it} from "vitest";
import type {BusStop} from "@entities/station/types";
import {buildBusStopsGeoJson, getBusStopKey} from "./stopLayerUtils";

const makeStop = (overrides: Partial<BusStop> & {nodeid: string; nodenm: string}): BusStop => ({
    nodeno: 1001,
    gpslati: 37.34,
    gpslong: 127.94,
    ...overrides,
});

describe("stopLayerUtils", () => {
    it("builds deduplicated GeoJSON features with priority sortKey (favorite < route < nearby)", () => {
        const routeStop = makeStop({nodeid: "R1", nodenm: "노선정류장", updowncd: 0});
        const favAndRouteStop = makeStop({nodeid: "R2", nodenm: "즐겨찾기노선", updowncd: 1});
        const favOnlyStop = makeStop({nodeid: "F1", nodenm: "즐겨찾기전용"});
        const nearbyDuplicate = makeStop({nodeid: "R1", nodenm: "중복주변"});
        const nearbyOnlyStop = makeStop({nodeid: "N1", nodenm: "주변정류장"});

        const stopColorMap = new Map<string, string>([
            [getBusStopKey(routeStop), "#10b981"],
            ["R2", "#2563eb"],
        ]);

        const {geoJson, stopByKey} = buildBusStopsGeoJson({
            routeStops: [routeStop, favAndRouteStop],
            favoriteStops: [favAndRouteStop, favOnlyStop],
            nearbyStops: [nearbyDuplicate, nearbyOnlyStop],
            showNearbyStops: true,
            stopColorMap,
            routeMainColor: "#059669",
            favoriteNodeIds: new Set(["R2", "F1"]),
        });

        expect(geoJson.features).toHaveLength(4);

        const byId = new Map(geoJson.features.map((f) => [f.properties.nodeid, f.properties]));
        expect(byId.get("R1")).toMatchObject({
            isRouteStop: true,
            isFavorite: false,
            color: "#10b981",
            sortKey: 2,
        });
        expect(byId.get("R2")).toMatchObject({
            isRouteStop: true,
            isFavorite: true,
            color: "#2563eb",
            sortKey: 1,
        });
        expect(byId.get("F1")).toMatchObject({
            isRouteStop: false,
            isFavorite: true,
            color: "#f59e0b",
            sortKey: 1,
        });
        expect(byId.get("N1")).toMatchObject({
            isRouteStop: false,
            isFavorite: false,
            color: "#64748b",
            sortKey: 3,
        });

        expect(stopByKey.get(getBusStopKey(routeStop))?.nodenm).toBe("노선정류장");
        expect(stopByKey.get(getBusStopKey(nearbyOnlyStop))?.nodenm).toBe("주변정류장");
    });

    it("excludes nearby stops when showNearbyStops is false and skips invalid coordinates", () => {
        const validStop = makeStop({nodeid: "R1", nodenm: "유효정류장"});
        const invalidStop = makeStop({nodeid: "BAD", nodenm: "좌표오류", gpslati: Number.NaN});
        const nearbyStop = makeStop({nodeid: "N1", nodenm: "주변정류장"});

        const {geoJson} = buildBusStopsGeoJson({
            routeStops: [validStop, invalidStop],
            favoriteStops: [],
            nearbyStops: [nearbyStop],
            showNearbyStops: false,
            stopColorMap: new Map(),
            routeMainColor: "#059669",
            favoriteNodeIds: new Set(),
        });

        expect(geoJson.features).toHaveLength(1);
        expect(geoJson.features[0].properties.nodeid).toBe("R1");
    });
});
