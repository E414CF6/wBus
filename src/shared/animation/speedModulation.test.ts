import {describe, expect, it} from "vitest";
import {blendVelocityWithPrior, getStopSpeedMultiplier} from "./speedModulation";
import {
    CITY_BUS_BASE_VELOCITY,
    DEFAULT_DATA_DELAY_MS,
    MAX_VELOCITY,
    MIN_MOVING_VELOCITY,
    PHYSICAL_BUS_DELAY_MS,
    POST_TARGET_VELOCITY_RATIO,
    STATIONARY_CONFIRM_MS,
    STATIONARY_COORD_THRESHOLD,
    STOP_DWELL_PROXIMITY,
} from "./constants";
import {computeCumulativeDistances, polylineScalarDist, positionFromSegT, scalarToSegT,} from "./scalarGeometry";
import type {Coordinate} from "@shared/utils/geo";

describe("animation / predictive dead-reckoning engine", () => {
    describe("constants validation calibrated from origin API empirical test", () => {
        it("has valid stationary confirmation time greater than upstream batch cycle", () => {
            // TAGO upstream batch interval is 10-15s, so confirmation must be >= 20s
            expect(STATIONARY_CONFIRM_MS).toBeGreaterThanOrEqual(20000);
        });

        it("has physical bus pipeline delay calibrated from real transit measurement", () => {
            // User measured 3-4s physical delay on actual bus ride
            expect(PHYSICAL_BUS_DELAY_MS).toBeGreaterThanOrEqual(3000);
            expect(PHYSICAL_BUS_DELAY_MS).toBeLessThanOrEqual(4000);
        });

        it("has stationary threshold that filters GPS jitter (~0.8m) while capturing micro-crawls (>10m)", () => {
            // Jitter: 0.8m / 111000 ≈ 0.0000072 < threshold
            // Micro-crawl: 13.3m / 111000 ≈ 0.000120 > threshold
            const jitterCoord = 0.8 / 111000;
            const crawlCoord = 13.3 / 111000;
            expect(jitterCoord).toBeLessThan(STATIONARY_COORD_THRESHOLD);
            expect(crawlCoord).toBeGreaterThan(STATIONARY_COORD_THRESHOLD);
        });

        it("covers velocity range from market crawling (~4km/h) to expressway cruising (~100km/h)", () => {
            // 4 km/h in coord-units/ms ≈ 1.0e-8
            // 95-100 km/h in coord-units/ms ≈ 2.4e-7 - 2.5e-7
            expect(MIN_MOVING_VELOCITY).toBeLessThanOrEqual(0.000000015);
            expect(MAX_VELOCITY).toBeGreaterThanOrEqual(0.00000024);
        });

        it("has latency compensation projection calibrated for real bus transit (~12s)", () => {
            expect(DEFAULT_DATA_DELAY_MS).toBe(12000);
            expect(POST_TARGET_VELOCITY_RATIO).toBeGreaterThanOrEqual(0.85);
        });
    });

    describe("scalarGeometry", () => {
        const line: Coordinate[] = [
            [37.0, 127.0],
            [37.0, 127.1],
            [37.0, 127.2],
        ];

        it("computes cumulative distances along polyline accurately", () => {
            const cum = computeCumulativeDistances(line);
            expect(cum.length).toBe(3);
            expect(cum[0]).toBe(0);
            expect(cum[1]).toBeCloseTo(0.1, 4);
            expect(cum[2]).toBeCloseTo(0.2, 4);
        });

        it("converts scalar distances to segment T and coordinates", () => {
            const cum = computeCumulativeDistances(line);
            const {segIdx, t} = scalarToSegT(cum, 0.15);
            expect(segIdx).toBe(1);
            expect(t).toBeCloseTo(0.5, 3);

            const {position, angle} = positionFromSegT(line, segIdx, t);
            expect(position[0]).toBeCloseTo(37.0, 4);
            expect(position[1]).toBeCloseTo(127.15, 4);
            expect(angle).toBeCloseTo(90, 1);
        });

        it("handles polylineScalarDist within bounds", () => {
            const cum = computeCumulativeDistances(line);
            const dist = polylineScalarDist(cum, 1, 0.5);
            expect(dist).toBeCloseTo(0.15, 4);
        });
    });

    describe("speedModulation", () => {
        it("blends measured velocity with prior according to sample count", () => {
            const measured = CITY_BUS_BASE_VELOCITY * 1.5;
            const blended1 = blendVelocityWithPrior(measured, 1);
            const blended5 = blendVelocityWithPrior(measured, 5);

            expect(blended1).toBeGreaterThan(CITY_BUS_BASE_VELOCITY);
            expect(blended5).toBeGreaterThan(blended1);
            expect(blended5).toBeLessThanOrEqual(measured);
        });

        it("slows down when approaching an upcoming unpassed stop", () => {
            const stopDistances = [0.05]; // Stop at 0.05 coord distance
            const markerDist = 0.0495; // Within STOP_DECEL_ZONE (0.0009)
            const targetDist = 0.0498; // Target also before stop

            const {multiplier, nearStopIdx} = getStopSpeedMultiplier(markerDist, targetDist, stopDistances);
            expect(multiplier).toBeLessThan(1.0);
            expect(nearStopIdx).toBeNull(); // Not yet within STOP_DWELL_PROXIMITY
        });

        it("detects nearStopIdx when within STOP_DWELL_PROXIMITY", () => {
            const stopDistances = [0.05];
            const markerDist = 0.05 - (STOP_DWELL_PROXIMITY * 0.5); // Inside dwell proximity
            const targetDist = 0.05;

            const {multiplier, nearStopIdx} = getStopSpeedMultiplier(markerDist, targetDist, stopDistances);
            expect(multiplier).toBeLessThan(1.0);
            expect(nearStopIdx).toBe(0);
        });

        it("does not brake if target has already passed the stop", () => {
            const stopDistances = [0.05];
            const markerDist = 0.0495;
            const targetDist = 0.06; // Target already well past stop

            const {multiplier, nearStopIdx} = getStopSpeedMultiplier(markerDist, targetDist, stopDistances);
            expect(multiplier).toBe(1.0);
            expect(nearStopIdx).toBeNull();
        });
    });
});
