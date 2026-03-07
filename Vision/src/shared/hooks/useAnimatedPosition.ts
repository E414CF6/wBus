"use client";

import { MAP_SETTINGS } from "@core/constants/env";
import {
    advanceAlongPolyline,
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

// Thresholds for backward movement detection
const BACKWARD_T_EPSILON = 1e-3;
const BACKWARD_JITTER_METERS = 12;

// Throttle state updates to reduce React re-renders (update every N ms)
const STATE_UPDATE_THROTTLE_MS = 50;

// Maximum duration (ms) to coast along the polyline after interpolation completes.
// Covers delayed polling responses without pushing the marker too far.
const MAX_COAST_MS = 3000;

// Time constant (ms) for exponential decay during coast phase.
// Coast speed decays as v(t) = v0 * e^(-t/τ), preventing overshoot
// while keeping the marker moving smoothly between polling updates.
const COAST_DECAY_TAU_MS = 1500;

// How much to multiply velocity EMA when an overshoot is detected.
// Dampens future projection/coast to prevent repeated overshoots.
const OVERSHOOT_VELOCITY_DAMPEN = 0.3;

// Coast entry speed ratio.  Smoothstep easing ends at ~0 velocity;
// multiply the base coast speed by this factor so the Phase 1→2
// transition doesn't jump from "nearly stopped" to "full speed".
const COAST_ENTRY_SPEED_RATIO = 0.35;

// Below this velocity (coord-units/ms, ≈ 2 km/h) the bus is likely
// stopped at a bus stop — skip coast entirely so the marker rests.
const STOP_VELOCITY_THRESHOLD = 0.000006;

// Velocity estimation constants for forward projection.
// Polling data is always behind real-time; these constants control how we
// extrapolate forward to show the bus closer to its *current* position.
const VELOCITY_SMOOTHING = 0.4;           // EMA weight for new velocity samples (higher = more responsive)
const MIN_TARGET_INTERVAL_MS = 500;        // Ignore velocity calc for very rapid target changes
const MAX_VELOCITY_EUCLIDEAN = 0.0003;     // Cap: ~33 m/s in coordinate units (~120 km/h)
const DEFAULT_POLLING_INTERVAL_MS = 3000;  // Fallback polling interval
const DEFAULT_DATA_DELAY_MS = 10000;       // Fallback data delay — how old the API data typically is

// Acceleration estimation constants
const ACCELERATION_SMOOTHING = 0.35;       // EMA weight for acceleration (slightly less responsive than velocity)
const MAX_ACCELERATION = 0.0000002;        // Cap acceleration magnitude (coord-units/ms²)

// Velocity consistency tracking — used to modulate projection confidence.
// A bus at steady cruising speed should project aggressively; a bus with
// erratic speed changes (stop-and-go) should project conservatively.
const CONSISTENCY_WINDOW = 5;              // Track last N velocity samples for CV calculation
const CONSISTENCY_RAMP_SAMPLES = 5;        // Need this many samples before full projection confidence

// Angular smoothing constants
const ANGULAR_LOOKAHEAD_THRESHOLD = 0.7;   // Start interpolating to next segment at 70% of current segment
const ANGULAR_SMOOTHING_FACTOR = 0.15;     // EMA factor for frame-to-frame angle smoothing

// ----------------------------------------------------------------------
// Pure Helper Functions
// ----------------------------------------------------------------------

function isBackwardProgress(
    startSegIdx: number,
    startT: number,
    endSegIdx: number,
    endT: number
): boolean {
    if (endSegIdx < startSegIdx) return true;
    if (endSegIdx > startSegIdx) return false;
    return endT < startT - BACKWARD_T_EPSILON;
}

function buildPolylinePath(
    polyline: Coordinate[],
    startPos: Coordinate,
    startSegIdx: number,
    endPos: Coordinate,
    endSegIdx: number
): Coordinate[] {
    const path: Coordinate[] = [startPos];

    if (startSegIdx === endSegIdx) {
        path.push(endPos);
        return path;
    }

    const isForward = endSegIdx > startSegIdx;

    if (isForward) {
        for (let i = startSegIdx + 1; i <= endSegIdx; i++) {
            path.push(polyline[i]);
        }
        path.push(endPos);
    } else {
        path.push(endPos);
    }

    return path;
}

function precomputePathDistances(path: Coordinate[]): { distances: number[]; totalDistance: number } {
    if (path.length === 0) return {distances: [], totalDistance: 0};
    if (path.length === 1) return {distances: [0], totalDistance: 0};

    const distances: number[] = [0];
    for (let i = 1; i < path.length; i++) {
        distances.push(distances[i - 1] + getEuclideanDistance(path[i - 1], path[i]));
    }
    const totalDistance = distances[distances.length - 1];

    return {distances, totalDistance};
}

function interpolateAlongPathWithCache(
    path: Coordinate[],
    distances: number[],
    totalDistance: number,
    progress: number
): { position: Coordinate; angle: number } {
    if (path.length === 0) return {position: [0, 0], angle: 0};
    if (path.length === 1) return {position: path[0], angle: 0};

    if (totalDistance === 0) {
        return {position: path[path.length - 1], angle: 0};
    }

    const clampedProgress = Math.max(0, Math.min(1, progress));
    const targetDistance = totalDistance * clampedProgress;

    let segIdx = 0;
    let low = 0;
    let high = distances.length - 1;

    while (low < high) {
        const mid = (low + high + 1) >> 1;
        if (distances[mid] <= targetDistance) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    segIdx = low;

    if (segIdx >= path.length - 1) {
        segIdx = path.length - 2;
    }

    const segStart = distances[segIdx];
    const segEnd = distances[segIdx + 1] ?? segStart;
    const segLen = segEnd - segStart;

    const t = segLen > 0 ? (targetDistance - segStart) / segLen : 0;

    const p1 = path[segIdx];
    const p2 = path[segIdx + 1] ?? p1;
    const p3 = path[segIdx + 2];

    const position: Coordinate = [
        p1[0] + (p2[0] - p1[0]) * t,
        p1[1] + (p2[1] - p1[1]) * t,
    ];

    const angle1 = calculateBearing(p1, p2);
    let angle = angle1;

    // Angular Look-ahead: Start interpolating toward the NEXT segment's bearing
    // as we approach the end of the current segment (e.g. last 30% of length).
    // This allows the bus to start "turning its wheels" before the junction.
    if (p3 && t > ANGULAR_LOOKAHEAD_THRESHOLD) {
        const angle2 = calculateBearing(p2, p3);
        const lookAheadProgress = (t - ANGULAR_LOOKAHEAD_THRESHOLD) / (1 - ANGULAR_LOOKAHEAD_THRESHOLD);
        angle = interpolateAngle(angle1, angle2, lookAheadProgress);
    }

    return {position, angle};
}

// ----------------------------------------------------------------------
// Hook Definition
// ----------------------------------------------------------------------

export function useAnimatedPosition(
    targetPosition: Coordinate,
    targetAngle: number,
    options: UseAnimatedPositionOptions = {}
): AnimatedPositionState {
    const {
        duration = MAP_SETTINGS.ANIMATION.BUS_MOVE_MS,
        polyline = [],
        snapToPolyline: shouldSnap = true,
        snapIndexHint = null,
        snapIndexRange,
        resetKey,
        markerRef,
        pollingIntervalMs = DEFAULT_POLLING_INTERVAL_MS,
        dataDelayMs = DEFAULT_DATA_DELAY_MS,
    } = options;

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

    const animationRef = useRef<number | null>(null);
    const isFirstRender = useRef(true);
    const hasInitialSnapped = useRef(false);
    const prevPolylineLengthRef = useRef(polyline.length);
    const prevTargetRef = useRef<Coordinate>(targetPosition);
    const prevSnapIndexRef = useRef<number | null>(snapIndexHint);

    const currentPosRef = useRef<Coordinate>(targetPosition);
    const currentAngleRef = useRef<number>(targetAngle);

    const animationPathRef = useRef<Coordinate[]>([]);
    const animationStartTimeRef = useRef<number>(0);
    const animationStartAngleRef = useRef<number>(targetAngle);
    const animationEndAngleRef = useRef<number>(targetAngle);
    const animationEndPosRef = useRef<Coordinate>(targetPosition);
    const resetKeyRef = useRef<string | number | undefined>(resetKey);

    const pathDistancesRef = useRef<number[]>([]);
    const pathTotalDistanceRef = useRef<number>(0);

    const lastStateUpdateRef = useRef<number>(0);

    // Coast phase refs — used to continue movement beyond the interpolation target
    const coastPolylineRef = useRef<Coordinate[]>([]);
    const coastEndSegIdxRef = useRef<number>(0);
    const coastEndTRef = useRef<number>(0);
    const coastSpeedRef = useRef<number>(0);

    // Velocity estimation refs — forward projection compensates for polling data delay.
    // By tracking speed from consecutive raw positions, we extrapolate where
    // the bus *currently is* rather than where it *was* at polling time.
    const lastTargetChangeTimeRef = useRef<number>(0);
    const velocityEMARef = useRef<number>(0);        // Smoothed velocity (Euclidean coord-units per ms)
    const velocitySamplesRef = useRef<number>(0);     // Number of velocity samples collected
    const rawEndPosRef = useRef<Coordinate>(targetPosition);   // Last raw (non-projected) snap position
    const rawEndSegIdxRef = useRef<number>(0);        // Last raw snap segment index
    const rawEndTRef = useRef<number>(0);             // Last raw snap t parameter
    const hasRawEndRef = useRef<boolean>(false);      // Whether raw end data has been initialized
    const effectiveDurationRef = useRef<number>(duration); // Per-animation effective duration

    // Acceleration tracking — enables kinematic projection (s = v·t + ½·a·t²)
    const accelerationEMARef = useRef<number>(0);     // Smoothed acceleration (coord-units/ms²)
    const prevVelocityRef = useRef<number>(0);        // Previous velocity for acceleration calc

    // Velocity consistency tracking — coefficient of variation over recent samples
    const velocityHistoryRef = useRef<number[]>([]);  // Ring buffer of recent velocity samples

    const updateMarkerDirect = useCallback((pos: Coordinate, angle: number) => {
        const marker = markerRef?.current;
        if (!marker) return false;

        try {
            // maplibre-gl uses [lng, lat]
            // pos is Coordinate which is [lat, lng]
            marker.setLngLat([pos[1], pos[0]]);
            marker.setRotation(angle);
            return true;
        } catch {
            return false;
        }
    }, [markerRef]);

    useEffect(() => {
        if (resetKeyRef.current === resetKey) return;
        resetKeyRef.current = resetKey;

        if (animationRef.current !== null) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
        coastSpeedRef.current = 0;

        // Reset velocity estimation state for clean re-projection
        velocityEMARef.current = 0;
        velocitySamplesRef.current = 0;
        lastTargetChangeTimeRef.current = 0;
        hasRawEndRef.current = false;
        accelerationEMARef.current = 0;
        prevVelocityRef.current = 0;
        velocityHistoryRef.current = [];

        const hasPolyline = polyline.length >= 2;
        let nextPos = targetPosition;
        let nextAngle = targetAngle;
        let nextSnapIndex: number | null = snapIndexHint;

        if (shouldSnap && hasPolyline) {
            const snapped = snapPointToPolyline(targetPosition, polyline, {
                segmentHint: snapIndexHint,
                searchRadius: snapIndexRange,
            });
            nextPos = snapped.position;
            nextAngle = snapped.angle;
            nextSnapIndex ??= snapped.segmentIndex;
        }

        currentPosRef.current = nextPos;
        currentAngleRef.current = nextAngle;
        prevSnapIndexRef.current = nextSnapIndex;
        prevTargetRef.current = targetPosition;
        rawEndPosRef.current = nextPos;
        setState({position: nextPos, angle: nextAngle});
    }, [resetKey, targetPosition, targetAngle, polyline, shouldSnap, snapIndexHint, snapIndexRange]);

    useEffect(() => {
        const hasPolyline = polyline.length >= 2;
        const polylineJustLoaded = hasPolyline && prevPolylineLengthRef.current < 2;
        prevPolylineLengthRef.current = polyline.length;

        if (isFirstRender.current || (polylineJustLoaded && !hasInitialSnapped.current)) {
            isFirstRender.current = false;
            let initPos: Coordinate = targetPosition;
            let initSnapIndex: number | null = snapIndexHint;

            if (shouldSnap && hasPolyline) {
                const snapped = snapPointToPolyline(targetPosition, polyline, {
                    segmentHint: snapIndexHint,
                    searchRadius: snapIndexRange,
                });
                initPos = snapped.position;
                initSnapIndex ??= snapped.segmentIndex;
                hasInitialSnapped.current = true;

                // Seed raw refs for velocity estimation on subsequent updates
                rawEndPosRef.current = snapped.position;
                rawEndSegIdxRef.current = snapped.segmentIndex;
                rawEndTRef.current = snapped.t;
                hasRawEndRef.current = true;

                updateMarkerDirect(initPos, targetAngle);
            }

            currentPosRef.current = initPos;
            currentAngleRef.current = targetAngle;
            prevSnapIndexRef.current = initSnapIndex;
            setState({position: initPos, angle: targetAngle});
            prevTargetRef.current = targetPosition;
            return;
        }

        const prev = prevTargetRef.current;
        const isSamePosition = targetPosition[0] === prev[0] && targetPosition[1] === prev[1];

        if (isSamePosition) {
            currentAngleRef.current = targetAngle;
            if (snapIndexHint !== null && snapIndexHint !== undefined) {
                prevSnapIndexRef.current = snapIndexHint;
            }
            setState(s => ({...s, angle: targetAngle}));
            return;
        }

        if (animationRef.current !== null) {
            cancelAnimationFrame(animationRef.current);
        }
        prevTargetRef.current = targetPosition;

        const startPos = currentPosRef.current;
        const startAngle = currentAngleRef.current;

        let path: Coordinate[];
        let endPos: Coordinate;
        let endAngle: number;

        if (shouldSnap && hasPolyline) {
            const startSnapped = snapPointToPolyline(startPos, polyline, {
                segmentHint: prevSnapIndexRef.current,
                searchRadius: snapIndexRange,
            });
            const endSnapped = snapPointToPolyline(targetPosition, polyline, {
                segmentHint: snapIndexHint,
                searchRadius: snapIndexRange,
            });

            // ── Backward detection ──
            // Use raw-to-raw comparison when available to avoid false positives
            // caused by forward projection pushing us ahead of the raw data.
            const isBackward = hasRawEndRef.current
                ? isBackwardProgress(
                    rawEndSegIdxRef.current, rawEndTRef.current,
                    endSnapped.segmentIndex, endSnapped.t
                )
                : isBackwardProgress(
                    startSnapped.segmentIndex, startSnapped.t,
                    endSnapped.segmentIndex, endSnapped.t
                );

            if (isBackward) {
                const refPos = hasRawEndRef.current ? rawEndPosRef.current : startSnapped.position;
                const backMeters = getApproxDistanceMeters(refPos, endSnapped.position);

                if (backMeters <= BACKWARD_JITTER_METERS) {
                    // Small jitter — ignore but still update raw refs
                    rawEndPosRef.current = endSnapped.position;
                    rawEndSegIdxRef.current = endSnapped.segmentIndex;
                    rawEndTRef.current = endSnapped.t;
                    hasRawEndRef.current = true;
                    return;
                }

                // Large backward jump — teleport and reset velocity
                currentPosRef.current = endSnapped.position;
                currentAngleRef.current = endSnapped.angle;
                prevSnapIndexRef.current = snapIndexHint ?? endSnapped.segmentIndex;
                rawEndPosRef.current = endSnapped.position;
                rawEndSegIdxRef.current = endSnapped.segmentIndex;
                rawEndTRef.current = endSnapped.t;
                hasRawEndRef.current = true;
                velocityEMARef.current = 0;
                velocitySamplesRef.current = 0;
                lastTargetChangeTimeRef.current = 0;
                accelerationEMARef.current = 0;
                prevVelocityRef.current = 0;
                velocityHistoryRef.current = [];
                setState({position: endSnapped.position, angle: endSnapped.angle});
                return;
            }

            // ── Velocity & acceleration estimation (EMA) ──
            // Polling data is always behind real-time. By estimating velocity AND
            // acceleration from consecutive raw positions, we can project forward
            // using kinematics to show the bus closer to where it *actually is*.
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

                // Track acceleration (change in velocity over time)
                if (velocitySamplesRef.current >= 2 && dtMs > 0) {
                    const rawAccel = (velocityEMARef.current - prevVelocity) / dtMs;
                    const clampedAccel = Math.max(-MAX_ACCELERATION, Math.min(MAX_ACCELERATION, rawAccel));
                    accelerationEMARef.current = prevVelocityRef.current === 0
                        ? clampedAccel
                        : ACCELERATION_SMOOTHING * clampedAccel + (1 - ACCELERATION_SMOOTHING) * accelerationEMARef.current;
                }
                prevVelocityRef.current = velocityEMARef.current;

                // Track velocity history for consistency (coefficient of variation)
                const history = velocityHistoryRef.current;
                history.push(velocityEMARef.current);
                if (history.length > CONSISTENCY_WINDOW) history.shift();
            }

            // Save raw (non-projected) snap data for next velocity calculation
            rawEndPosRef.current = endSnapped.position;
            rawEndSegIdxRef.current = endSnapped.segmentIndex;
            rawEndTRef.current = endSnapped.t;
            hasRawEndRef.current = true;

            // ── Forward projection (kinematic with consistency-based confidence) ──
            // The raw target is where the bus was ~dataDelayMs ago.
            // Project forward using kinematics: s = v·t + ½·a·t²
            // where t = dataDelayMs (not pollingInterval — we compensate for the
            // full data staleness, not just the polling gap).
            let finalEndPos = endSnapped.position;
            let finalEndAngle = endSnapped.angle;
            let finalEndSegIdx = endSnapped.segmentIndex;
            let finalEndT = endSnapped.t;

            if (velocitySamplesRef.current > 0 && velocityEMARef.current > 0) {
                // ── Confidence: ramp-up × consistency ──
                // Ramp up over first CONSISTENCY_RAMP_SAMPLES to avoid noisy early estimates.
                const rampConfidence = Math.min(velocitySamplesRef.current / CONSISTENCY_RAMP_SAMPLES, 1);

                // Velocity consistency: low CV → high confidence, high CV → low confidence.
                // CV = stddev / mean. A steady 40 km/h bus → CV ≈ 0.05 → confidence ≈ 1.0
                // A bus in stop-and-go traffic → CV ≈ 0.8 → confidence ≈ 0.5
                let consistencyConfidence = 1;
                const history = velocityHistoryRef.current;
                if (history.length >= 3) {
                    const mean = history.reduce((s, v) => s + v, 0) / history.length;
                    if (mean > 0) {
                        const variance = history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length;
                        const cv = Math.sqrt(variance) / mean;
                        // Map CV to confidence: CV=0 → 1.0, CV≥1.0 → 0.4 (never fully zero)
                        consistencyConfidence = Math.max(0.4, 1 - cv * 0.6);
                    }
                }

                const projectionConfidence = rampConfidence * consistencyConfidence;

                // Kinematic projection: s = v·t + ½·a·t²
                // Use dataDelayMs as projection time (compensates for full data staleness)
                const t_proj = dataDelayMs;
                const v = velocityEMARef.current;
                const a = accelerationEMARef.current;

                // Predicted velocity at end of projection: v_end = v + a·t
                // If acceleration would make the bus go backward, clamp to zero.
                const v_end = Math.max(0, v + a * t_proj);
                // Distance: use average of current and predicted velocity × time
                // This is equivalent to s = v·t + ½·a·t² but naturally clamps when v_end → 0
                let projDist = ((v + v_end) / 2) * t_proj * projectionConfidence;

                // Safety cap: never project more than what the bus could cover at max speed
                const maxProjection = MAX_VELOCITY_EUCLIDEAN * dataDelayMs;
                projDist = Math.min(projDist, maxProjection);

                const projected = advanceAlongPolyline(
                    polyline, endSnapped.segmentIndex, endSnapped.t, projDist
                );
                finalEndPos = projected.position;
                finalEndAngle = projected.angle;
                finalEndSegIdx = projected.segmentIndex;
                finalEndT = projected.t;
            }

            // ── Overshoot detection ──
            // Coast or forward projection may have pushed the animated marker
            // ahead of the new target. Detect and prevent backward animation.
            const isAnimatedAhead = isBackwardProgress(
                startSnapped.segmentIndex, startSnapped.t,
                finalEndSegIdx, finalEndT
            );

            if (isAnimatedAhead) {
                // Polling data is behind our interpolated position — hold current
                // position so the marker never jumps backward. Mildly dampen
                // velocity to gradually align projection with reality.
                velocityEMARef.current *= OVERSHOOT_VELOCITY_DAMPEN;
                coastSpeedRef.current = 0;
                prevSnapIndexRef.current = snapIndexHint ?? startSnapped.segmentIndex;
                return;
            }

            path = buildPolylinePath(
                polyline,
                startSnapped.position,
                startSnapped.segmentIndex,
                finalEndPos,
                finalEndSegIdx
            );
            endPos = finalEndPos;
            endAngle = finalEndAngle;
            prevSnapIndexRef.current = snapIndexHint ?? finalEndSegIdx;

            // Store coast parameters from the projected end position
            coastPolylineRef.current = polyline;
            coastEndSegIdxRef.current = finalEndSegIdx;
            coastEndTRef.current = finalEndT;
        } else {
            path = [startPos, targetPosition];
            endPos = targetPosition;
            endAngle = targetAngle;

            // No polyline available — coasting not possible
            coastPolylineRef.current = [];
        }

        // ── Dynamic animation duration ──
        // When velocity data is available, align duration with polling interval
        // so the animation finishes right when the next update arrives → seamless transitions.
        effectiveDurationRef.current = (velocitySamplesRef.current > 0 && velocityEMARef.current > 0)
            ? pollingIntervalMs
            : duration;

        animationPathRef.current = path;
        const {distances, totalDistance} = precomputePathDistances(path);
        pathDistancesRef.current = distances;
        pathTotalDistanceRef.current = totalDistance;

        // Coast speed: prefer EMA velocity if available, otherwise derive from path.
        // Reduce by COAST_ENTRY_SPEED_RATIO because smoothstep easing ends at ~0 velocity —
        // a full-speed coast would cause a visible speed jump at the Phase 1→2 boundary.
        // When decelerating (negative acceleration), further reduce coast speed so the
        // marker naturally slows toward a stop; when accelerating, allow slightly more coast.
        const baseCoastSpeed = (velocityEMARef.current > 0
                ? velocityEMARef.current
                : (totalDistance > 0 ? totalDistance / effectiveDurationRef.current : 0)
        ) * COAST_ENTRY_SPEED_RATIO;

        // Acceleration-aware coast modulation:
        // accelFactor ranges ~0.5 (strong decel) to ~1.3 (strong accel), centered at 1.0
        const accelFactor = accelerationEMARef.current !== 0
            ? Math.max(0.5, Math.min(1.3,
                1 + (accelerationEMARef.current / (velocityEMARef.current || 1e-9)) * COAST_DECAY_TAU_MS))
            : 1;
        coastSpeedRef.current = baseCoastSpeed * accelFactor;

        // If the bus is likely stopped (very low velocity with enough samples),
        // disable coast entirely so the marker rests naturally.
        if (velocitySamplesRef.current >= 2 && velocityEMARef.current < STOP_VELOCITY_THRESHOLD) {
            coastSpeedRef.current = 0;
        }

        animationStartTimeRef.current = performance.now();
        animationStartAngleRef.current = startAngle;
        animationEndAngleRef.current = endAngle;
        animationEndPosRef.current = endPos;
        lastStateUpdateRef.current = 0;

        const tick = (currentTime: number) => {
            const elapsed = currentTime - animationStartTimeRef.current;
            const animDuration = effectiveDurationRef.current;
            const linearProgress = Math.min(elapsed / animDuration, 1);

            // Smootherstep easing: 2nd derivative continuous (zero acceleration at start/end)
            // Formula: 6t^5 - 15t^4 + 10t^3.  More sophisticated than standard smoothstep.
            const easedProgress = linearProgress * linearProgress * linearProgress * (linearProgress * (linearProgress * 6 - 15) + 10);

            let pos: Coordinate;
            let targetAngle: number;

            if (linearProgress < 1) {
                // ── Phase 1: Eased interpolation along the precomputed path ──
                const pathResult = interpolateAlongPathWithCache(
                    animationPathRef.current,
                    pathDistancesRef.current,
                    pathTotalDistanceRef.current,
                    easedProgress
                );

                const usePathAngle = animationPathRef.current.length > 1;
                targetAngle = usePathAngle
                    ? pathResult.angle
                    : interpolateAngle(
                        animationStartAngleRef.current,
                        animationEndAngleRef.current,
                        easedProgress
                    );
                pos = pathResult.position;
            } else if (
                coastPolylineRef.current.length >= 2 &&
                coastSpeedRef.current > 0
            ) {
                // ── Phase 2: Coast forward with exponential deceleration ──
                const coastElapsed = elapsed - animDuration;
                const tau = COAST_DECAY_TAU_MS;
                const coastDist = coastSpeedRef.current * tau * (1 - Math.exp(-coastElapsed / tau));
                const coastResult = advanceAlongPolyline(
                    coastPolylineRef.current,
                    coastEndSegIdxRef.current,
                    coastEndTRef.current,
                    coastDist
                );
                pos = coastResult.position;
                targetAngle = coastResult.angle;
            } else {
                // No polyline to coast along — finalize at end position
                pos = animationEndPosRef.current;
                targetAngle = animationEndAngleRef.current;
            }

            // Apply Angular Inertia/Smoothing to currentAngleRef.current
            // This makes the rotation "catch up" to the target angle over time
            // instead of jumping, even if the target angle jumps between segments.
            const angle = interpolateAngle(currentAngleRef.current, targetAngle, ANGULAR_SMOOTHING_FACTOR);

            currentPosRef.current = pos;
            currentAngleRef.current = angle;

            const directUpdateSuccess = updateMarkerDirect(pos, angle);

            // Determine if the animation loop should end
            const isFinished = linearProgress >= 1 && (
                coastPolylineRef.current.length < 2 ||
                coastSpeedRef.current <= 0 ||
                (elapsed - animDuration) >= MAX_COAST_MS
            );

            const timeSinceLastUpdate = currentTime - lastStateUpdateRef.current;
            const shouldUpdateState = !directUpdateSuccess ||
                timeSinceLastUpdate >= STATE_UPDATE_THROTTLE_MS ||
                isFinished;

            if (shouldUpdateState) {
                lastStateUpdateRef.current = currentTime;
                setState({position: pos, angle});
            }

            if (!isFinished) {
                animationRef.current = requestAnimationFrame(tick);
            } else {
                animationRef.current = null;
            }
        };

        animationRef.current = requestAnimationFrame(tick);

        return () => {
            if (animationRef.current !== null) {
                cancelAnimationFrame(animationRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetPosition[0], targetPosition[1], targetAngle, duration, polyline, shouldSnap, snapIndexHint, snapIndexRange, pollingIntervalMs, dataDelayMs, updateMarkerDirect]);

    return state;
}
