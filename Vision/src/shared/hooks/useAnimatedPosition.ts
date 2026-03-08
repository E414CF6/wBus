"use client";

import { MAP_SETTINGS } from "@core/constants/env";
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
// Types & Constants
// ----------------------------------------------------------------------

interface AnimatedPositionState {
    position: Coordinate;
    angle: number;
}

interface UseAnimatedPositionOptions {
    /** Animation duration in ms. Defaults to global setting. */
    duration?: number;
    /** The route path to snap the marker to. */
    polyline?: Coordinate[];
    /** If true, the marker is projected onto the polyline. */
    snapToPolyline?: boolean;
    /** Optional segment hint to keep snapping on the expected path. */
    snapIndexHint?: number | null;
    /** Optional search radius (segment count) around the hint. */
    snapIndexRange?: number;
    /** Forces an immediate re-sync when the key changes (e.g. route change). */
    resetKey?: string | number;
    /** Optional ref to MapLibre marker for direct DOM updates (bypasses React state for smoother animation) */
    markerRef?: React.RefObject<Marker | null>;
    /** Polling interval in ms. Used to align animation duration with data arrival. */
    pollingIntervalMs?: number;
    /** Estimated data delay in ms. How old the API data is when received.
     *  This is the primary driver for forward projection distance. */
    dataDelayMs?: number;
}

// Backward jitter threshold — ignore small backward movements below this distance.
const BACKWARD_JITTER_METERS = 12;

// Throttle state updates to reduce React re-renders (update every N ms)
const STATE_UPDATE_THROTTLE_MS = 50;

// Maximum delta-time per frame (ms). Caps dt when tab was backgrounded
// to prevent huge jumps after regaining focus.
const MAX_DT_MS = 200;

// Correction time constant (ms). The signed error between the animated
// marker and the target decays as e^(-t/τ). At τ=2000ms, 63% of any
// position gap is closed within 2 seconds.
const CORRECTION_TAU_MS = 2000;

// Velocity estimation constants for forward projection.
const VELOCITY_SMOOTHING = 0.5;           // EMA weight for new velocity samples
const MIN_TARGET_INTERVAL_MS = 500;        // Ignore velocity calc for very rapid target changes
const MAX_VELOCITY_EUCLIDEAN = 0.0003;     // Cap: ~33 m/s in coordinate units (~120 km/h)
const DEFAULT_DATA_DELAY_MS = 20000;       // Fallback data delay

// Below this velocity the bus is considered stopped — disable movement.
const STOP_VELOCITY_THRESHOLD = 0.000006;

// Minimum velocity samples before enabling forward projection and continuous motion.
const MIN_PROJECTION_SAMPLES = 2;

// When an overshoot is detected, dampen velocity to prevent repeated overshoots.
const OVERSHOOT_VELOCITY_DAMPEN = 0.3;

// Angular smoothing constants
const ANGULAR_LOOKAHEAD_THRESHOLD = 0.7;   // Start interpolating to next segment at 70% of current segment
const ANGULAR_SMOOTHING_FACTOR = 0.15;     // EMA factor for frame-to-frame angle smoothing

// Velocity consistency tracking — modulates projection confidence.
const CONSISTENCY_WINDOW = 5;
const CONSISTENCY_RAMP_SAMPLES = 3;

// Acceleration estimation constants
const ACCELERATION_SMOOTHING = 0.35;
const MAX_ACCELERATION = 0.0000002;

// ----------------------------------------------------------------------
// Pure Helper Functions
// ----------------------------------------------------------------------

/** Precompute cumulative Euclidean distances along a polyline. */
function computeCumulativeDistances(
    polyline: readonly Coordinate[]
): number[] {
    const n = polyline.length;
    if (n < 2) return n === 1 ? [0] : [];
    const cumDist = new Array<number>(n);
    cumDist[0] = 0;
    for (let i = 1; i < n; i++) {
        cumDist[i] = cumDist[i - 1] + getEuclideanDistance(polyline[i - 1], polyline[i]);
    }
    return cumDist;
}

/** Convert a (segmentIndex, t) pair to a scalar distance along the polyline. */
function polylineScalarDist(cumDist: number[], segIdx: number, t: number): number {
    const segStart = cumDist[segIdx] ?? 0;
    const segEnd = cumDist[segIdx + 1] ?? segStart;
    return segStart + (segEnd - segStart) * t;
}

