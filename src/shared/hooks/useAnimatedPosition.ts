"use client";

import {
    calculateBearing,
    type Coordinate,
    getApproxDistanceMeters,
    getEuclideanDistance,
    interpolateAngle,
    snapPointToPolyline,
} from "@shared/utils/geo";

import type {Marker} from "maplibre-gl";
import React, {useCallback, useEffect, useRef, useState} from "react";

// ----------------------------------------------------------------------
// Types & Options
// ----------------------------------------------------------------------

interface AnimatedPositionState {
    position: Coordinate;
    angle: number;
}

interface UseAnimatedPositionOptions {
    duration?: number;
    polyline?: Coordinate[];
    snapToPolyline?: boolean;
    snapIndexHint?: number | null;
    snapIndexRange?: number;
    resetKey?: string | number;
    markerRef?: React.RefObject<Marker | null>;
    pollingIntervalMs?: number;
    dataDelayMs?: number;
    /** Polyline coordinate indices where bus stops are located. */
    stopCoordIndices?: number[];
}

// ----------------------------------------------------------------------
// Constants — Aggressive Real-Time Linear Interpolation & Dead Reckoning
// ----------------------------------------------------------------------

// Ignore backward jumps smaller than this (GPS jitter in meters).
const BACKWARD_JITTER_METERS = 20;

// Maximum distance backward/forward to smooth instead of teleporting
const TELEPORT_DISTANCE_METERS = 1200;

// React state update throttle — 20 Hz (50ms) for UI popup consumers
const STATE_UPDATE_THROTTLE_MS = 50;

// Cap per-frame dt to prevent wild jumps when tab was backgrounded
const MAX_DT_MS = 200;

// City bus base cruising speed (coord-units / ms)
// 1 degree ≈ 111 km → 30 km/h = 8.33 m/s ≈ 7.5e-8 deg/ms
const CITY_BUS_BASE_VELOCITY = 0.000000075;

// Velocity limits (coord-units / ms)
// Min crawling speed (~10 km/h), Max cruising (~90 km/h), Max catchup (~140 km/h)
const MIN_MOVING_VELOCITY = 0.000000025;
const MAX_VELOCITY = 0.00000025;
const MAX_CATCHUP_VELOCITY = 0.00000035;
const STOP_THRESHOLD = 0.000000005;

// Velocity smoothing factor (EMA weight on new measurement)
const VELOCITY_SMOOTHING = 0.65;

// Weight given to measured velocity vs prior (starts high to adapt quickly)
const VELOCITY_PRIOR_BLEND_MIN = 0.6;
const VELOCITY_PRIOR_BLEND_MAX = 0.95;
const VELOCITY_PRIOR_RAMP_SAMPLES = 2;

// Default estimated latency between real bus and client reception (ms)
// Compensates for ~10s public BIS/TAGO API delay with forward linear extrapolation
const DEFAULT_DATA_DELAY_MS = 10000;

// Dead reckoning duration:
// Full speed forward extrapolation for up to 45s between GPS updates
const DEAD_RECKONING_CRUISE_MS = 45000;
// Graceful deceleration coasting from 45s to 90s if no data arrives
const DEAD_RECKONING_FADEOUT_MS = 45000;

// Elastic Catch-Up time constant:
// Snappy spring convergence over ~1.0s to quickly close position gaps when new API data arrives
const CATCHUP_TAU_MS = 1000;

// Acceleration/deceleration transition easing (ms)
const VELOCITY_TAU_MS = 250;

// Angular smoothing
const ANGULAR_LOOKAHEAD_THRESHOLD = 0.65;
const ANGULAR_SMOOTHING_FACTOR = 0.20;

// --- Stop-aware speed modulation ---
// Deceleration zone before a stop (~150m ≈ 0.00135 degrees)
const STOP_DECEL_ZONE = 0.00135;
// Acceleration zone after a stop (~100m ≈ 0.0009 degrees)
const STOP_ACCEL_ZONE = 0.0009;
// Proximity threshold to trigger station dwell (~25m ≈ 0.00022 degrees)
const STOP_DWELL_PROXIMITY = 0.00022;
// Minimum speed multiplier during approach
const STOP_MIN_SPEED_MULT = 0.15;
// Realistic passenger boarding dwell time at a stop during extrapolation (ms)
const STOP_DWELL_MS = 3500;

