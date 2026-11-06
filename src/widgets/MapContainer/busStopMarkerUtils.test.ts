import {describe, expect, it} from "vitest";
import {
    calculateDistanceMeters,
    computeOptimalLabelPlacements,
    doRectanglesOverlap,
    findPairedOppositeStop,
    getLabelRect,
    normalizeStopName,
    scoreDirectionPlacement,
} from "./busStopMarkerUtils";
import type {BusStop} from "@entities/station/types";

describe("busStopMarkerUtils", () => {
    describe("normalizeStopName", () => {
        it("strips parenthesis and terminal suffixes correctly", () => {
            expect(normalizeStopName("원주의료원(시내방면)")).toBe("원주의료원");
            expect(normalizeStopName("연세대 미래캠퍼스 승강장")).toBe("연세대 미래캠퍼스");
            expect(normalizeStopName("관설동 종점")).toBe("관설동");
            expect(normalizeStopName("장양리 회차지")).toBe("장양리");
            expect(normalizeStopName("원주역")).toBe("원주역");
        });
    });

    describe("calculateDistanceMeters", () => {
        it("calculates distance between two close points accurately", () => {
            // Approx 0.0003 deg latitude ≈ 33.3 meters
            const dist = calculateDistanceMeters(37.3400, 127.9200, 37.3403, 127.9200);
            expect(dist).toBeGreaterThan(30);
            expect(dist).toBeLessThan(36);
        });
    });

    describe("findPairedOppositeStop", () => {
        it("matches opposite stop with identical name across the road", () => {
            const stopA: BusStop = {
                nodeid: "STOP_A",
                nodenm: "원주의료원",
                nodeno: "41258",
                gpslati: 37.3400,
                gpslong: 127.9200,
                updowncd: 0,
            };
            const stopB: BusStop = {
                nodeid: "STOP_B",
                nodenm: "원주의료원",
                nodeno: "41259",
                gpslati: 37.3402,
                gpslong: 127.9203, // ~35m away
                updowncd: 1,
            };
            const stopC: BusStop = {
                nodeid: "STOP_C",
                nodenm: "원주역",
                nodeno: "41200",
                gpslati: 37.3600,
                gpslong: 127.9400,
                updowncd: 0,
            };

            const matched = findPairedOppositeStop(stopA, [stopA, stopB, stopC]);
            expect(matched).not.toBeNull();
            expect(matched?.nodeid).toBe("STOP_B");
        });

        it("matches opposite stop with opposing updowncd if within range", () => {
            const stopA: BusStop = {
                nodeid: "STOP_1",
                nodenm: "시청앞",
                nodeno: "101",
                gpslati: 37.3400,
                gpslong: 127.9200,
                updowncd: 0,
            };
            const stopB: BusStop = {
                nodeid: "STOP_2",
                nodenm: "시청앞(건너편)",
                nodeno: "102",
                gpslati: 37.3401,
                gpslong: 127.9202,
                updowncd: 1,
            };

            const matched = findPairedOppositeStop(stopA, [stopA, stopB]);
            expect(matched?.nodeid).toBe("STOP_2");
        });

        it("returns null when no stop is within distance threshold", () => {
            const stopA: BusStop = {
                nodeid: "STOP_1",
                nodenm: "정류장A",
                nodeno: "1",
                gpslati: 37.34,
                gpslong: 127.92,
            };
            const stopFar: BusStop = {
                nodeid: "STOP_2",
                nodenm: "정류장A",
                nodeno: "2",
                gpslati: 37.40,
                gpslong: 127.99,
            };

            expect(findPairedOppositeStop(stopA, [stopA, stopFar])).toBeNull();
        });
    });

    describe("doRectanglesOverlap & getLabelRect", () => {
        it("detects overlap between two intersecting bounding boxes", () => {
            const rect1 = getLabelRect({x: 100, y: 100}, "right");
            const rect2 = getLabelRect({x: 140, y: 100}, "right");
            expect(doRectanglesOverlap(rect1, rect2)).toBe(true);
        });

        it("detects no overlap when boxes are facing opposite directions", () => {
            // Stop A at x=100 facing left, Stop B at x=135 facing right
            const rectA = getLabelRect({x: 100, y: 100}, "left");
            const rectB = getLabelRect({x: 135, y: 100}, "right");

            expect(doRectanglesOverlap(rectA, rectB)).toBe(false);
            expect(rectA.right).toBeLessThan(rectB.left);
        });
    });

    describe("scoreDirectionPlacement", () => {
        it("penalizes 'right' heavily when a neighbor pin is 35px to the right", () => {
            const ptA = {x: 100, y: 100};
            const neighbors = [{pt: {x: 135, y: 102}, dist: 35.05}];

            const scoreRight = scoreDirectionPlacement(ptA, "right", neighbors);
            const scoreLeft = scoreDirectionPlacement(ptA, "left", neighbors);

            // Left should be heavily preferred over Right because Right covers the neighbor pin
            expect(scoreRight).toBeGreaterThan(scoreLeft);
            expect(scoreLeft).toBeLessThan(10);
        });

        it("penalizes 'left' heavily when a neighbor pin is 35px to the left", () => {
            const ptB = {x: 135, y: 100};
            const neighbors = [{pt: {x: 100, y: 98}, dist: 35.05}];

            const scoreRight = scoreDirectionPlacement(ptB, "right", neighbors);
            const scoreLeft = scoreDirectionPlacement(ptB, "left", neighbors);

            // Right should be heavily preferred over Left
            expect(scoreLeft).toBeGreaterThan(scoreRight);
            expect(scoreRight).toBeLessThan(10);
        });
    });

    describe("computeOptimalLabelPlacements", () => {
        it("places opposite stops facing outward so labels and pins never overlap", () => {
            const stopWest: BusStop = {
                nodeid: "STOP_WEST",
                nodenm: "원주의료원",
                nodeno: "41258",
                gpslati: 37.3400,
                gpslong: 127.9200,
                updowncd: 0,
            };
            const stopEast: BusStop = {
                nodeid: "STOP_EAST",
                nodenm: "원주의료원",
                nodeno: "41259",
                gpslati: 37.3400,
                gpslong: 127.9205, // to the east
                updowncd: 1,
            };

            const mockMap = {
                project: (lnglat: [number, number]) => {
                    if (lnglat[0] === stopWest.gpslong) return {x: 100, y: 200};
                    if (lnglat[0] === stopEast.gpslong) return {x: 140, y: 200};
                    return {x: 0, y: 0};
                },
            };

            const placements = computeOptimalLabelPlacements(
                [
                    {...stopWest, isRouteStop: true, showLabel: true},
                    {...stopEast, isRouteStop: true, showLabel: true},
                ],
                mockMap
            );

            const westPlacement = placements.get(stopWest.nodeid);
            const eastPlacement = placements.get(stopEast.nodeid);

            expect(westPlacement?.placement).toBe("left");
            expect(eastPlacement?.placement).toBe("right");

            // Both labels should remain visible because facing outward avoids collision
            expect(westPlacement?.showLabel).toBe(true);
            expect(eastPlacement?.showLabel).toBe(true);

            // Disambiguation label should be set for duplicate names
            expect(westPlacement?.disambiguationLabel).toBe("41258");
            expect(eastPlacement?.disambiguationLabel).toBe("41259");

            // Paired opposite stop should be linked
            expect(westPlacement?.pairedOppositeStop?.nodeid).toBe("STOP_EAST");
            expect(eastPlacement?.pairedOppositeStop?.nodeid).toBe("STOP_WEST");
        });

        it("defaults isolated stops to 'right' placement", () => {
            const stopA: BusStop = {
                nodeid: "STOP_ISOLATED",
                nodenm: "외딴 정류장",
                nodeno: "1001",
                gpslati: 37.3000,
                gpslong: 127.9000,
            };

            const placements = computeOptimalLabelPlacements([stopA], null);
            const res = placements.get(stopA.nodeid);
            expect(res?.placement).toBe("right");
            expect(res?.showLabel).toBe(true);
        });
    });
});