/** Convert a scalar distance back to (segmentIndex, t) via binary search. */
function scalarToSegT(
    cumDist: number[],
    distance: number
): { segIdx: number; t: number } {
    const n = cumDist.length;
    if (n < 2 || distance <= 0) return { segIdx: 0, t: 0 };
    const totalDist = cumDist[n - 1];
    if (distance >= totalDist) return { segIdx: n - 2, t: 1 };

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
    return { segIdx, t };
}

/** Compute position and bearing from (segmentIndex, t) with angular look-ahead. */
function positionFromSegT(
    polyline: readonly Coordinate[],
    segIdx: number,
    t: number
): { position: Coordinate; angle: number } {
    const A = polyline[segIdx];
    const B = polyline[segIdx + 1] ?? A;
    const pos: Coordinate = [
        A[0] + (B[0] - A[0]) * t,
        A[1] + (B[1] - A[1]) * t,
    ];
    let angle = calculateBearing(A, B);

    // Look-ahead: start rotating toward next segment at 70% of current segment
    const C = polyline[segIdx + 2];
    if (C && t > ANGULAR_LOOKAHEAD_THRESHOLD) {
        const nextAngle = calculateBearing(B, C);
        const progress = (t - ANGULAR_LOOKAHEAD_THRESHOLD) / (1 - ANGULAR_LOOKAHEAD_THRESHOLD);
        angle = interpolateAngle(angle, nextAngle, progress);
    }
    return { position: pos, angle };
}

// ----------------------------------------------------------------------
// Hook Definition
// ----------------------------------------------------------------------

