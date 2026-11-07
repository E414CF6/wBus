import {describe, expect, it} from "vitest";
import type {Feature} from "geojson";
import {findNearestFeatureColor, getDistanceToSegmentMeters} from "./markerGeometry";

describe("markerGeometry helpers", () => {
    describe("getDistanceToSegmentMeters", () => {
        it("returns distance when point lies on segment", () => {
            const dist = getDistanceToSegmentMeters([37.0, 127.0], [37.0, 126.9], [37.0, 127.1]);
            expect(dist).toBeCloseTo(0, 1);
        });

        it("returns distance to perpendicular point", () => {
            // Point offset northward by ~1110m (0.01 deg)
            const dist = getDistanceToSegmentMeters([37.01, 127.0], [37.0, 126.9], [37.0, 127.1]);
            expect(dist).toBeGreaterThan(1000);
            expect(dist).toBeLessThan(1200);
        });

        it("handles zero-length segment", () => {
            const dist = getDistanceToSegmentMeters([37.01, 127.0], [37.0, 127.0], [37.0, 127.0]);
            expect(dist).toBeGreaterThan(1000);
        });
    });

    describe("findNearestFeatureColor", () => {
        const features: Feature[] = [
            {
                type: "Feature",
                properties: {color: "#ff0000"},
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [127.0, 37.0],
                        [127.01, 37.0],
                    ],
                },
            },
            {
                type: "Feature",
                properties: {color: "#00ff00"},
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [128.0, 38.0],
                        [128.01, 38.0],
                    ],
                },
            },
        ];

        it("matches the closest feature color", () => {
            const color = findNearestFeatureColor(37.0001, 127.0001, features, "#0000ff");
            expect(color).toBe("#ff0000");
        });

        it("returns fallback color when features list is empty", () => {
            const color = findNearestFeatureColor(37.0, 127.0, [], "#fallback");
            expect(color).toBe("#fallback");
        });
    });
});