// ----------------------------------------------------------------------
// Pure Helper Functions
// ----------------------------------------------------------------------

function computeCumulativeDistances(polyline: readonly Coordinate[]): number[] {
    const n = polyline.length;
    if (n < 2) return n === 1 ? [0] : [];
    const cumDist = new Array<number>(n);
    cumDist[0] = 0;
    for (let i = 1; i < n; i++) {
        cumDist[i] = cumDist[i - 1] + getEuclideanDistance(polyline[i - 1], polyline[i]);
    }
    return cumDist;
}

function polylineScalarDist(cumDist: number[], segIdx: number, t: number): number {
    const segStart = cumDist[segIdx] ?? 0;
    const segEnd = cumDist[segIdx + 1] ?? segStart;
    return segStart + (segEnd - segStart) * t;
}

function scalarToSegT(cumDist: number[], distance: number): { segIdx: number; t: number } {
    const n = cumDist.length;
    if (n < 2 || distance <= 0) return {segIdx: 0, t: 0};
    if (distance >= cumDist[n - 1]) return {segIdx: n - 2, t: 1};

    let lo = 0, hi = n - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (cumDist[mid] <= distance) lo = mid; else hi = mid - 1;
    }
    const segIdx = Math.min(lo, n - 2);
    const segStart = cumDist[segIdx];
    const segEnd = cumDist[segIdx + 1] ?? segStart;
    const segLen = segEnd - segStart;
    const t = segLen > 0 ? Math.max(0, Math.min(1, (distance - segStart) / segLen)) : 0;
    return {segIdx, t};
}

function positionFromSegT(
    polyline: readonly Coordinate[],
    segIdx: number,
    t: number,
): { position: Coordinate; angle: number } {
    const A = polyline[segIdx];
    const B = polyline[segIdx + 1] ?? A;
    const pos: Coordinate = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
    let angle = calculateBearing(A, B);

    const C = polyline[segIdx + 2];
    if (C && t > ANGULAR_LOOKAHEAD_THRESHOLD) {
        const nextAngle = calculateBearing(B, C);
        const progress = (t - ANGULAR_LOOKAHEAD_THRESHOLD) / (1 - ANGULAR_LOOKAHEAD_THRESHOLD);
        angle = interpolateAngle(angle, nextAngle, progress);
    }
    return {position: pos, angle};
}

/** Convert stop coordinate indices to sorted scalar distances along polyline. */
function computeStopDistances(stopCoordIndices: number[], cumDist: number[]): number[] {
    if (cumDist.length < 2 || stopCoordIndices.length === 0) return [];
    const maxIdx = cumDist.length - 1;
    const dists: number[] = [];
    for (const idx of stopCoordIndices) {
        const clamped = Math.max(0, Math.min(idx, maxIdx));
        const d = cumDist[clamped];
        if (typeof d === "number") dists.push(d);
    }
    return dists.sort((a, b) => a - b);
}

/**
 * Returns speed multiplier and nearest stop index info based on proximity to stops.
 * Bypasses deceleration/dwell for intermediate stops if target position has already moved past them.
 */