/**
 * Continuous velocity-driven animation hook.
 *
 * Instead of animating from point A to B on each data update, the bus
 * **always moves** along the polyline at its estimated velocity.  Incoming
 * data acts as a correction signal: it updates the velocity estimate and
 * the "target" position, and the marker smoothly converges via exponential
 * error decay (time constant = CORRECTION_TAU_MS).
 *
 * Dead-reckoning keeps both the target and the marker advancing between
 * data updates so the motion never pauses or stutters.
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
    } = options;

    // -- React state (throttled updates for external consumers) --
    const [state, setState] = useState<AnimatedPositionState>(() => {
        if (shouldSnap && polyline.length >= 2) {
            const snapped = snapPointToPolyline(targetPosition, polyline, {
                segmentHint: snapIndexHint,
                searchRadius: snapIndexRange,
            });
            return { position: snapped.position, angle: targetAngle };
        }
        return { position: targetPosition, angle: targetAngle };
    });

    // -- Lifecycle refs --
    const animFrameRef = useRef<number | null>(null);
    const isFirstRender = useRef(true);
    const hasInitialSnapped = useRef(false);
    const prevPolylineLengthRef = useRef(polyline.length);
    const prevTargetRef = useRef<Coordinate>(targetPosition);
    const prevSnapIndexRef = useRef<number | null>(snapIndexHint);
    const resetKeyRef = useRef<string | number | undefined>(resetKey);

    // -- Animated state (mutated by RAF, read by React on throttle) --
    const currentPosRef = useRef<Coordinate>(targetPosition);
    const currentAngleRef = useRef<number>(targetAngle);
    const lastStateUpdateRef = useRef<number>(0);

    // -- Polyline scalar state --
    const polylineRef = useRef(polyline);
    const cumulativeDistRef = useRef<number[]>([]);
    const currentDistRef = useRef<number>(0);   // animated marker position (scalar along polyline)
    const targetDistRef = useRef<number>(0);    // estimated real bus position (scalar)
    const velocityRef = useRef<number>(0);      // base velocity (coord-units/ms)
    const lastFrameTimeRef = useRef<number>(0);

    // -- Velocity estimation refs --
    const lastTargetChangeTimeRef = useRef<number>(0);
    const velocityEMARef = useRef<number>(0);
    const velocitySamplesRef = useRef<number>(0);
    const rawEndPosRef = useRef<Coordinate>(targetPosition);
    const rawEndSegIdxRef = useRef<number>(0);
    const rawEndTRef = useRef<number>(0);
    const hasRawEndRef = useRef<boolean>(false);

    // -- Acceleration tracking --
    const accelerationEMARef = useRef<number>(0);
    const prevVelocityRef = useRef<number>(0);

    // -- Velocity consistency tracking --
    const velocityHistoryRef = useRef<number[]>([]);

    // ----------------------------------------------------------------
    // Direct MapLibre marker update (bypasses React for 60fps perf)
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
    // Recompute cumulative distances when the polyline changes
    // ----------------------------------------------------------------
    useEffect(() => {
        polylineRef.current = polyline;
        cumulativeDistRef.current = polyline.length >= 2
            ? computeCumulativeDistances(polyline)
            : [];
    }, [polyline]);

    // ----------------------------------------------------------------
    // Reset on route change (resetKey)
    // ----------------------------------------------------------------
    useEffect(() => {
        if (resetKeyRef.current === resetKey) return;
        resetKeyRef.current = resetKey;

        // Reset velocity estimation
        velocityEMARef.current = 0;
        velocitySamplesRef.current = 0;
        velocityRef.current = 0;
        lastTargetChangeTimeRef.current = 0;
        hasRawEndRef.current = false;
        accelerationEMARef.current = 0;
        prevVelocityRef.current = 0;
        velocityHistoryRef.current = [];
        lastFrameTimeRef.current = 0;

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

            const cumDist = cumulativeDistRef.current;
            const dist = polylineScalarDist(cumDist, snapped.segmentIndex, snapped.t);
            currentDistRef.current = dist;
            targetDistRef.current = dist;
            prevSnapIndexRef.current = snapIndexHint ?? snapped.segmentIndex;
            rawEndSegIdxRef.current = snapped.segmentIndex;
            rawEndTRef.current = snapped.t;
            rawEndPosRef.current = snapped.position;
            hasRawEndRef.current = true;
        }

        currentPosRef.current = nextPos;
        currentAngleRef.current = nextAngle;
        prevTargetRef.current = targetPosition;
        updateMarkerDirect(nextPos, nextAngle);
        setState({ position: nextPos, angle: nextAngle });
    }, [resetKey, targetPosition, targetAngle, polyline, shouldSnap, snapIndexHint, snapIndexRange, updateMarkerDirect]);

    // ----------------------------------------------------------------
    // Handle data arrival (targetPosition changes)
    // ----------------------------------------------------------------
    useEffect(() => {
        const hasPolyline = polyline.length >= 2;
        const polylineJustLoaded = hasPolyline && prevPolylineLengthRef.current < 2;
        prevPolylineLengthRef.current = polyline.length;

        // ── First render / polyline just loaded ──
        if (isFirstRender.current || (polylineJustLoaded && !hasInitialSnapped.current)) {
            isFirstRender.current = false;
            let initPos: Coordinate = targetPosition;

            if (shouldSnap && hasPolyline) {
                const snapped = snapPointToPolyline(targetPosition, polyline, {
                    segmentHint: snapIndexHint,
                    searchRadius: snapIndexRange,
                });
                initPos = snapped.position;
                hasInitialSnapped.current = true;

                const cumDist = cumulativeDistRef.current;
                const dist = polylineScalarDist(cumDist, snapped.segmentIndex, snapped.t);
                currentDistRef.current = dist;
                targetDistRef.current = dist;

                rawEndPosRef.current = snapped.position;
                rawEndSegIdxRef.current = snapped.segmentIndex;
                rawEndTRef.current = snapped.t;
                hasRawEndRef.current = true;
                prevSnapIndexRef.current = snapIndexHint ?? snapped.segmentIndex;
                updateMarkerDirect(initPos, targetAngle);
            }

            currentPosRef.current = initPos;
            currentAngleRef.current = targetAngle;
            setState({ position: initPos, angle: targetAngle });
            prevTargetRef.current = targetPosition;
            return;
        }

        // ── Same position → skip ──
        const prev = prevTargetRef.current;
        if (targetPosition[0] === prev[0] && targetPosition[1] === prev[1]) {
            if (snapIndexHint !== null && snapIndexHint !== undefined) {
                prevSnapIndexRef.current = snapIndexHint;
            }
            return;
        }
        prevTargetRef.current = targetPosition;

        if (!shouldSnap || !hasPolyline) return;

        const cumDist = cumulativeDistRef.current;
        if (cumDist.length < 2) return;

        const endSnapped = snapPointToPolyline(targetPosition, polyline, {
            segmentHint: snapIndexHint,
            searchRadius: snapIndexRange,
        });

        // ── Backward detection ──
        if (hasRawEndRef.current) {
            const rawDist = polylineScalarDist(cumDist, rawEndSegIdxRef.current, rawEndTRef.current);
            const newDist = polylineScalarDist(cumDist, endSnapped.segmentIndex, endSnapped.t);

            if (newDist < rawDist) {
                const backMeters = getApproxDistanceMeters(rawEndPosRef.current, endSnapped.position);
                if (backMeters <= BACKWARD_JITTER_METERS) {
                    // Small jitter — ignore but update raw refs
                    rawEndPosRef.current = endSnapped.position;
                    rawEndSegIdxRef.current = endSnapped.segmentIndex;
                    rawEndTRef.current = endSnapped.t;
                    return;
                }
                // Large backward jump — teleport and reset
                const dist = polylineScalarDist(cumDist, endSnapped.segmentIndex, endSnapped.t);
                currentDistRef.current = dist;
                targetDistRef.current = dist;
                velocityEMARef.current = 0;
                velocitySamplesRef.current = 0;
                velocityRef.current = 0;
                lastTargetChangeTimeRef.current = 0;
                accelerationEMARef.current = 0;
                prevVelocityRef.current = 0;
                velocityHistoryRef.current = [];
                currentPosRef.current = endSnapped.position;
                currentAngleRef.current = endSnapped.angle;
                rawEndPosRef.current = endSnapped.position;
                rawEndSegIdxRef.current = endSnapped.segmentIndex;
                rawEndTRef.current = endSnapped.t;
                prevSnapIndexRef.current = snapIndexHint ?? endSnapped.segmentIndex;
                updateMarkerDirect(endSnapped.position, endSnapped.angle);
                setState({ position: endSnapped.position, angle: endSnapped.angle });
                return;
            }
        }

        // ── Velocity & acceleration estimation (EMA) ──
        const now = performance.now();
        const dtMs = lastTargetChangeTimeRef.current > 0
            ? now - lastTargetChangeTimeRef.current : 0;
        lastTargetChangeTimeRef.current = now;

        if (dtMs > MIN_TARGET_INTERVAL_MS && hasRawEndRef.current) {
            const dist = getEuclideanDistance(rawEndPosRef.current, endSnapped.position);
            const v = dist / dtMs;
            const prevVelocity = velocityEMARef.current;

            velocityEMARef.current = velocitySamplesRef.current === 0
                ? Math.min(v, MAX_VELOCITY_EUCLIDEAN)
                : Math.min(
                    VELOCITY_SMOOTHING * v + (1 - VELOCITY_SMOOTHING) * velocityEMARef.current,
                    MAX_VELOCITY_EUCLIDEAN
                );
            velocitySamplesRef.current++;

            // Track acceleration
            if (velocitySamplesRef.current >= 2 && dtMs > 0) {
                const rawAccel = (velocityEMARef.current - prevVelocity) / dtMs;
                const clampedAccel = Math.max(-MAX_ACCELERATION, Math.min(MAX_ACCELERATION, rawAccel));
                accelerationEMARef.current = prevVelocityRef.current === 0
                    ? clampedAccel
                    : ACCELERATION_SMOOTHING * clampedAccel + (1 - ACCELERATION_SMOOTHING) * accelerationEMARef.current;
            }
            prevVelocityRef.current = velocityEMARef.current;

            // Velocity history for consistency tracking
            const history = velocityHistoryRef.current;
            history.push(velocityEMARef.current);
            if (history.length > CONSISTENCY_WINDOW) history.shift();
        }

        // Save raw snap data for next velocity calc
        rawEndPosRef.current = endSnapped.position;
        rawEndSegIdxRef.current = endSnapped.segmentIndex;
        rawEndTRef.current = endSnapped.t;
        hasRawEndRef.current = true;
        prevSnapIndexRef.current = snapIndexHint ?? endSnapped.segmentIndex;

        // ── Forward projection (kinematic with consistency-based confidence) ──
        const rawDist = polylineScalarDist(cumDist, endSnapped.segmentIndex, endSnapped.t);
        const totalPolylineDist = cumDist[cumDist.length - 1];
        let projDist = 0;

        if (velocitySamplesRef.current > 0 && velocityEMARef.current > STOP_VELOCITY_THRESHOLD) {
            const rampConfidence = Math.min(velocitySamplesRef.current / CONSISTENCY_RAMP_SAMPLES, 1);

            let consistencyConfidence = 1;
            const history = velocityHistoryRef.current;
            if (history.length >= 3) {
                const mean = history.reduce((s, v) => s + v, 0) / history.length;
                if (mean > 0) {
                    const variance = history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length;
                    const cv = Math.sqrt(variance) / mean;
                    consistencyConfidence = Math.max(0.5, 1 - cv * 0.5);
                }
            }

            const confidence = rampConfidence * consistencyConfidence;
            const t_proj = dataDelayMs;
            const v = velocityEMARef.current;
            const a = accelerationEMARef.current;
            const v_end = Math.max(0, v + a * t_proj);
            projDist = ((v + v_end) / 2) * t_proj * confidence;

            const maxProjection = MAX_VELOCITY_EUCLIDEAN * dataDelayMs;
            projDist = Math.min(projDist, maxProjection);
        }

        const newTargetDist = Math.min(rawDist + projDist, totalPolylineDist);

        // ── Overshoot detection ──
        // If the animated marker is already ahead of the new target,
        // hold position and dampen velocity rather than pulling backward.
        if (currentDistRef.current > newTargetDist) {
            velocityEMARef.current *= OVERSHOOT_VELOCITY_DAMPEN;
            targetDistRef.current = currentDistRef.current;
            velocityRef.current = velocityEMARef.current < STOP_VELOCITY_THRESHOLD
                ? 0 : velocityEMARef.current;
            return;
        }

        targetDistRef.current = newTargetDist;

        // Update base velocity
        if (velocitySamplesRef.current >= MIN_PROJECTION_SAMPLES) {
            velocityRef.current = velocityEMARef.current < STOP_VELOCITY_THRESHOLD
                ? 0 : velocityEMARef.current;
        }

        // On the first valid projection, sync position to avoid an initial speed burst
        // (the forward projection may place the target far ahead of the marker).
        if (velocitySamplesRef.current === MIN_PROJECTION_SAMPLES) {
            currentDistRef.current = newTargetDist;
            const { segIdx, t } = scalarToSegT(cumDist, newTargetDist);
            const { position, angle } = positionFromSegT(polyline, segIdx, t);
            currentPosRef.current = position;
            currentAngleRef.current = angle;
            updateMarkerDirect(position, angle);
            setState({ position, angle });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetPosition[0], targetPosition[1], targetAngle, polyline, shouldSnap, snapIndexHint, snapIndexRange, dataDelayMs, updateMarkerDirect]);

    // ----------------------------------------------------------------
    // Continuous animation loop (always running)
    // ----------------------------------------------------------------
    useEffect(() => {
        const tick = (now: number) => {
            const pl = polylineRef.current;
            const cumDist = cumulativeDistRef.current;

            if (pl.length < 2 || cumDist.length < 2) {
                lastFrameTimeRef.current = now;
                animFrameRef.current = requestAnimationFrame(tick);
                return;
            }

            const dt = lastFrameTimeRef.current > 0 ? now - lastFrameTimeRef.current : 0;
            lastFrameTimeRef.current = now;
            const clampedDt = Math.min(dt, MAX_DT_MS);

            const velocity = velocityRef.current;
            const totalDist = cumDist[cumDist.length - 1];

            // Dead-reckon the target forward at base velocity
            if (velocity > 0) {
                targetDistRef.current = Math.min(
                    targetDistRef.current + velocity * clampedDt,
                    totalDist
                );
            }

            let currentDist = currentDistRef.current;
            const error = targetDistRef.current - currentDist;

            // Proportional correction: error decays as e^(-t/τ)
            const correction = error * Math.min(clampedDt / CORRECTION_TAU_MS, 1);

            // Advance: base velocity + correction
            const advance = velocity * clampedDt + correction;

            if (advance > 0) {
                currentDist = Math.min(currentDist + advance, totalDist);
            }
            currentDistRef.current = currentDist;

            // Convert scalar distance to polyline position
            const { segIdx, t } = scalarToSegT(cumDist, currentDist);
            const { position: pos, angle: pathAngle } = positionFromSegT(pl, segIdx, t);

            // Angular smoothing (EMA)
            const angle = interpolateAngle(currentAngleRef.current, pathAngle, ANGULAR_SMOOTHING_FACTOR);

            currentPosRef.current = pos;
            currentAngleRef.current = angle;

            const directUpdateSuccess = updateMarkerDirect(pos, angle);

            // Throttled React state update
            const timeSinceLastUpdate = now - lastStateUpdateRef.current;
            if (!directUpdateSuccess || timeSinceLastUpdate >= STATE_UPDATE_THROTTLE_MS) {
                lastStateUpdateRef.current = now;
                setState({ position: pos, angle });
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
