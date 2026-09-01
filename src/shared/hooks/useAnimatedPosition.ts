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
// Constants — Real-Time Smooth Interpolation, Rapid Catch-Up & Safeguards
// ----------------------------------------------------------------------

// Ignore backward jumps smaller than this (GPS jitter in meters)
const BACKWARD_JITTER_METERS = 20;

// Scalar distance drop in meters that signals route restart / turnaround loop
const SCALAR_LOOP_RESTART_THRESHOLD_METERS = 400;

// Maximum distance backward/forward before teleporting instead of smooth transition (800m)
const TELEPORT_DISTANCE_METERS = 800;
const TELEPORT_COORD_THRESHOLD = 0.0075; // ~830m

// Maximum distance the animated marker is ever allowed to dead-reckon ahead of the last confirmed API position (~1.35km)
// 1차 예측 지점 이후의 예측 거리를 넉넉하게 확장하여 다음 API 수신이 늦어져도 끊김 없이 길게 지속
const MAX_DEAD_RECKONING_LEAD_COORD = 0.0120;

// Maximum latency compensation projection allowed upon receiving fresh API data (~300m)
// 1차 예측 지점: API 지연 보정 목표 거리
const MAX_LATENCY_PROJECTION_COORD = 0.0028;

// 1차 예측 지점 통과 후 2차 외삽 예측 속도 비율 (기본 속도의 40%로 감속하여 장거리 지속 주행)
const POST_TARGET_VELOCITY_RATIO = 0.40;

// React state update throttle — 20 Hz (50ms) for UI popup consumers
const STATE_UPDATE_THROTTLE_MS = 50;

// Cap per-frame dt to prevent wild jumps when tab was backgrounded
const MAX_DT_MS = 200;

// City bus base cruising speed (coord-units / ms)
// 1 degree ≈ 111 km → 30 km/h = 8.33 m/s ≈ 7.5e-8 deg/ms
const CITY_BUS_BASE_VELOCITY = 0.000000075;

// Velocity limits (coord-units / ms)
// Min crawling speed (~10 km/h), Max cruising (~80 km/h), Rapid Catchup sprint (~300 km/h scalar)
const MIN_MOVING_VELOCITY = 0.000000025;
const MAX_VELOCITY = 0.00000022;
const MAX_CATCHUP_VELOCITY = 0.00000085;
const STOP_THRESHOLD = 0.000000005;

// Velocity smoothing factor (EMA weight on new measurement)
const VELOCITY_SMOOTHING = 0.70;
// Deceleration smoothing factor (faster adaptation when new API delta shows bus slowed down)
const VELOCITY_DECEL_SMOOTHING = 0.88;

// Weight given to measured velocity vs prior (starts high to adapt quickly)
const VELOCITY_PRIOR_BLEND_MIN = 0.6;
const VELOCITY_PRIOR_BLEND_MAX = 0.95;
const VELOCITY_PRIOR_RAMP_SAMPLES = 2;

// Default estimated latency between real bus and client reception (ms)
const DEFAULT_DATA_DELAY_MS = 12000;

// Dead reckoning duration:
// Smooth forward extrapolation for up to 60s between GPS updates (capped by MAX_DEAD_RECKONING_LEAD_COORD)
const DEAD_RECKONING_CRUISE_MS = 60000;
// Graceful deceleration coasting from 60s to 100s if no data arrives
const DEAD_RECKONING_FADEOUT_MS = 40000;

// Rapid Catch-Up time constant:
// Fast exponential convergence (~600ms) with non-linear boost to rapidly catch up when slow API data arrives
const CATCHUP_TAU_MS = 600;

// Acceleration/deceleration transition easing (ms) - rapid throttle-up
const VELOCITY_TAU_MS = 100;

