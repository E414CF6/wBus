import {describe, expect, it} from "vitest";
import {
    filterValidItems,
    OsrmRouteResponseSchema,
    RouteDatasetSchema,
    TagoBusLocationSchema,
    TagoCityRouteSchema,
    TagoNearbyStopSchema,
    TimetableEntrySchema,
} from "./schemas";

describe("runtime API schemas", () => {
    it("coerces string coordinates and drops invalid TAGO bus location rows", () => {
        const raw = [
            {
                routeid: "WJB251000030",
                routenm: 30,
                gpslati: "37.3421",
                gpslong: "127.9198",
                vehicleno: "강원70자1234",
                nodeord: "5",
            },
            {
                // Invalid: 0 lat/lon should be rejected
                routeid: "WJB251000030",
                routenm: "30",
                gpslati: 0,
                gpslong: 0,
                vehicleno: "강원70자0000",
            },
            {
                // Invalid: missing vehicleno
                routeid: "WJB251000030",
                routenm: "30",
                gpslati: 37.35,
                gpslong: 127.92,
                vehicleno: "",
            },
        ];

        const valid = filterValidItems(raw, TagoBusLocationSchema);
        expect(valid).toHaveLength(1);
        expect(valid[0].routenm).toBe("30");
        expect(valid[0].gpslati).toBeCloseTo(37.3421);
        expect(valid[0].nodeord).toBe(5);
    });

    it("normalizes TagoCityRouteSchema string fields and skips missing routeid", () => {
        const valid = filterValidItems(
            [
                {routeid: "WJB251000030", routeno: 30, routetp: "일반버스"},
                {routeid: "", routeno: "34"},
            ],
            TagoCityRouteSchema
        );
        expect(valid).toHaveLength(1);
        expect(valid[0].routeno).toBe("30");
    });

    it("validates OSRM route geometry and RouteDataset envelopes", () => {
        const osrm = OsrmRouteResponseSchema.safeParse({
            code: "Ok",
            routes: [{geometry: {coordinates: [[127.91, 37.34], [127.92, 37.35]]}}],
        });
        expect(osrm.success).toBe(true);

        const dataset = RouteDatasetSchema.safeParse({
            updatedAt: "2026-11-13T00:00:00.000Z",
            sourceUrl: "http://its.wonju.go.kr/bus/bus04.do",
            totalRoutes: 1,
            routes: [{id: "1", rawNo: "30", routeNo: "30", timetable: []}],
        });
        expect(dataset.success).toBe(true);
    });

    it("filters invalid nearby stops and coerces timetable entry fields", () => {
        const stops = filterValidItems(
            [
                {nodeid: "WJB1001", nodenm: "연세대정문", gpslati: "37.28", gpslong: "127.90", citycode: 32020},
                {nodeid: "", nodenm: "Missing ID", gpslati: 37.28, gpslong: 127.90},
                {nodeid: "WJB1002", nodenm: "Zero coords", gpslati: 0, gpslong: 0},
            ],
            TagoNearbyStopSchema
        );
        expect(stops).toHaveLength(1);
        expect(stops[0].gpslati).toBeCloseTo(37.28);

        const row = TimetableEntrySchema.safeParse({
            seq: "3",
            originDepTime: "07:10",
            destDepTime: "07:55",
            type: null,
            notes: undefined,
        });
        expect(row.success).toBe(true);
        if (row.success) {
            expect(row.data.seq).toBe(3);
            expect(row.data.type).toBe("");
        }
    });
});
