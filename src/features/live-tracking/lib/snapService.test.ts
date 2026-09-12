import {describe, expect, it} from "vitest";
import {getSegmentBounds, getSnappedPosition, getStopCoordIndex} from "./snapService";
import type {StopIndexMap} from "@entities/route/polylineService";
import type {BusItem} from "@entities/bus/types";
import type {Coordinate} from "@entities/route/types";

describe("snapService", () => {
    describe("getStopCoordIndex", () => {
        const mockStopIndexMap: StopIndexMap = {
            byId: {"stop-1": 10, "stop-2": 20},
            byIdDir: {"stop-1-1": 11, "stop-2-0": 21},
            byOrd: {"1": 100, "2": 200},
            byOrdDir: {"1-1": 101, "2-0": 201},
        };

        it("returns null when stopIndexMap is null or undefined", () => {
            expect(getStopCoordIndex(null, "stop-1", 1, 1)).toBeNull();
            expect(getStopCoordIndex(undefined, "stop-1", 1, 1)).toBeNull();
        });

        it("prioritizes byIdDir when direction is specified", () => {
            expect(getStopCoordIndex(mockStopIndexMap, "stop-1", 1, 1)).toBe(11);
            expect(getStopCoordIndex(mockStopIndexMap, "stop-2", 2, 0)).toBe(21);
        });

        it("falls back to byOrdDir when byIdDir does not match", () => {
            expect(getStopCoordIndex(mockStopIndexMap, "stop-unknown", 1, 1)).toBe(101);
            expect(getStopCoordIndex(mockStopIndexMap, null, 2, 0)).toBe(201);
        });

        it("falls back to byId when direction is null or not found in directional maps", () => {
            expect(getStopCoordIndex(mockStopIndexMap, "stop-1", 99, null)).toBe(10);
            expect(getStopCoordIndex(mockStopIndexMap, "stop-2", 99, 1)).toBe(20);
        });

        it("falls back to byOrd when id is missing or not found", () => {
            expect(getStopCoordIndex(mockStopIndexMap, "unknown", 1, null)).toBe(100);
            expect(getStopCoordIndex(mockStopIndexMap, "", 2, 1)).toBe(200);
        });

        it("returns null when no matching entry is found", () => {
            expect(getStopCoordIndex(mockStopIndexMap, "nonexistent", 999, 1)).toBeNull();
        });
    });

    describe("getSegmentBounds", () => {
        it("returns null bounds when stopIndexMap is null", () => {
            const bounds = getSegmentBounds(null, 5, 1, 50);
            expect(bounds).toEqual({minIdx: null, maxIdx: null});
        });

        it("computes min and max indices around nodeord with 5-segment buffer", () => {
            const stopIndexMap: StopIndexMap = {
                byId: {},
                byIdDir: {},
                byOrd: {},
                byOrdDir: {
                    "3-1": 20,
                    "4-1": 30,
                    "5-1": 40,
                    "6-1": 50,
                    "7-1": 60,
                },
            };

            // nodeord = 5, searches nodeord - 2 (3) to nodeord + 2 (7)
            // minIdx = 20 - 5 = 15, maxIdx = 60 + 5 = 65
            const bounds = getSegmentBounds(stopIndexMap, 5, 1, 100);
            expect(bounds.minIdx).toBe(15);
            expect(bounds.maxIdx).toBe(65);
        });

        it("clamps minIdx to 0 and maxIdx to lineLength - 2", () => {
            const stopIndexMap: StopIndexMap = {
                byId: {},
                byIdDir: {},
                byOrd: {},
                byOrdDir: {
                    "1-1": 2, // 2 - 5 = -3 -> clamped to 0
                    "2-1": 48, // 48 + 5 = 53 -> clamped to 50 - 2 = 48
                },
            };

            const bounds = getSegmentBounds(stopIndexMap, 2, 1, 50);
            expect(bounds.minIdx).toBe(0);
            expect(bounds.maxIdx).toBe(48);
        });
    });

    describe("getSnappedPosition", () => {
        const dummyBus: BusItem = {
            routeid: "route-1",
            routenm: "34-1",
            vehicleno: "1234",
            gpslati: 37.3401,
            gpslong: 127.9201,
            nodeid: "stop-1",
            nodeord: 1,
        };

        // Two points along latitude 37.34, longitude 127.92
        const upLine: Coordinate[] = [
            [37.3400, 127.9200],
            [37.3410, 127.9200],
            [37.3420, 127.9200],
        ];

        // Down line slightly shifted in longitude
        const downLine: Coordinate[] = [
            [37.3420, 127.9250],
            [37.3410, 127.9250],
            [37.3400, 127.9250],
        ];

        it("returns raw coordinates when polylines have fewer than 2 points", () => {
            const result = getSnappedPosition(dummyBus, () => 1, [], []);
            expect(result.position).toEqual([dummyBus.gpslati, dummyBus.gpslong]);
            expect(result.direction).toBe(1);
            expect(result.segmentIndex).toBeNull();
        });

        it("snaps to upLine when apiDirection is 1 and point is close", () => {
            const result = getSnappedPosition(dummyBus, () => 1, upLine, downLine);
            expect(result.direction).toBe(1);
            expect(result.position[1]).toBeCloseTo(127.9200, 3);
            expect(result.segmentIndex).not.toBeNull();
        });

        it("snaps to downLine when apiDirection is 0 and point is close to down line", () => {
            const busNearDown: BusItem = {
                ...dummyBus,
                gpslati: 37.3411,
                gpslong: 127.9251,
            };
            const result = getSnappedPosition(busNearDown, () => 0, upLine, downLine);
            expect(result.direction).toBe(0);
            expect(result.position[1]).toBeCloseTo(127.9250, 3);
        });

        it("picks candidate with shorter distance when apiDirection is null/unspecified", () => {
            const result = getSnappedPosition(dummyBus, () => null, upLine, downLine);
            expect(result.direction).toBe(1);
            expect(result.position[1]).toBeCloseTo(127.9200, 3);
        });

        it("falls back to default raw position when distance exceeds MAX_SNAP_DISTANCE_METERS", () => {
            const farAwayBus: BusItem = {
                ...dummyBus,
                gpslati: 38.0000,
                gpslong: 128.0000,
            };
            const result = getSnappedPosition(farAwayBus, () => 1, upLine, downLine);
            expect(result.position).toEqual([farAwayBus.gpslati, farAwayBus.gpslong]);
            expect(result.segmentIndex).toBeNull();
        });
    });
});
