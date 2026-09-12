import {describe, expect, it} from "vitest";
import {
    BRANCH_PALETTE,
    buildSegmentedRouteGeoJson,
    isPointNearPolyline,
    type PolylineData,
    SHARED_BLUE_COLOR,
} from "./polylineService";
import type {Coordinate} from "./types";

describe("polylineService", () => {
    describe("isPointNearPolyline", () => {
        const line: Coordinate[] = [
            [37.3400, 127.9200],
            [37.3500, 127.9200],
        ];

        it("returns true for a point on or close to the line", () => {
            // Point 5 meters away
            const closePoint: Coordinate = [37.3450, 127.92005];
            expect(isPointNearPolyline(closePoint, line, 30)).toBe(true);
        });

        it("returns false for a point far away from the line", () => {
            const farPoint: Coordinate = [37.3450, 127.9300];
            expect(isPointNearPolyline(farPoint, line, 30)).toBe(false);
        });

        it("handles empty or single-point polylines safely", () => {
            expect(isPointNearPolyline([37.34, 127.92], [])).toBe(false);
            expect(isPointNearPolyline([37.34, 127.92], [[37.34, 127.92]])).toBe(false);
        });
    });

    describe("buildSegmentedRouteGeoJson", () => {
        it("returns null for empty route IDs", () => {
            const map = new Map<string, PolylineData>();
            expect(buildSegmentedRouteGeoJson([], map)).toBeNull();
        });

        it("emits single route with SHARED_BLUE_COLOR for up and down", () => {
            const map = new Map<string, PolylineData>([
                [
                    "ROUTE_1",
                    {
                        upPolyline: [
                            [37.34, 127.92],
                            [37.35, 127.92],
                        ],
                        downPolyline: [
                            [37.35, 127.92],
                            [37.34, 127.92],
                        ],
                    },
                ],
            ]);

            const geoJson = buildSegmentedRouteGeoJson(["ROUTE_1"], map);
            expect(geoJson).not.toBeNull();
            expect(geoJson?.features.length).toBe(2);
            expect(geoJson?.features[0].properties?.color).toBe(SHARED_BLUE_COLOR);
            expect(geoJson?.features[0].properties?.direction).toBe("up");
            expect(geoJson?.features[1].properties?.direction).toBe("down");
        });

        it("emits shared segments once and branches with distinct colors for multi-routes", () => {
            // Shared section: [37.30, 127.90] -> [37.35, 127.90]
            // Branch A: [37.35, 127.90] -> [37.40, 127.90]
            // Branch B: [37.35, 127.90] -> [37.35, 127.95]
            const map = new Map<string, PolylineData>([
                [
                    "ROUTE_A",
                    {
                        upPolyline: [
                            [37.30, 127.90],
                            [37.35, 127.90],
                            [37.40, 127.90],
                        ],
                        downPolyline: [],
                    },
                ],
                [
                    "ROUTE_B",
                    {
                        upPolyline: [
                            [37.30, 127.90],
                            [37.35, 127.90],
                            [37.35, 127.95],
                        ],
                        downPolyline: [],
                    },
                ],
            ]);

            const geoJson = buildSegmentedRouteGeoJson(["ROUTE_A", "ROUTE_B"], map);
            expect(geoJson).not.toBeNull();

            // Features should contain:
            // 1. Shared segment in SHARED_BLUE_COLOR (from ROUTE_A)
            // 2. Branch of ROUTE_A
            // 3. Branch of ROUTE_B in BRANCH_PALETTE[0]
            const colors = geoJson?.features.map((f) => f.properties?.color);
            expect(colors).toContain(SHARED_BLUE_COLOR);
            expect(colors).toContain(BRANCH_PALETTE[0]);

            // Ensure the shared segment is not duplicated
            const sharedFeatures = geoJson?.features.filter((f) => f.properties?.is_shared === true);
            expect(sharedFeatures?.length).toBe(1);
        });
    });
});
