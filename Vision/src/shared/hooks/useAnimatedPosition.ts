"use client";

import {
    calculateBearing,
    type Coordinate,
    getApproxDistanceMeters,
    getEuclideanDistance,
    interpolateAngle,
    snapPointToPolyline,
} from "@shared/utils/geo";

import type { Marker } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";

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
// Constants — Aggressive Prediction for ~60s Data Delay
// ----------------------------------------------------------------------

// Ignore backward jumps smaller than this (GPS jitter).
const BACKWARD_JITTER_METERS = 15;

// React state update throttle — 20 Hz is plenty for UI consumers.
const STATE_UPDATE_THROTTLE_MS = 50;

// Cap per-frame dt to prevent huge jumps when tab was backgrounded.
const MAX_DT_MS = 200;

// Catch-up time constant. τ=600ms → 63% of gap closed in 0.6s.
// Aggressive: we want fast convergence since predictions drift far.
const CATCHUP_TAU_MS = 600;

// Velocity EMA weight — favour new measurements over history
// since old measurements are very stale with 60s delay.
const VELOCITY_SMOOTHING = 0.7;

// Skip velocity calc if two data points arrive within this window.
const MIN_DT_FOR_VELOCITY_MS = 400;

// Hard ceiling for velocity (coord-units / ms) ≈ 120 km/h.
const MAX_VELOCITY = 0.0003;

// Below this the bus is considered stopped.
const STOP_THRESHOLD = 0.000003;

// Default estimated staleness of incoming position data — 60 seconds.
const DEFAULT_DATA_DELAY_MS = 60000;

// City bus base speed prior (coord-units/ms).
// 1 degree ≈ 111 km → 30 km/h = 8.33 m/s ≈ 7.5e-8 deg/ms
const CITY_BUS_BASE_VELOCITY = 0.000000075;

// Initial crawl velocity — start at city bus base speed immediately
// so the marker begins moving from the first frame.
const INITIAL_CRAWL_VELOCITY = CITY_BUS_BASE_VELOCITY;

// On overshoot, scale velocity by this factor.
// More gentle since with 60s prediction overshoots are expected.
const OVERSHOOT_DAMPEN = 0.7;

// Catch-up boost when marker falls behind significantly.
const CATCHUP_GAP_FACTOR = 1.2;
const CATCHUP_BOOST = 1.6;

// How much of the measured velocity to trust vs the prior.
// Starts at 0 (all prior), ramps up as we get more data.
const VELOCITY_PRIOR_BLEND_MIN = 0.3;  // minimum trust in measurement
const VELOCITY_PRIOR_BLEND_MAX = 0.85; // maximum trust after many samples
const VELOCITY_PRIOR_RAMP_SAMPLES = 5; // samples to reach max trust

// Angular smoothing
const ANGULAR_LOOKAHEAD_THRESHOLD = 0.7;
const ANGULAR_SMOOTHING_FACTOR = 0.15;

// --- Stop-aware speed modulation ---
// Deceleration zone before a stop (in polyline coord-units).
// ~200m ≈ 0.0018 degrees
const STOP_DECEL_ZONE = 0.0018;
// Acceleration zone after a stop.
// ~120m ≈ 0.0011 degrees
const STOP_ACCEL_ZONE = 0.0011;
// Minimum speed multiplier at a stop (dwell / slow-pass).
const STOP_MIN_SPEED_MULT = 0.25;
// How long the bus "dwells" at a stop in the prediction (ms).
const STOP_DWELL_MS = 4000;

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
        if (cumDist[mid] <= distance) lo = mid;
        else hi = mid - 1;
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
    const pos: Coordinate = [
        A[0] + (B[0] - A[0]) * t,
        A[1] + (B[1] - A[1]) * t,
    ];
    let angle = calculateBearing(A, B);

    const C = polyline[segIdx + 2];
    if (C && t > ANGULAR_LOOKAHEAD_THRESHOLD) {
        const nextAngle = calculateBearing(B, C);
        const progress = (t - ANGULAR_LOOKAHEAD_THRESHOLD) / (1 - ANGULAR_LOOKAHEAD_THRESHOLD);
        angle = interpolateAngle(angle, nextAngle, progress);
    }
    return {position: pos, angle};
}

