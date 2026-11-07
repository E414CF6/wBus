import {describe, expect, it} from "vitest";
import type {RouteVariationStop} from "@entities/route/types";
import {filterStops} from "./useStopSearchFilter";

describe("filterStops pure logic", () => {
    const mockStops: RouteVariationStop[] = [
        {
            nodeid: "1",
            nodenm: "시청앞",
            nodeno: "10001",
            nodeord: 1,
            gpslati: 37,
            gpslong: 127,
            updowncd: 0,
        },
        {
            nodeid: "2",
            nodenm: "법원앞",
            nodeno: "10002",
            nodeord: 2,
            gpslati: 37,
            gpslong: 127,
            updowncd: 1,
        },
        {
            nodeid: "3",
            nodenm: "원주역",
            nodeno: "10003",
            nodeord: 3,
            gpslati: 37,
            gpslong: 127,
            updowncd: 0,
        },
    ];

    it("filters by direction 'up' (updowncd === 0)", () => {
        const filtered = filterStops(mockStops, "up", true, "", () => false);
        expect(filtered.map((s) => s.nodeid)).toEqual(["1", "3"]);
    });

    it("filters by direction 'down' (updowncd === 1)", () => {
        const filtered = filterStops(mockStops, "down", true, "", () => false);
        expect(filtered.map((s) => s.nodeid)).toEqual(["2"]);
    });

    it("filters by search query matching nodenm", () => {
        const filtered = filterStops(mockStops, "all", true, "법원", () => false);
        expect(filtered.map((s) => s.nodeid)).toEqual(["2"]);
    });

    it("filters by search query matching nodeno", () => {
        const filtered = filterStops(mockStops, "all", true, "10003", () => false);
        expect(filtered.map((s) => s.nodeid)).toEqual(["3"]);
    });

    it("filters by favorite stops only", () => {
        const isFav = (id: string) => id === "2" || id === "3";
        const filtered = filterStops(mockStops, "fav", true, "", isFav);
        expect(filtered.map((s) => s.nodeid)).toEqual(["2", "3"]);
    });
});
