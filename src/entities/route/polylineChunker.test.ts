import {describe, expect, it} from "vitest";
import {
    calculatePolylineMeters,
    chunkCoordinates,
    type Coordinate,
    haversineMeters,
    interpolateCatmullRom,
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
});