// ----------------------------------------------------------------------
// Stop-aware speed modulation
// ----------------------------------------------------------------------

/** Convert stop coordinate indices to scalar distances on the polyline. */
function computeStopDistances(
    stopCoordIndices: number[],
    cumDist: number[],
): number[] {
    if (cumDist.length < 2 || stopCoordIndices.length === 0) return [];
    const maxIdx = cumDist.length - 1;
    return stopCoordIndices
        .map(idx => {
            const clamped = Math.max(0, Math.min(idx, maxIdx));
            return cumDist[clamped] ?? 0;
        })
        .sort((a, b) => a - b);
}

/**
 * Returns a speed multiplier [STOP_MIN_SPEED_MULT, 1.0] based on
 * proximity to the nearest upcoming stop.
 *
 * - Far from any stop → 1.0 (full speed)
 * - Approaching a stop (within STOP_DECEL_ZONE) → ramps down
 * - At a stop → STOP_MIN_SPEED_MULT
 * - Leaving a stop (within STOP_ACCEL_ZONE) → ramps back up
 */
function getStopSpeedMultiplier(
    markerDist: number,
    stopDistances: number[],
): number {
    if (stopDistances.length === 0) return 1.0;

    let minMult = 1.0;

    // Binary search for the nearest stop ahead
    let lo = 0, hi = stopDistances.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (stopDistances[mid] < markerDist) lo = mid + 1;
        else hi = mid;
    }

    // Check the stop ahead and the stop just passed
    for (let i = Math.max(0, lo - 1); i <= Math.min(lo, stopDistances.length - 1); i++) {
        const stopDist = stopDistances[i];
        const delta = markerDist - stopDist; // negative = approaching, positive = leaving

        let mult = 1.0;
        if (delta < 0) {
            // Approaching stop
            const distToStop = -delta;
            if (distToStop < STOP_DECEL_ZONE) {
                const progress = 1 - distToStop / STOP_DECEL_ZONE;
                // Smooth easing: cubic
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

        minMult = Math.min(minMult, mult);
    }

    return minMult;
}

/**
 * Blend measured velocity with the city bus base speed prior.
 * Early on (few samples), lean heavily on the prior.
 * As we collect more measurements, trust them more.
 */
function blendVelocityWithPrior(
    measured: number,
    sampleCount: number,
): number {
    const trust = Math.min(
        VELOCITY_PRIOR_BLEND_MAX,
        VELOCITY_PRIOR_BLEND_MIN +
        (VELOCITY_PRIOR_BLEND_MAX - VELOCITY_PRIOR_BLEND_MIN) *
        (sampleCount / VELOCITY_PRIOR_RAMP_SAMPLES),
    );
    return trust * measured + (1 - trust) * CITY_BUS_BASE_VELOCITY;
}

// ----------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------

/**
 * Animates a bus marker along a polyline with aggressive predictive motion.
 *
 * Designed for ~60 second data delay:
 *  1. Uses city bus base speed (~30 km/h) as a prior, blended with
 *     measured velocity as more samples arrive.
 *  2. Forward-projects the bus position by the full data delay.
 *  3. Modulates speed near bus stops — decelerates on approach,
 *     brief dwell, then accelerates away.
 *  4. Allows generous overshoot (up to ~2 polling periods) so the
 *     marker never freezes between updates.
 *  5. On each frame, advances at the blended velocity with stop-aware
 *     speed multiplier, plus exponential catch-up if behind target.
 */
export function useAnimatedPosition(
    targetPosition: Coordinate,
    targetAngle: number,
    options: UseAnimatedPositionOptions = {},
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

    // ---- React state (throttled) ----
    const [state, setState] = useState<AnimatedPositionState>(() => {
        if (shouldSnap && polyline.length >= 2) {
            const snapped = snapPointToPolyline(targetPosition, polyline, {
                segmentHint: snapIndexHint,
                searchRadius: snapIndexRange,
            });
            return {position: snapped.position, angle: targetAngle};
        }
        return {position: targetPosition, angle: targetAngle};
    });

    // ---- Lifecycle ----
    const animFrameRef = useRef<number | null>(null);
    const isFirstDataRef = useRef(true);
    const prevPolylineLenRef = useRef(polyline.length);
    const prevTargetRef = useRef<Coordinate>(targetPosition);
    const resetKeyRef = useRef(resetKey);

    // ---- Animated state (mutated in RAF, read by React on throttle) ----
    const currentPosRef = useRef<Coordinate>(targetPosition);
    const currentAngleRef = useRef<number>(targetAngle);
    const lastStateUpdateRef = useRef(0);

    // ---- Polyline / scalar state ----
    const polylineRef = useRef(polyline);
    const cumDistRef = useRef<number[]>([]);
    const markerDistRef = useRef(0);    // where the marker is (scalar)
    const targetDistRef = useRef(0);    // where we think the bus is (scalar)
    const velocityRef = useRef(0);      // coord-units / ms
    const lastFrameRef = useRef(0);

    // ---- Velocity estimation ----
    const prevDataTimeRef = useRef(0);  // performance.now() of last data arrival
    const prevRawDistRef = useRef(0);   // raw scalar distance of last data point
    const hasDataRef = useRef(false);   // true after first snap
    const sampleCountRef = useRef(0);   // number of velocity samples collected

    // ---- Stop-aware data ----
    const stopDistancesRef = useRef<number[]>([]);

    // ----------------------------------------------------------------
    // Direct MapLibre marker update (bypasses React for 60 fps)
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
        const cumDist = polyline.length >= 2
            ? computeCumulativeDistances(polyline) : [];
        cumDistRef.current = cumDist;
        stopDistancesRef.current = computeStopDistances(stopCoordIndices, cumDist);
    }, [polyline, stopCoordIndices]);

    // ----------------------------------------------------------------
    // Reset on route change (resetKey)
    // ----------------------------------------------------------------
    useEffect(() => {
        if (resetKeyRef.current === resetKey) return;
        resetKeyRef.current = resetKey;

        velocityRef.current = 0;
        prevDataTimeRef.current = 0;
        prevRawDistRef.current = 0;
        hasDataRef.current = false;
        isFirstDataRef.current = true;
        lastFrameRef.current = 0;
        sampleCountRef.current = 0;

        const hasPolyline = polyline.length >= 2;
        let nextPos = targetPosition;
        let nextAngle = targetAngle;

        if (shouldSnap && hasPolyline) {
            const snapped = snapPointToPolyline(targetPosition, polyline, {
                segmentHint: snapIndexHint,
                searchRadius: snapIndexRange,
            });
            nextPos = snapped.position;
            nextAngle = snapped.angle;

            const cumDist = cumDistRef.current;
            const dist = polylineScalarDist(cumDist, snapped.segmentIndex, snapped.t);
            markerDistRef.current = dist;
            targetDistRef.current = dist;
            prevRawDistRef.current = dist;
            hasDataRef.current = true;
        }

        currentPosRef.current = nextPos;
        currentAngleRef.current = nextAngle;
        prevTargetRef.current = targetPosition;
        updateMarkerDirect(nextPos, nextAngle);
        setState({position: nextPos, angle: nextAngle});
    }, [resetKey, targetPosition, targetAngle, polyline, shouldSnap, snapIndexHint, snapIndexRange, updateMarkerDirect]);

    // ----------------------------------------------------------------
    // Handle incoming data (targetPosition changes)
    // ----------------------------------------------------------------
    useEffect(() => {
        const hasPolyline = polyline.length >= 2;
        const polylineJustLoaded = hasPolyline && prevPolylineLenRef.current < 2;
        prevPolylineLenRef.current = polyline.length;

        // ── First data / polyline just arrived ──
        if (isFirstDataRef.current || polylineJustLoaded) {
            isFirstDataRef.current = false;

            if (shouldSnap && hasPolyline) {
                const snapped = snapPointToPolyline(targetPosition, polyline, {
                    segmentHint: snapIndexHint,
                    searchRadius: snapIndexRange,
                });
                const cumDist = cumDistRef.current;
                const dist = polylineScalarDist(cumDist, snapped.segmentIndex, snapped.t);

                markerDistRef.current = dist;
                prevRawDistRef.current = dist;
                hasDataRef.current = true;
                prevDataTimeRef.current = performance.now();
                sampleCountRef.current = 0;

                // Start with city bus base speed and project forward
                // immediately — the data is already ~60s old.
                velocityRef.current = INITIAL_CRAWL_VELOCITY;
                const projDist = INITIAL_CRAWL_VELOCITY * dataDelayMs;
                const totalDist = cumDist[cumDist.length - 1] ?? 0;
                targetDistRef.current = Math.min(dist + projDist, totalDist);

                currentPosRef.current = snapped.position;
                currentAngleRef.current = targetAngle;
                updateMarkerDirect(snapped.position, targetAngle);
                setState({position: snapped.position, angle: targetAngle});
            } else {
                currentPosRef.current = targetPosition;
                currentAngleRef.current = targetAngle;
                setState({position: targetPosition, angle: targetAngle});
            }
            prevTargetRef.current = targetPosition;
            return;
        }

        // ── Same position → skip ──
        const prev = prevTargetRef.current;
        if (targetPosition[0] === prev[0] && targetPosition[1] === prev[1]) return;
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

        // ── Backward detection ──
        if (hasDataRef.current && rawDist < prevRawDistRef.current) {
            const backMeters = getApproxDistanceMeters(
                currentPosRef.current, snapped.position);
            if (backMeters <= BACKWARD_JITTER_METERS) {
                // Small jitter — ignore
                prevRawDistRef.current = rawDist;
                return;
            }
            // Large backward jump — teleport
            markerDistRef.current = rawDist;
            targetDistRef.current = rawDist;
            velocityRef.current = CITY_BUS_BASE_VELOCITY; // restart with prior
            sampleCountRef.current = 0;
            prevRawDistRef.current = rawDist;
            prevDataTimeRef.current = performance.now();
            currentPosRef.current = snapped.position;
            currentAngleRef.current = snapped.angle;
            updateMarkerDirect(snapped.position, snapped.angle);
            setState({position: snapped.position, angle: snapped.angle});
            return;
        }

        // ── Estimate velocity (blend measured with prior) ──
        const now = performance.now();
        const dtMs = prevDataTimeRef.current > 0 ? now - prevDataTimeRef.current : 0;

        if (dtMs > MIN_DT_FOR_VELOCITY_MS && hasDataRef.current) {
            const moved = rawDist - prevRawDistRef.current;
            const rawV = Math.max(0, moved / dtMs);
            const clampedV = Math.min(rawV, MAX_VELOCITY);

            sampleCountRef.current++;
            const samples = sampleCountRef.current;

            // EMA on measured velocity
            const measuredEMA = velocityRef.current <= STOP_THRESHOLD
                ? clampedV
                : VELOCITY_SMOOTHING * clampedV
                  + (1 - VELOCITY_SMOOTHING) * velocityRef.current;

            // Blend with city bus base speed prior
            velocityRef.current = Math.min(
                blendVelocityWithPrior(measuredEMA, samples),
                MAX_VELOCITY,
            );
        }

        prevRawDistRef.current = rawDist;
        prevDataTimeRef.current = now;
        hasDataRef.current = true;

        // ── Aggressive forward projection ──
        // Data is stale by ~dataDelayMs. Project the bus forward by
        // that amount, using the blended velocity.
        let projDist = 0;
        const v = velocityRef.current;
        if (v > STOP_THRESHOLD) {
            projDist = v * dataDelayMs;
            // Account for stop dwell times in the projection window.
            // Each stop the bus would pass through in the projection
            // adds a dwell penalty.
            const stopDists = stopDistancesRef.current;
            if (stopDists.length > 0) {
                let stopsInProjection = 0;
                for (let i = 0; i < stopDists.length; i++) {
                    const sd = stopDists[i];
                    if (sd > rawDist && sd < rawDist + projDist) {
                        stopsInProjection++;
                    }
                }
                // Reduce projection by dwell time equivalent distance per stop
                const dwellDistPerStop = v * STOP_DWELL_MS;
                projDist = Math.max(
                    projDist * 0.3,
                    projDist - stopsInProjection * dwellDistPerStop,
                );
            }
        }
        const newTarget = Math.min(rawDist + projDist, totalDist);

        // ── Reconcile target vs marker ──
        targetDistRef.current = newTarget;
        const marker = markerDistRef.current;

        if (newTarget >= marker) {
            // Normal — data target is ahead of or at marker.
            const gap = newTarget - marker;
            const nominalStep = v * 3000;
            if (nominalStep > 0 && gap > nominalStep * CATCHUP_GAP_FACTOR) {
                velocityRef.current = Math.min(
                    velocityRef.current * CATCHUP_BOOST, MAX_VELOCITY);
            }
        } else {
            // Overshoot — marker ran ahead. Gently slow down.
            velocityRef.current *= OVERSHOOT_DAMPEN;
            if (velocityRef.current < STOP_THRESHOLD) {
                velocityRef.current = CITY_BUS_BASE_VELOCITY * 0.5;
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetPosition[0], targetPosition[1], targetAngle, polyline, shouldSnap, snapIndexHint, snapIndexRange, dataDelayMs, updateMarkerDirect]);

    // ----------------------------------------------------------------
    // Animation loop — always running, always advancing
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

            const v = velocityRef.current;
            const totalDist = cumDist[cumDist.length - 1];
            let dist = markerDistRef.current;

            if (v > 0) {
                const target = targetDistRef.current;
                const gap = target - dist;

                // Stop-aware speed multiplier
                const stopMult = getStopSpeedMultiplier(
                    dist, stopDistancesRef.current);

                let advance: number;
                if (gap > 0) {
                    // Behind target — advance at modulated velocity + catch-up.
                    const baseAdvance = v * stopMult * clampedDt;
                    const catchup = gap * Math.min(clampedDt / CATCHUP_TAU_MS, 1);
                    advance = baseAdvance + catchup;
                } else {
                    // At or ahead of target — coast forward with stop modulation.
                    // Allow generous overshoot (2 polling periods worth)
                    // since our 60s projection will often undershoot reality.
                    const maxOvershoot = v * 6000;
                    const overshootRoom = maxOvershoot - (-gap);
                    if (overshootRoom > 0) {
                        const coastFactor = Math.min(overshootRoom / maxOvershoot, 1);
                        advance = v * stopMult * clampedDt * coastFactor;
                    } else {
                        advance = 0;
                    }
                }

                if (advance > 0) {
                    dist = Math.min(dist + advance, totalDist);
                    markerDistRef.current = dist;
                }
            }

            // Convert scalar → world position
            const {segIdx, t} = scalarToSegT(cumDist, dist);
            const {position: pos, angle: pathAngle} = positionFromSegT(pl, segIdx, t);
            const angle = interpolateAngle(
                currentAngleRef.current, pathAngle, ANGULAR_SMOOTHING_FACTOR);

            currentPosRef.current = pos;
            currentAngleRef.current = angle;

            const directOk = updateMarkerDirect(pos, angle);

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
