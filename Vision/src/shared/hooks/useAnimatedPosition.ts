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
}

// ----------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------

// Ignore backward jumps smaller than this (GPS jitter).
const BACKWARD_JITTER_METERS = 12;

// React state update throttle — 20 Hz is plenty for UI consumers.
const STATE_UPDATE_THROTTLE_MS = 50;

// Cap per-frame dt to prevent huge jumps when tab was backgrounded.
const MAX_DT_MS = 200;

// How fast the marker catches up to the target when it falls behind.
// τ=1000ms → 63 % of the gap closed in 1 second.
const CATCHUP_TAU_MS = 1000;

// Velocity EMA weight — 0.6 blends 60 % new sample, 40 % history.
const VELOCITY_SMOOTHING = 0.6;

// Skip velocity calc if two data points arrive within this window.
const MIN_DT_FOR_VELOCITY_MS = 400;

// Hard ceiling for velocity (coord-units / ms) ≈ 120 km/h.
const MAX_VELOCITY = 0.0003;

// Below this the bus is considered stopped.
const STOP_THRESHOLD = 0.000005;

// Default estimated staleness of incoming position data.
const DEFAULT_DATA_DELAY_MS = 15000;

// Initial crawl velocity (coord-units/ms) applied before real velocity
// is estimated. ~20 km/h — just enough to show the marker is alive.
// (1 degree ≈ 111 km, so 5e-8 deg/ms ≈ 5.5 m/s ≈ 20 km/h)
const INITIAL_CRAWL_VELOCITY = 0.00000005;

// On overshoot, scale velocity by this factor (coast, don't stop).
const OVERSHOOT_DAMPEN = 0.6;

// If marker falls behind by more than this many "polling intervals"
// worth of distance, boost velocity to catch up.
const CATCHUP_GAP_FACTOR = 1.5;
const CATCHUP_BOOST = 1.4;

// Angular smoothing
const ANGULAR_LOOKAHEAD_THRESHOLD = 0.7;
const ANGULAR_SMOOTHING_FACTOR = 0.15;

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
// Hook
// ----------------------------------------------------------------------

/**
 * Animates a bus marker along a polyline with continuous motion.
 *
 * Design:
 *  1. The marker **always moves forward** at its estimated velocity.
 *     It never pauses between data updates.
 *  2. When new data arrives, we compute a "target" (raw position +
 *     forward projection) and reconcile:
 *     - Target ahead of marker → keep velocity, or boost if gap is large.
 *     - Target behind marker (overshoot) → gently reduce velocity.
 *  3. Each frame, the marker advances by `velocity × dt`. If it is
 *     behind the target, an exponential catch-up term is added.
 *     If it is ahead, it simply coasts — no pull-back.
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
    // Sync cumulative distances when polyline changes
    // ----------------------------------------------------------------
    useEffect(() => {
        polylineRef.current = polyline;
        cumDistRef.current = polyline.length >= 2
            ? computeCumulativeDistances(polyline) : [];
    }, [polyline]);

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
                targetDistRef.current = dist;
                prevRawDistRef.current = dist;
                hasDataRef.current = true;
                prevDataTimeRef.current = performance.now();

                // Start with a small crawl velocity so the marker begins
                // moving immediately. It will be replaced by the real
                // estimate as soon as the second data point arrives.
                // Don't project the target — just let the tick loop
                // nudge the marker forward frame by frame.
                velocityRef.current = INITIAL_CRAWL_VELOCITY;

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
            velocityRef.current = 0;
            prevRawDistRef.current = rawDist;
            prevDataTimeRef.current = performance.now();
            currentPosRef.current = snapped.position;
            currentAngleRef.current = snapped.angle;
            updateMarkerDirect(snapped.position, snapped.angle);
            setState({position: snapped.position, angle: snapped.angle});
            return;
        }

        // ── Estimate velocity ──
        const now = performance.now();
        const dtMs = prevDataTimeRef.current > 0 ? now - prevDataTimeRef.current : 0;

        if (dtMs > MIN_DT_FOR_VELOCITY_MS && hasDataRef.current) {
            const moved = rawDist - prevRawDistRef.current;
            const v = Math.max(0, moved / dtMs);
            const clamped = Math.min(v, MAX_VELOCITY);

            velocityRef.current = velocityRef.current === 0
                ? clamped
                : Math.min(VELOCITY_SMOOTHING * clamped
                    + (1 - VELOCITY_SMOOTHING) * velocityRef.current,
                    MAX_VELOCITY);
        }

        prevRawDistRef.current = rawDist;
        prevDataTimeRef.current = now;
        hasDataRef.current = true;

        // ── Forward projection ──
        // Data is stale by ~dataDelayMs. Project the bus forward.
        let projDist = 0;
        if (velocityRef.current > STOP_THRESHOLD) {
            projDist = velocityRef.current * dataDelayMs;
            projDist = Math.min(projDist, MAX_VELOCITY * dataDelayMs);
        }
        const newTarget = Math.min(rawDist + projDist, totalDist);

        // ── Reconcile target vs marker ──
        targetDistRef.current = newTarget;
        const marker = markerDistRef.current;

        if (newTarget >= marker) {
            // Normal case — data is ahead or at marker.
            const gap = newTarget - marker;
            const nominalStep = velocityRef.current * 3000;
            if (nominalStep > 0 && gap > nominalStep * CATCHUP_GAP_FACTOR) {
                velocityRef.current = Math.min(
                    velocityRef.current * CATCHUP_BOOST, MAX_VELOCITY);
            }
        } else {
            // Overshoot — marker ran ahead. Slow down gently.
            velocityRef.current *= OVERSHOOT_DAMPEN;
            if (velocityRef.current < STOP_THRESHOLD) velocityRef.current = 0;
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

                let advance: number;
                if (gap > 0) {
                    // Behind target — advance at velocity + catch-up correction.
                    advance = v * clampedDt + gap * Math.min(clampedDt / CATCHUP_TAU_MS, 1);
                } else {
                    // At or ahead of target — coast forward slowly.
                    // Allow a small overshoot (up to ~1 polling interval ahead)
                    // so the marker doesn't freeze while waiting for data.
                    const maxOvershoot = v * 3000; // ~one polling period
                    const overshootRoom = maxOvershoot - (-gap);
                    if (overshootRoom > 0) {
                        advance = v * clampedDt * Math.min(overshootRoom / maxOvershoot, 1);
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
