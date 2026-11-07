import {describe, expect, it} from "vitest";
import type {BusItem} from "@entities/bus/types";
import type {RouteVariationStop} from "@entities/route/types";
import {matchSingleBusToStop} from "./useBusStopMatcher";

describe("useBusStopMatcher pure logic", () => {
    const mockStops: RouteVariationStop[] = [
        {
            nodeid: "STOP1",
            nodenm: "원주역",
            nodeno: "10001",
            nodeord: 1,
            gpslati: 37.35,
            gpslong: 127.95,
            updowncd: 0,
        },
        {
            nodeid: "STOP2",
            nodenm: "중앙시장",
            nodeno: "10002",
            nodeord: 2,
            gpslati: 37.36,
            gpslong: 127.96,
            updowncd: 0,
        },
        {
            nodeid: "STOP1",
            nodenm: "원주역(건너편)",
            nodeno: "10003",
            nodeord: 10,
            gpslati: 37.3501,
            gpslong: 127.9501,
            updowncd: 1,
        },
    ];

    it("returns null when stops array is empty", () => {
        const bus: BusItem = {
            routenm: "30",
            vehicleno: "1001",
            nodeid: "STOP1",
            nodeord: 1,
            gpslati: 37.35,
            gpslong: 127.95,
        };
        expect(matchSingleBusToStop(bus, [])).toBeNull();
    });

    it("matches exact nodeid and nodeord", () => {
        const bus: BusItem = {
            routenm: "30",
            vehicleno: "1001",
            nodeid: "STOP1",
            nodeord: 1,
            gpslati: 37.35,
            gpslong: 127.95,
        };
        const matched = matchSingleBusToStop(bus, mockStops);
        expect(matched).not.toBeNull();
        expect(matched?.nodeord).toBe(1);
    });

    it("disambiguates duplicate nodeids using getDirection", () => {
        const bus: BusItem = {
            routenm: "30",
            vehicleno: "1002",
            nodeid: "STOP1",
            nodeord: undefined,
            gpslati: 37.35,
            gpslong: 127.95,
        };
        // Direction 1 => updowncd 1
        const matched = matchSingleBusToStop(bus, mockStops, () => 1);
        expect(matched?.nodeord).toBe(10);
    });

    it("falls back to matching by nodeord if nodeid does not match", () => {
        const bus: BusItem = {
            routenm: "30",
            vehicleno: "1003",
            nodeid: "UNKNOWN_ID",
            nodeord: 2,
            gpslati: 37.36,
            gpslong: 127.96,
        };
        const matched = matchSingleBusToStop(bus, mockStops);
        expect(matched?.nodenm).toBe("중앙시장");
    });

    it("falls back to stop name matching", () => {
        const bus: BusItem = {
            routenm: "30",
            vehicleno: "1004",
            nodeid: undefined,
            nodeord: undefined,
            nodenm: "중앙시장",
            gpslati: 37.36,
            gpslong: 127.96,
        };
        const matched = matchSingleBusToStop(bus, mockStops);
        expect(matched?.nodeid).toBe("STOP2");
    });

    it("falls back to spatial proximity within 500m", () => {
        const bus: BusItem = {
            routenm: "30",
            vehicleno: "1005",
            nodeid: undefined,
            nodeord: undefined,
            nodenm: undefined,
            gpslati: 37.3601, // extremely close to 중앙시장 (37.36, 127.96)
            gpslong: 127.9601,
        };
        const matched = matchSingleBusToStop(bus, mockStops);
        expect(matched?.nodeid).toBe("STOP2");
    });
});