// Angular smoothing
const ANGULAR_LOOKAHEAD_THRESHOLD = 0.65;
const ANGULAR_SMOOTHING_FACTOR = 0.22;

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
 * Animates a bus marker along a polyline with continuous smooth linear interpolation,
 * rapid catch-up sprint on new API updates, delta discrepancy slowdown detection, and anti-teleport / anti-drift safeguards.
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
            const effectiveDelay = Math.max(0, Math.min(dataDelayMs, 25000));
            const totalDist = cumDist[cumDist.length - 1] ?? dist;
            const maxAllowedProj = Math.max(
                0,
                Math.min(
                    CITY_BUS_BASE_VELOCITY * effectiveDelay,
                    MAX_LATENCY_PROJECTION_COORD,
                    totalDist - dist - STOP_DECEL_ZONE * 0.5
                )
            );
            const initialDist = Math.min(dist + maxAllowedProj, totalDist);
            const {segIdx, t} = scalarToSegT(cumDist, initialDist);
            const {position: pos, angle: pathAngle} = positionFromSegT(polyline, segIdx, t);
            return {position: pos, angle: pathAngle || targetAngle};
        }
        return {position: targetPosition, angle: targetAngle};
    });

    // ---- Lifecycle ----
    const animFrameRef = useRef<number | null>(null);
    const isFirstDataRef = useRef(true);
    const prevPolylineRef = useRef(polyline);
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
    const targetDistRef = useRef(0); // 1차 예측 목표 지점 (API 보정 지점)
    const velocityRef = useRef(CITY_BUS_BASE_VELOCITY); // estimated cruising velocity (coord-units / ms)
    const currentVelocityRef = useRef(CITY_BUS_BASE_VELOCITY); // smoothed dynamic velocity
    const lastFrameRef = useRef(0);

    // ---- Timing & Extrapolation ----
    const lastDataTimeRef = useRef(0); // performance.now() of last data arrival
    const prevRawDistRef = useRef(0); // raw scalar distance of previous GPS data
    const hasDataRef = useRef(false);
    const sampleCountRef = useRef(0);
    const isOvershotOnDataRef = useRef(false); // true if marker was ahead of newly arrived API target

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
    // Reset on route change (resetKey or polyline change)
    // ----------------------------------------------------------------
    useEffect(() => {
        const polylineChanged = prevPolylineRef.current !== polyline;
        const resetKeyChanged = resetKeyRef.current !== resetKey;

        if (!resetKeyChanged && !polylineChanged) return;
        resetKeyRef.current = resetKey;
        prevPolylineRef.current = polyline;

        velocityRef.current = CITY_BUS_BASE_VELOCITY;
        currentVelocityRef.current = CITY_BUS_BASE_VELOCITY;
        lastDataTimeRef.current = 0;
        prevRawDistRef.current = 0;
        hasDataRef.current = false;
        isFirstDataRef.current = true;
        lastFrameRef.current = 0;
        sampleCountRef.current = 0;
        isOvershotOnDataRef.current = false;
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
            const cumDist = cumDistRef.current.length >= 2 ? cumDistRef.current : computeCumulativeDistances(polyline);
            cumDistRef.current = cumDist;
            const dist = polylineScalarDist(cumDist, snapped.segmentIndex, snapped.t);
            const effectiveDelay = Math.max(0, Math.min(dataDelayMs, 25000));
            const totalDist = cumDist[cumDist.length - 1] ?? dist;
            const maxAllowedProj = Math.max(
                0,
                Math.min(
                    CITY_BUS_BASE_VELOCITY * effectiveDelay,
                    MAX_LATENCY_PROJECTION_COORD,
                    totalDist - dist - STOP_DECEL_ZONE * 0.5
                )
            );
            const initialDist = Math.min(dist + maxAllowedProj, totalDist);

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
                const cumDist = cumDistRef.current.length >= 2 ? cumDistRef.current : computeCumulativeDistances(polyline);
                cumDistRef.current = cumDist;
                const dist = polylineScalarDist(cumDist, snapped.segmentIndex, snapped.t);
                const effectiveDelay = Math.max(0, Math.min(dataDelayMs, 25000));
                const totalDist = cumDist[cumDist.length - 1] ?? dist;
                const maxAllowedProj = Math.max(
                    0,
                    Math.min(
                        CITY_BUS_BASE_VELOCITY * effectiveDelay,
                        MAX_LATENCY_PROJECTION_COORD,
                        totalDist - dist - STOP_DECEL_ZONE * 0.5
                    )
                );
                const initialDist = Math.min(dist + maxAllowedProj, totalDist);

                markerDistRef.current = initialDist;
                prevRawDistRef.current = dist;
                hasDataRef.current = true;
                lastDataTimeRef.current = performance.now();
                sampleCountRef.current = 0;
                isOvershotOnDataRef.current = false;

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

        // Same position from API polling -> bus is dwelling or stationary at a stop/terminal
        const prev = prevTargetRef.current;
        if (targetPosition[0] === prev[0] && targetPosition[1] === prev[1]) {
            lastDataTimeRef.current = performance.now();
            velocityRef.current = 0;
            currentVelocityRef.current = 0;
            if (cumDistRef.current.length >= 2) {
                const snapped = snapPointToPolyline(targetPosition, polyline, {
                    segmentHint: snapIndexHint,
                    searchRadius: snapIndexRange,
                });
                targetDistRef.current = polylineScalarDist(cumDistRef.current, snapped.segmentIndex, snapped.t);
            }
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

        // ----------------------------------------------------------------
        // TELEPORT / TURNAROUND RE-ANCHOR: Only for extreme jumps or route resets
        // ----------------------------------------------------------------
        const scalarDropMeters = (prevRawDistRef.current - rawDist) * 111000;
        const isTurnaroundLoop = hasDataRef.current && rawDist < prevRawDistRef.current && scalarDropMeters > SCALAR_LOOP_RESTART_THRESHOLD_METERS;
        const isExtremeTeleport = lagMeters > TELEPORT_DISTANCE_METERS;

        if (isTurnaroundLoop || isExtremeTeleport) {
            const effectiveDelay = Math.max(0, Math.min(dataDelayMs, 10000));
            const maxAllowedProj = Math.max(
                0,
                Math.min(
                    CITY_BUS_BASE_VELOCITY * effectiveDelay,
                    MAX_LATENCY_PROJECTION_COORD,
                    totalDist - rawDist - STOP_DECEL_ZONE * 0.5
                )
            );
            const initialDist = Math.min(rawDist + maxAllowedProj, totalDist);

            markerDistRef.current = initialDist;
            targetDistRef.current = initialDist;
            velocityRef.current = CITY_BUS_BASE_VELOCITY;
            currentVelocityRef.current = CITY_BUS_BASE_VELOCITY;
            sampleCountRef.current = 0;
            isOvershotOnDataRef.current = false;
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

        // Small backward jitter -> keep current target
        if (hasDataRef.current && rawDist < prevRawDistRef.current && lagMeters <= BACKWARD_JITTER_METERS) {
            prevRawDistRef.current = rawDist;
            return;
        }

        // ----------------------------------------------------------------
        // NORMAL PROGRESS & DELTA-AWARE SLOWDOWN:
        // Detect delta changes in incoming data and adapt speed / projection
        // ----------------------------------------------------------------
        const dtMs = lastDataTimeRef.current > 0 ? now - lastDataTimeRef.current : 0;
        const moved = rawDist - prevRawDistRef.current;
        const isStationary = Math.abs(moved) < 0.00003; // moved < ~3 meters

        if (isStationary) {
            velocityRef.current = 0;
            currentVelocityRef.current = 0;
            targetDistRef.current = rawDist;
            isOvershotOnDataRef.current = markerDistRef.current > rawDist + 0.00005;
        } else if (dtMs > 600 && hasDataRef.current && moved > 0) {
            const rawV = moved / dtMs;
            const clampedV = Math.min(Math.max(rawV, MIN_MOVING_VELOCITY), MAX_VELOCITY);

            sampleCountRef.current++;
            const samples = sampleCountRef.current;

            // Asymmetric EMA smoothing:
            // When bus decelerates (clampedV < velocityRef.current), apply faster smoothing (VELOCITY_DECEL_SMOOTHING)
            // to rapidly throttle down rather than lagging behind a decelerating vehicle.
            const smoothing = clampedV < velocityRef.current ? VELOCITY_DECEL_SMOOTHING : VELOCITY_SMOOTHING;
            const measuredEMA =
                velocityRef.current <= STOP_THRESHOLD
                    ? clampedV
                    : smoothing * clampedV + (1 - smoothing) * velocityRef.current;

            velocityRef.current = Math.min(
                blendVelocityWithPrior(measuredEMA, samples),
                MAX_VELOCITY
            );

            // Forward project target position by latency compensation (scaled by dynamic velocity)
            const v = Math.max(velocityRef.current, MIN_MOVING_VELOCITY);
            const effectiveDelay = Math.max(0, Math.min(dataDelayMs, 25000));
            const maxAllowedProj = Math.max(
                0,
                Math.min(
                    v * effectiveDelay,
                    MAX_LATENCY_PROJECTION_COORD,
                    totalDist - rawDist - STOP_DECEL_ZONE * 0.5
                )
            );
            const newTargetDist = Math.min(rawDist + maxAllowedProj, totalDist);
            targetDistRef.current = newTargetDist;

            // ---- Delta Discrepancy & Overshoot Detection (새 정보의 델타 감지 및 감속 로직) ----
            // If the marker's current position is ahead of the newly calculated 1st target distance,
            // the real bus moved less than previous prediction. Mark as overshot and damp speed.
            const currentDist = markerDistRef.current;
            const overshoot = currentDist - newTargetDist;
            if (overshoot > 0.00005) {
                isOvershotOnDataRef.current = true;
                const dampingRatio = Math.max(0, 1 - (overshoot / 0.0012));
                currentVelocityRef.current = currentVelocityRef.current * dampingRatio;
            } else {
                isOvershotOnDataRef.current = false;
            }
        } else {
            targetDistRef.current = rawDist;
            isOvershotOnDataRef.current = markerDistRef.current > rawDist + 0.00005;
        }

        prevRawDistRef.current = rawDist;
        lastDataTimeRef.current = now;
        hasDataRef.current = true;

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
    // Animation loop — Continuous 60fps Rapid Catch-Up & Dead Reckoning
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

            // Smooth dynamic velocity transition (rapid throttle response)
            const targetV = Math.max(velocityRef.current, MIN_MOVING_VELOCITY);
            const currentV = currentVelocityRef.current;
            const activeV = currentV + (targetV - currentV) * Math.min(clampedDt / VELOCITY_TAU_MS, 1);
            currentVelocityRef.current = activeV;

            const totalDist = cumDist[cumDist.length - 1];
            let dist = markerDistRef.current;
            const target = targetDistRef.current;
            const gap = target - dist; // positive = marker behind target, negative = marker past target

            // Check dead reckoning timeout / fadeout
            const timeSinceLastData = lastDataTimeRef.current > 0 ? now - lastDataTimeRef.current : 0;
            let deadReckoningFactor = 1.0;
            if (timeSinceLastData > DEAD_RECKONING_CRUISE_MS) {
                const over = timeSinceLastData - DEAD_RECKONING_CRUISE_MS;
                deadReckoningFactor = Math.max(0, 1 - over / DEAD_RECKONING_FADEOUT_MS);
            }

            // SAFETY CEILING: Extrapolation is strictly capped at MAX_DEAD_RECKONING_LEAD_COORD (~1.35km) past raw API position
            const maxExtrapolatedDist = prevRawDistRef.current + MAX_DEAD_RECKONING_LEAD_COORD;
            const hardCeilingDist = Math.min(totalDist, maxExtrapolatedDist);

            // If marker is at/near route terminus or reached extrapolation ceiling, stop forward dead reckoning
            if (dist >= hardCeilingDist || dist >= totalDist - STOP_DECEL_ZONE * 0.5) {
                deadReckoningFactor = 0;
            }

            // If gap is enormous (> 800m), teleport to target; otherwise smoothly & rapidly animate
            if (Math.abs(gap) > TELEPORT_COORD_THRESHOLD) {
                dist = target;
                markerDistRef.current = dist;
            } else if (deadReckoningFactor > 0 || gap > 0.00005) {
                // Stop-aware speed modulation
                const {multiplier: stopMult, nearStopIdx} = getStopSpeedMultiplier(
                    dist,
                    target,
                    stopDistancesRef.current
                );

                // Check stop dwell logic during forward dead reckoning
                let isDwelling = false;
                if (nearStopIdx !== null) {
                    if (lastDwelledStopIdxRef.current !== nearStopIdx) {
                        lastDwelledStopIdxRef.current = nearStopIdx;
                        dwellStartTimeRef.current = now;
                        isDwelling = true;
                    } else if (now - dwellStartTimeRef.current < STOP_DWELL_MS) {
                        isDwelling = true;
                    }
                }

                if (isDwelling) {
                    // Dwell at station: gentle crawl
                    const dwellAdvance = activeV * 0.05 * clampedDt;
                    dist = Math.min(dist + dwellAdvance, hardCeilingDist);
                    markerDistRef.current = dist;
                } else {
                    let effectiveVelocity = 0;

                    if (gap > 0) {
                        // --------------------------------------------------------
                        // 1차 예측 지점 도달 전: 빠른 캐치업 가속 주행
                        // --------------------------------------------------------
                        const baseVelocity = activeV * deadReckoningFactor * stopMult;
                        const linearBoost = gap / CATCHUP_TAU_MS;
                        const surgeBoost = Math.max(0, (gap - 0.0001) * 0.0020);
                        const catchupVelocity = Math.min(linearBoost + surgeBoost, MAX_CATCHUP_VELOCITY);
                        effectiveVelocity = Math.min(MAX_CATCHUP_VELOCITY, baseVelocity + catchupVelocity);
                    } else if (isOvershotOnDataRef.current) {
                        // --------------------------------------------------------
                        // 새 API 데이터 수신 시 과예측(오버슈트) 판정된 경우: 대기 / 제동
                        // --------------------------------------------------------
                        currentVelocityRef.current = Math.max(0, currentVelocityRef.current * 0.90);
                        effectiveVelocity = 0;
                    } else {
                        // --------------------------------------------------------
                        // 1차 예측 지점 이후 (2차 연장 예측 구간):
                        // 속도는 줄이고(POST_TARGET_VELOCITY_RATIO), 거리는 길게 계속 전진
                        // --------------------------------------------------------
                        const leadBeyondTarget = Math.max(0, dist - target);
                        const maxExtraLead = MAX_DEAD_RECKONING_LEAD_COORD;
                        const extraProgress = Math.min(1, leadBeyondTarget / Math.max(0.001, maxExtraLead));
                        // 1차 지점 통과 후 40% 속도에서 점진적으로 20%까지 완만하게 테이퍼링
                        const taperFactor = POST_TARGET_VELOCITY_RATIO * (1 - extraProgress * 0.50);
                        effectiveVelocity = activeV * deadReckoningFactor * stopMult * taperFactor;
                    }

                    const advance = effectiveVelocity * clampedDt;
                    if (advance > 0) {
                        dist = Math.min(dist + advance, hardCeilingDist);
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
