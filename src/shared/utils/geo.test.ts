import {describe, expect, it} from "vitest";
import {
    calculateBearing,
    type Coordinate,
    getApproxDistanceMeters,
    getHaversineDistance,
    getHaversineDistanceMeters,
    interpolateAngle,
    normalizeAngle,
    snapPointToPolyline,
} from "./geo";

describe("geo utils", () => {
    describe("getHaversineDistance & getHaversineDistanceMeters", () => {
        it("returns 0 distance for identical coordinates", () => {
            const dist = getHaversineDistance(37.3421, 127.9197, 37.3421, 127.9197);
            expect(dist).toBeCloseTo(0, 4);
            expect(getHaversineDistanceMeters([37.3421, 127.9197], [37.3421, 127.9197])).toBeCloseTo(0, 1);
        });

        it("calculates realistic distance between Wonju stations (approx ~4km)", () => {
            // Wonju Station to Wonju City Hall
            const wonjuStation: Coordinate = [37.3182, 127.9392];
            const cityHall: Coordinate = [37.3421, 127.9197];
            const distMeters = getHaversineDistanceMeters(wonjuStation, cityHall);
            expect(distMeters).toBeGreaterThan(2500);
            expect(distMeters).toBeLessThan(4500);
        });
    });

    describe("getApproxDistanceMeters", () => {
        it("closely approximates Haversine distance for small local transit scales", () => {
            const p1: Coordinate = [37.3421, 127.9197];
            const p2: Coordinate = [37.3450, 127.9230];

            const haversine = getHaversineDistanceMeters(p1, p2);
            const approx = getApproxDistanceMeters(p1, p2);

            // Expect within 3% error margin for city bus scales
            const diffRatio = Math.abs(haversine - approx) / haversine;
            expect(diffRatio).toBeLessThan(0.03);
        });
    });

    describe("calculateBearing, normalizeAngle & interpolateAngle", () => {
        it("normalizes negative and >360 degree angles into [0, 360)", () => {
            expect(normalizeAngle(0)).toBe(0);
            expect(normalizeAngle(360)).toBe(0);
            expect(normalizeAngle(-90)).toBe(270);
            expect(normalizeAngle(450)).toBe(90);
        });

        it("calculates cardinal bearings correctly", () => {
            // Due North
            const south: Coordinate = [37.0, 127.0];
            const north: Coordinate = [38.0, 127.0];
            expect(calculateBearing(south, north)).toBeCloseTo(0, 0);

            // Due East
            const west: Coordinate = [37.0, 127.0];
            const east: Coordinate = [37.0, 128.0];
            expect(calculateBearing(west, east)).toBeCloseTo(90, 0);
        });

        it("interpolates angles across the 0/360 degree boundary smoothly", () => {
            // From 350 deg to 10 deg: shortest path is +20 deg clockwise
            const halfway = interpolateAngle(350, 10, 0.5);
            expect(halfway).toBeCloseTo(0, 1);
        });
    });

    describe("snapPointToPolyline", () => {
        const polyline: Coordinate[] = [
            [37.0, 127.0],
            [37.0, 127.1],
            [37.0, 127.2],
        ];

        it("snaps a point directly on the segment to its exact position", () => {
            const point: Coordinate = [37.0, 127.05];
            const snapped = snapPointToPolyline(point, polyline);

            expect(snapped.segmentIndex).toBe(0);
            expect(snapped.t).toBeCloseTo(0.5, 2);
            expect(snapped.position[0]).toBeCloseTo(37.0, 4);
            expect(snapped.position[1]).toBeCloseTo(127.05, 4);
        });

        it("projects an off-line point orthogonally onto the nearest segment", () => {
            const point: Coordinate = [37.01, 127.15]; // North of segment 1
            const snapped = snapPointToPolyline(point, polyline);

            expect(snapped.segmentIndex).toBe(1);
            expect(snapped.position[0]).toBeCloseTo(37.0, 4);
            expect(snapped.position[1]).toBeCloseTo(127.15, 4);
        });
    });
});