function getStopSpeedMultiplier(markerDist: number, targetDist: number, stopDistances: number[]): {
    multiplier: number;
    nearStopIdx: number | null;
} {
    if (stopDistances.length === 0) return {multiplier: 1.0, nearStopIdx: null};

    let minMult = 1.0;
    let nearStopIdx: number | null = null;

    let lo = 0, hi = stopDistances.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (stopDistances[mid] < markerDist) lo = mid + 1; else hi = mid;
    }

    for (let i = Math.max(0, lo - 1); i <= Math.min(lo, stopDistances.length - 1); i++) {
        const stopDist = stopDistances[i];
        const delta = markerDist - stopDist; // negative = approaching, positive = leaving

        // If target is already ahead of this stop, the bus has already passed it; don't dwell or brake
        const isTargetPast = targetDist > stopDist + STOP_ACCEL_ZONE;

        if (!isTargetPast && Math.abs(delta) < STOP_DWELL_PROXIMITY) {
            nearStopIdx = i;
        }

        let mult = 1.0;
        if (!isTargetPast) {
            if (delta < 0) {
                // Approaching stop
                const distToStop = -delta;
                if (distToStop < STOP_DECEL_ZONE) {
                    const progress = 1 - distToStop / STOP_DECEL_ZONE;
                    const eased = progress * progress * (3 - 2 * progress);
                    mult = 1.0 - eased * (1.0 - STOP_MIN_SPEED_MULT);
                }
            } else {
                // Leaving stop
                if (delta < STOP_ACCEL_ZONE) {
                    const progress = delta / STOP_ACCEL_ZONE;
                    const eased = progress * progress * (3 - 2 * progress);
                    mult = STOP_MIN_SPEED_MULT + eased * (1.0 - STOP_MIN_SPEED_MULT);
                }
            }
        }

        minMult = Math.min(minMult, mult);
    }

    return {multiplier: minMult, nearStopIdx};
}

/**
 * Blend measured velocity with city bus base prior.
 */
function blendVelocityWithPrior(measured: number, sampleCount: number): number {
    const trust = Math.min(
        VELOCITY_PRIOR_BLEND_MAX,
        VELOCITY_PRIOR_BLEND_MIN +
        (VELOCITY_PRIOR_BLEND_MAX - VELOCITY_PRIOR_BLEND_MIN) *
        (sampleCount / VELOCITY_PRIOR_RAMP_SAMPLES)
    );
    return trust * measured + (1 - trust) * CITY_BUS_BASE_VELOCITY;
}

// ----------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------

/**
 * Animates a bus marker along a polyline with continuous, aggressive linear interpolation,
 * forward predictive dead reckoning, fast-accelerating catch-up, and stop-aware speed modulation.
 *
 * Key behaviors:
 *  1. Forward Prediction (Future Dead Reckoning): Compensates for public BIS/TAGO API
 *     latencies (~10s) by projecting the bus marker ahead along the route in real time.
 *  2. Fast Catch-Up Acceleration: When fresh API data arrives, the marker boosts velocity
 *     swiftly to catch up to the projected location without sluggish delay.
 *  3. Smooth 60fps dead reckoning: The bus continuously glides forward along the route
 *     between discrete API updates rather than freezing/pausing.
 *  4. Direct MapLibre marker updates for zero React re-render overhead during animation.
 */
