import {describe, expect, it} from "vitest";
import {
    calculatePolylineMeters,
    chunkCoordinates,
    connectTurningPoint,
    type Coordinate,
    findTurningDirection,
    haversineMeters,
    isExcessiveDetour,
    smoothPolylineSpline,
    stitchPolylineSegments,
} from "./polylineChunker";

describe("polylineChunker", () => {
    describe("haversineMeters & calculatePolylineMeters", () => {
        it("calculates accurate distance between coordinates", () => {
            const p1: Coordinate = [127.9200, 37.3400];
            const p2: Coordinate = [127.9200, 37.3500]; // ~1.11km north
            const dist = haversineMeters(p1, p2);
            expect(dist).toBeGreaterThan(1000);
            expect(dist).toBeLessThan(1200);

            const total = calculatePolylineMeters([p1, p2]);
            expect(total).toBeCloseTo(dist, 1);
        });

        it("returns 0 for empty or single coordinate", () => {
            expect(calculatePolylineMeters([])).toBe(0);
            expect(calculatePolylineMeters([[127.92, 37.34]])).toBe(0);
        });
    });

    describe("chunkCoordinates", () => {
        it("returns single chunk when array is small", () => {
            const coords: Coordinate[] = [
                [127.91, 37.31],
                [127.92, 37.32],
                [127.93, 37.33],
            ];
            const chunks = chunkCoordinates(coords, 5);
            expect(chunks.length).toBe(1);
            expect(chunks[0]).toEqual(coords);
        });

        it("creates overlapping chunks with junction points preserved", () => {
            const coords: Coordinate[] = Array.from({length: 45}, (_, i) => [
                127.90 + i * 0.001,
                37.30 + i * 0.001,
            ]);

            const chunkSize = 15;
            const chunks = chunkCoordinates(coords, chunkSize);

            expect(chunks.length).toBeGreaterThan(1);
            // Verify overlap between chunk[0] end and chunk[1] start
            expect(chunks[0][chunks[0].length - 1]).toEqual(chunks[1][0]);
            expect(chunks[1][chunks[1].length - 1]).toEqual(chunks[2][0]);
            // Verify final coordinate matches original final
            expect(chunks[chunks.length - 1][chunks[chunks.length - 1].length - 1]).toEqual(coords[coords.length - 1]);
        });
    });

    describe("stitchPolylineSegments", () => {
        it("stitches segments without duplicate junction coordinates", () => {
            const seg1: Coordinate[] = [
                [127.90, 37.30],
                [127.91, 37.31],
                [127.92, 37.32],
            ];
            const seg2: Coordinate[] = [
                [127.92, 37.32], // Junction duplicate
                [127.93, 37.33],
                [127.94, 37.34],
            ];

            const stitched = stitchPolylineSegments([seg1, seg2]);
            expect(stitched.length).toBe(5); // 3 + 3 - 1 duplicate = 5
            expect(stitched[0]).toEqual([127.90, 37.30]);
            expect(stitched[2]).toEqual([127.92, 37.32]);
            expect(stitched[4]).toEqual([127.94, 37.34]);
        });

        it("handles empty or single segment gracefully", () => {
            expect(stitchPolylineSegments([])).toEqual([]);
            const single: Coordinate[] = [[127.9, 37.3]];
            expect(stitchPolylineSegments([single])).toEqual(single);
        });
    });

    describe("smoothPolylineSpline", () => {
        it("returns original when coordinates count < 3", () => {
            const coords: Coordinate[] = [
                [127.90, 37.30],
                [127.91, 37.31],
            ];
            expect(smoothPolylineSpline(coords)).toEqual(coords);
        });

        it("interpolates smooth curve preserving start and end points", () => {
            const coords: Coordinate[] = [
                [127.90, 37.30],
                [127.92, 37.32],
                [127.94, 37.31],
                [127.96, 37.35],
            ];
            const smoothed = smoothPolylineSpline(coords, 4);

            expect(smoothed.length).toBeGreaterThan(coords.length);
            expect(smoothed[0]).toEqual(coords[0]);
            expect(smoothed[smoothed.length - 1]).toEqual(coords[coords.length - 1]);

            // Ensure no NaN coordinates produced
            for (const [lng, lat] of smoothed) {
                expect(Number.isFinite(lng)).toBe(true);
                expect(Number.isFinite(lat)).toBe(true);
            }
        });
    });

    describe("isExcessiveDetour", () => {
        it("returns false for reasonable road bends", () => {
            // 1km straight vs 1.3km road curve
            expect(isExcessiveDetour(1000, 1300)).toBe(false);
        });

        it("returns true for car-only loop detours exceeding threshold and absolute excess", () => {
            // 500m straight vs 3500m detour around highway interchange
            expect(isExcessiveDetour(500, 3500)).toBe(true);
        });

        it("returns false if excess meters is small even if ratio is slightly high", () => {
            // 50m straight vs 150m around a roundabout (excess is 100m, less than absolute excess 1200m)
            expect(isExcessiveDetour(50, 150)).toBe(false);
        });
    });

    describe("findTurningDirection", () => {
        it("detects transition from DOWN (0) to UP (1)", () => {
            const stops = [
                {nodeord: 1, updowncd: 0},
                {nodeord: 2, updowncd: 0},
                {nodeord: 3, updowncd: 1},
                {nodeord: 4, updowncd: 1},
            ];
            expect(findTurningDirection(stops)).toBe("down_to_up");
        });

        it("detects transition from UP (1) to DOWN (0)", () => {
            const stops = [
                {ord: 1, ud: 1},
                {ord: 2, ud: 1},
                {ord: 3, ud: 0},
            ];
            expect(findTurningDirection(stops)).toBe("up_to_down");
        });

        it("returns null for circular or single direction routes", () => {
            const stops = [
                {nodeord: 1, updowncd: 0},
                {nodeord: 2, updowncd: 0},
            ];
            expect(findTurningDirection(stops)).toBeNull();
        });
    });

    describe("connectTurningPoint", () => {
        it("bridges the gap and includes the turning segment in UP polyline for down_to_up", async () => {
            // Down leg: (0, 0) -> (10, 0)
            const downPoly: Coordinate[] = [
                [127.9000, 37.3000],
                [127.9100, 37.3100],
            ];
            // Up leg: starts at (127.9105, 37.3105) (gap of ~60m from downLast)
            const upPoly: Coordinate[] = [
                [127.9105, 37.3105],
                [127.9200, 37.3200],
            ];

            // Simulated OSRM connector returns a U-turn arc
            const mockConnector = async (pair: [Coordinate, Coordinate]): Promise<Coordinate[]> => {
                const mid: Coordinate = [(pair[0][0] + pair[1][0]) / 2 + 0.0001, (pair[0][1] + pair[1][1]) / 2];
                return [pair[0], mid, pair[1]];
            };

            const result = await connectTurningPoint(upPoly, downPoly, "down_to_up", mockConnector);

            // DOWN polyline must remain intact up to turning point
            expect(result.downPolyline).toEqual(downPoly);

            // UP polyline must now start at downLast, contain connector path, and then original up points
            expect(result.upPolyline[0]).toEqual(downPoly[downPoly.length - 1]);
            // Check that intermediate point from connector is included
            expect(result.upPolyline.length).toBe(4);
            // End of UP polyline should be original end
            expect(result.upPolyline[result.upPolyline.length - 1]).toEqual([127.9200, 37.3200]);
        });

        it("bridges the gap and includes the turning segment in DOWN polyline for up_to_down", async () => {
            const upPoly: Coordinate[] = [
                [127.9000, 37.3000],
                [127.9100, 37.3100],
            ];
            const downPoly: Coordinate[] = [
                [127.9105, 37.3105],
                [127.9200, 37.3200],
            ];

            const mockConnector = async (pair: [Coordinate, Coordinate]): Promise<Coordinate[]> => [pair[0], pair[1]];

            const result = await connectTurningPoint(upPoly, downPoly, "up_to_down", mockConnector);

            expect(result.upPolyline).toEqual(upPoly);
            expect(result.downPolyline[0]).toEqual(upPoly[upPoly.length - 1]);
            expect(result.downPolyline[result.downPolyline.length - 1]).toEqual([127.9200, 37.3200]);
        });
    });
});