export function useAnimatedPosition(
    targetPosition: Coordinate,
    targetAngle: number,
    options: UseAnimatedPositionOptions = {}
): AnimatedPositionState {
    const {
        polyline = [],
        snapToPolyline: shouldSnap = true,
        snapIndexHint = null,
        snapIndexRange,
        resetKey,
        markerRef,
        dataDelayMs = DEFAULT_DATA_DELAY_MS,
        stopCoordIndices = [],
    } = options;

    // ---- React state (throttled for UI consumers) ----
    const [state, setState] = useState<AnimatedPositionState>(() => {
        if (shouldSnap && polyline.length >= 2) {
            const snapped = snapPointToPolyline(targetPosition, polyline, {
                segmentHint: snapIndexHint,
                searchRadius: snapIndexRange,
            });
            const cumDist = computeCumulativeDistances(polyline);
            const dist = polylineScalarDist(cumDist, snapped.segmentIndex, snapped.t);
            const effectiveDelay = Math.max(0, Math.min(dataDelayMs, 30000));
            const totalDist = cumDist[cumDist.length - 1] ?? dist;
            const projDist = CITY_BUS_BASE_VELOCITY * effectiveDelay;
            const initialDist = Math.min(dist + projDist, totalDist);
            const {segIdx, t} = scalarToSegT(cumDist, initialDist);
            const {position: pos, angle: pathAngle} = positionFromSegT(polyline, segIdx, t);
            return {position: pos, angle: pathAngle || targetAngle};
        }
        return {position: targetPosition, angle: targetAngle};
    });

    // ---- Lifecycle ----
    const animFrameRef = useRef<number | null>(null);
    const isFirstDataRef = useRef(true);
    const prevPolylineLenRef = useRef(polyline.length);
    const prevTargetRef = useRef<Coordinate>(targetPosition);
    const resetKeyRef = useRef(resetKey);

    // ---- Animated state ----
    const currentPosRef = useRef<Coordinate>(state.position);
    const currentAngleRef = useRef<number>(state.angle);
    const lastStateUpdateRef = useRef(0);

    // ---- Polyline / scalar state ----
    const polylineRef = useRef(polyline);
    const cumDistRef = useRef<number[]>([]);
    const markerDistRef = useRef(0); // where marker currently is along polyline
    const targetDistRef = useRef(0); // where real-time projected target is
    const velocityRef = useRef(CITY_BUS_BASE_VELOCITY); // estimated cruising velocity (coord-units / ms)
    const currentVelocityRef = useRef(CITY_BUS_BASE_VELOCITY); // smoothed dynamic velocity
    const lastFrameRef = useRef(0);

    // ---- Timing & Extrapolation ----
    const lastDataTimeRef = useRef(0); // performance.now() of last data arrival
    const prevRawDistRef = useRef(0); // raw scalar distance of previous GPS data
    const hasDataRef = useRef(false);
    const sampleCountRef = useRef(0);

    // ---- Stop-aware Dwell State ----
    const stopDistancesRef = useRef<number[]>([]);
    const lastDwelledStopIdxRef = useRef<number>(-1);
    const dwellStartTimeRef = useRef<number>(0);

    // ----------------------------------------------------------------
    // Direct MapLibre marker update (bypasses React for silky 60fps)
    // ----------------------------------------------------------------
    const updateMarkerDirect = useCallback((pos: Coordinate, angle: number) => {
        const marker = markerRef?.current;
        if (!marker) return false;
        try {
            marker.setLngLat([pos[1], pos[0]]);
            marker.setRotation(angle);
            return true;
        } catch {
            return false;
        }
    }, [markerRef]);

    // ----------------------------------------------------------------
    // Sync cumulative distances & stop distances when polyline changes
    // ----------------------------------------------------------------
    useEffect(() => {
        polylineRef.current = polyline;
        const cumDist = polyline.length >= 2 ? computeCumulativeDistances(polyline) : [];
        cumDistRef.current = cumDist;
        stopDistancesRef.current = computeStopDistances(stopCoordIndices, cumDist);
    }, [polyline, stopCoordIndices]);

    // ----------------------------------------------------------------
    // Reset on route change (resetKey)
    // ----------------------------------------------------------------
    useEffect(() => {
        if (resetKeyRef.current === resetKey) return;
        resetKeyRef.current = resetKey;

        velocityRef.current = CITY_BUS_BASE_VELOCITY;
        currentVelocityRef.current = CITY_BUS_BASE_VELOCITY;
        lastDataTimeRef.current = 0;
        prevRawDistRef.current = 0;
        hasDataRef.current = false;
        isFirstDataRef.current = true;
        lastFrameRef.current = 0;
        sampleCountRef.current = 0;
        lastDwelledStopIdxRef.current = -1;
        dwellStartTimeRef.current = 0;

        const hasPolyline = polyline.length >= 2;
        let nextPos = targetPosition;
        let nextAngle = targetAngle;

        if (shouldSnap && hasPolyline) {
            const snapped = snapPointToPolyline(targetPosition, polyline, {
                segmentHint: snapIndexHint,
                searchRadius: snapIndexRange,
            });
            const cumDist = cumDistRef.current;
            const dist = polylineScalarDist(cumDist, snapped.segmentIndex, snapped.t);
            const effectiveDelay = Math.max(0, Math.min(dataDelayMs, 30000));
            const totalDist = cumDist[cumDist.length - 1] ?? dist;
            const projDist = CITY_BUS_BASE_VELOCITY * effectiveDelay;
            const initialDist = Math.min(dist + projDist, totalDist);

            markerDistRef.current = initialDist;
            targetDistRef.current = initialDist;
            prevRawDistRef.current = dist;
            hasDataRef.current = true;
            lastDataTimeRef.current = performance.now();

            const {segIdx, t} = scalarToSegT(cumDist, initialDist);
            const {position: pos, angle: pathAngle} = positionFromSegT(polyline, segIdx, t);
            nextPos = pos;
            nextAngle = pathAngle || snapped.angle;
        }

        currentPosRef.current = nextPos;
        currentAngleRef.current = nextAngle;
        prevTargetRef.current = targetPosition;
        updateMarkerDirect(nextPos, nextAngle);
        setState({position: nextPos, angle: nextAngle});
    }, [
        resetKey,
        targetPosition,
        targetAngle,
        polyline,
        shouldSnap,
        snapIndexHint,
        snapIndexRange,
        dataDelayMs,
        updateMarkerDirect,
    ]);

    // ----------------------------------------------------------------
    // Handle incoming data (targetPosition changes)
    // ----------------------------------------------------------------
    useEffect(() => {
        const hasPolyline = polyline.length >= 2;
        const polylineJustLoaded = hasPolyline && prevPolylineLenRef.current < 2;
        prevPolylineLenRef.current = polyline.length;

        // First data point / initialization
        if (isFirstDataRef.current || polylineJustLoaded) {
            isFirstDataRef.current = false;

            if (shouldSnap && hasPolyline) {
                const snapped = snapPointToPolyline(targetPosition, polyline, {
                    segmentHint: snapIndexHint,
                    searchRadius: snapIndexRange,
                });
                const cumDist = cumDistRef.current;
                const dist = polylineScalarDist(cumDist, snapped.segmentIndex, snapped.t);
                const effectiveDelay = Math.max(0, Math.min(dataDelayMs, 30000));
                const totalDist = cumDist[cumDist.length - 1] ?? dist;
                const projDist = CITY_BUS_BASE_VELOCITY * effectiveDelay;
                const initialDist = Math.min(dist + projDist, totalDist);

                markerDistRef.current = initialDist;
                prevRawDistRef.current = dist;
                hasDataRef.current = true;
                lastDataTimeRef.current = performance.now();
                sampleCountRef.current = 0;

                // Start cruising immediately at normal bus speed
                velocityRef.current = CITY_BUS_BASE_VELOCITY;
                currentVelocityRef.current = CITY_BUS_BASE_VELOCITY;
                targetDistRef.current = initialDist;

                const {segIdx, t} = scalarToSegT(cumDist, initialDist);
                const {position: pos, angle: pathAngle} = positionFromSegT(polyline, segIdx, t);

                currentPosRef.current = pos;
                currentAngleRef.current = pathAngle || targetAngle;
                updateMarkerDirect(pos, pathAngle || targetAngle);
                setState({position: pos, angle: pathAngle || targetAngle});
            } else {
                currentPosRef.current = targetPosition;
                currentAngleRef.current = targetAngle;
                setState({position: targetPosition, angle: targetAngle});
            }
            prevTargetRef.current = targetPosition;
            return;
        }

        // Same position from API polling -> update timestamp so extrapolation stays fresh
        const prev = prevTargetRef.current;
        if (targetPosition[0] === prev[0] && targetPosition[1] === prev[1]) {
            return;
        }
        prevTargetRef.current = targetPosition;

        if (!shouldSnap || !hasPolyline) return;
        const cumDist = cumDistRef.current;
        if (cumDist.length < 2) return;

        const snapped = snapPointToPolyline(targetPosition, polyline, {
            segmentHint: snapIndexHint,
            searchRadius: snapIndexRange,
        });
        const rawDist = polylineScalarDist(cumDist, snapped.segmentIndex, snapped.t);
        const totalDist = cumDist[cumDist.length - 1];
        const lagMeters = getApproxDistanceMeters(currentPosRef.current, snapped.position);
        const now = performance.now();

        // Check for backward jumps (GPS noise or route restart)
        if (hasDataRef.current && rawDist < prevRawDistRef.current) {
            // Small backward jitter -> keep current target
            if (lagMeters <= BACKWARD_JITTER_METERS) {
                prevRawDistRef.current = rawDist;
                return;
            }

            // Extreme jump / route loop restart -> re-anchor cleanly
            if (lagMeters > TELEPORT_DISTANCE_METERS) {
                const effectiveDelay = Math.max(0, Math.min(dataDelayMs, 30000));
                const projDist = CITY_BUS_BASE_VELOCITY * effectiveDelay;
                const initialDist = Math.min(rawDist + projDist, totalDist);

                markerDistRef.current = initialDist;
                targetDistRef.current = initialDist;
                velocityRef.current = CITY_BUS_BASE_VELOCITY;
                currentVelocityRef.current = CITY_BUS_BASE_VELOCITY;
                sampleCountRef.current = 0;
                lastDwelledStopIdxRef.current = -1;
                dwellStartTimeRef.current = 0;
                prevRawDistRef.current = rawDist;
                lastDataTimeRef.current = now;

                const {segIdx, t} = scalarToSegT(cumDist, initialDist);
                const {position: pos, angle: pathAngle} = positionFromSegT(polyline, segIdx, t);

                currentPosRef.current = pos;
                currentAngleRef.current = pathAngle || snapped.angle;
                updateMarkerDirect(pos, pathAngle || snapped.angle);
                setState({position: pos, angle: pathAngle || snapped.angle});
                return;
            }
        }

        // Estimate velocity based on progress between distinct GPS updates
        const dtMs = lastDataTimeRef.current > 0 ? now - lastDataTimeRef.current : 0;
        if (dtMs > 600 && hasDataRef.current) {
            const moved = rawDist - prevRawDistRef.current;
            if (moved > 0) {
                const rawV = moved / dtMs;
                const clampedV = Math.min(Math.max(rawV, MIN_MOVING_VELOCITY), MAX_VELOCITY);

                sampleCountRef.current++;
                const samples = sampleCountRef.current;

                const measuredEMA =
                    velocityRef.current <= STOP_THRESHOLD
                        ? clampedV
                        : VELOCITY_SMOOTHING * clampedV + (1 - VELOCITY_SMOOTHING) * velocityRef.current;

                velocityRef.current = Math.min(
                    blendVelocityWithPrior(measuredEMA, samples),
                    MAX_VELOCITY
                );
            }
        }

        prevRawDistRef.current = rawDist;
        lastDataTimeRef.current = now;
        hasDataRef.current = true;

        // Forward project real-time position by data latency compensation
        const v = Math.max(velocityRef.current, MIN_MOVING_VELOCITY);
        const effectiveDelay = Math.max(0, Math.min(dataDelayMs, 30000));
        const projDist = v * effectiveDelay;

        // Reconcile new target without snapping backwards
        targetDistRef.current = Math.min(rawDist + projDist, totalDist);

        // Reset dwell state if bus has moved past dwelled stop
        const stopDists = stopDistancesRef.current;
        if (lastDwelledStopIdxRef.current >= 0 && lastDwelledStopIdxRef.current < stopDists.length) {
            if (rawDist > stopDists[lastDwelledStopIdxRef.current] + STOP_ACCEL_ZONE) {
                lastDwelledStopIdxRef.current = -1;
                dwellStartTimeRef.current = 0;
            }
        }
    }, [
        targetPosition,
        targetAngle,
        polyline,
        shouldSnap,
        snapIndexHint,
        snapIndexRange,
        dataDelayMs,
        updateMarkerDirect,
    ]);

    // ----------------------------------------------------------------
    // Animation loop — Continuous 60fps Dead Reckoning & Linear Interpolation
    // ----------------------------------------------------------------
    useEffect(() => {
        const tick = (now: number) => {
            const pl = polylineRef.current;
            const cumDist = cumDistRef.current;

            if (pl.length < 2 || cumDist.length < 2) {
                lastFrameRef.current = now;
                animFrameRef.current = requestAnimationFrame(tick);
                return;
            }

            const dt = lastFrameRef.current > 0 ? now - lastFrameRef.current : 0;
            lastFrameRef.current = now;
            const clampedDt = Math.min(dt, MAX_DT_MS);

            // Smooth dynamic velocity transition (bus inertia)
            const targetV = Math.max(velocityRef.current, MIN_MOVING_VELOCITY);
            const currentV = currentVelocityRef.current;
            const activeV = currentV + (targetV - currentV) * Math.min(clampedDt / VELOCITY_TAU_MS, 1);
            currentVelocityRef.current = activeV;

            const totalDist = cumDist[cumDist.length - 1];
            let dist = markerDistRef.current;
            const target = targetDistRef.current;
            const gap = target - dist; // positive = behind target, negative = ahead

            // Check dead reckoning timeout / fadeout
            const timeSinceLastData = lastDataTimeRef.current > 0 ? now - lastDataTimeRef.current : 0;
            let deadReckoningFactor = 1.0;
            if (timeSinceLastData > DEAD_RECKONING_CRUISE_MS) {
                const over = timeSinceLastData - DEAD_RECKONING_CRUISE_MS;
                deadReckoningFactor = Math.max(0, 1 - over / DEAD_RECKONING_FADEOUT_MS);
            }

            if (deadReckoningFactor > 0 && activeV > 0) {
                // Stop-aware speed modulation (skips deceleration/dwell for stops that bus has already passed)
                const {multiplier: stopMult, nearStopIdx} = getStopSpeedMultiplier(
                    dist,
                    target,
                    stopDistancesRef.current
                );

                // Check stop dwell logic during forward dead reckoning
                let isDwelling = false;
                if (nearStopIdx !== null) {
                    if (lastDwelledStopIdxRef.current !== nearStopIdx) {
                        // Enter new stop dwell
                        lastDwelledStopIdxRef.current = nearStopIdx;
                        dwellStartTimeRef.current = now;
                        isDwelling = true;
                    } else if (now - dwellStartTimeRef.current < STOP_DWELL_MS) {
                        isDwelling = true;
                    }
                }

                if (isDwelling) {
                    // Dwell at station: gentle crawl or pause
                    const dwellAdvance = activeV * 0.05 * clampedDt;
                    dist = Math.min(dist + dwellAdvance, totalDist);
                    markerDistRef.current = dist;
                } else {
                    // Continuous Linear Dead Reckoning + Fast-Accelerating Catch-Up
                    // 1. Base cruising speed along polyline
                    const baseVelocity = activeV * deadReckoningFactor * stopMult;

                    // 2. Responsive catch-up boost (accelerates quickly when behind target)
                    const maxCatchupBoost = Math.max(baseVelocity * 3.5, MAX_VELOCITY * 1.5);
                    const catchupVelocity = Math.max(
                        -baseVelocity * 0.7,
                        Math.min(gap / CATCHUP_TAU_MS, maxCatchupBoost)
                    );

                    const effectiveVelocity = Math.min(
                        MAX_CATCHUP_VELOCITY,
                        Math.max(0, baseVelocity + catchupVelocity)
                    );
                    const advance = effectiveVelocity * clampedDt;

                    if (advance > 0) {
                        dist = Math.min(dist + advance, totalDist);
                        markerDistRef.current = dist;
                    }
                }
            }

            // Convert scalar distance -> 2D world coordinate & interpolated angle
            const {segIdx, t} = scalarToSegT(cumDist, dist);
            const {position: pos, angle: pathAngle} = positionFromSegT(pl, segIdx, t);
            const angle = interpolateAngle(
                currentAngleRef.current,
                pathAngle,
                ANGULAR_SMOOTHING_FACTOR
            );

            currentPosRef.current = pos;
            currentAngleRef.current = angle;

            // Direct high-performance MapLibre update
            const directOk = updateMarkerDirect(pos, angle);

            // Throttle React state updates for React components/popups
            const elapsed = now - lastStateUpdateRef.current;
            if (!directOk || elapsed >= STATE_UPDATE_THROTTLE_MS) {
                lastStateUpdateRef.current = now;
                setState({position: pos, angle});
            }

            animFrameRef.current = requestAnimationFrame(tick);
        };

        animFrameRef.current = requestAnimationFrame(tick);
        return () => {
            if (animFrameRef.current !== null) {
                cancelAnimationFrame(animFrameRef.current);
                animFrameRef.current = null;
            }
        };
    }, [updateMarkerDirect]);

    return state;
}
