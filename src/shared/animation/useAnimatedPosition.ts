"use client";

import {type Coordinate, getApproxDistanceMeters, interpolateAngle, snapPointToPolyline,} from "@shared/utils/geo";
import {useCallback, useEffect, useRef, useState} from "react";

import {
    ANGULAR_SMOOTHING_FACTOR,
    BACKWARD_JITTER_METERS,
    CATCHUP_TAU_MS,
    CITY_BUS_BASE_VELOCITY,
    DEAD_RECKONING_CRUISE_MS,
    DEAD_RECKONING_FADEOUT_MS,
    DEFAULT_DATA_DELAY_MS,
    MAX_CATCHUP_VELOCITY,
    MAX_DEAD_RECKONING_LEAD_COORD,
    MAX_DT_MS,
    MAX_LATENCY_PROJECTION_COORD,
    MAX_VELOCITY,
    MIN_MOVING_VELOCITY,
    POST_TARGET_VELOCITY_RATIO,
    PREDICTIVE_LATENCY_LEAD_MS,
    SCALAR_LOOP_RESTART_THRESHOLD_METERS,
    STATE_UPDATE_THROTTLE_MS,
    STATIONARY_CONFIRM_MS,
    STATIONARY_COORD_THRESHOLD,
    STOP_ACCEL_ZONE,
    STOP_DECEL_ZONE,
    STOP_DWELL_MS,
    STOP_DWELL_PROXIMITY,
    STOP_THRESHOLD,
    TELEPORT_COORD_THRESHOLD,
    TELEPORT_DISTANCE_METERS,
    VELOCITY_DECEL_SMOOTHING,
    VELOCITY_SMOOTHING,
    VELOCITY_TAU_MS,
} from "./constants";
import {
    computeCumulativeDistances,
    computeStopDistances,
    polylineScalarDist,
    positionFromSegT,
    scalarToSegT,
} from "./scalarGeometry";
import {blendVelocityWithPrior, getStopSpeedMultiplier} from "./speedModulation";
import type {AnimatedPositionState, UseAnimatedPositionOptions} from "./types";

/**
 * Animates a bus marker along a polyline with continuous real-time dead-reckoning,
 * origin 10s batch cycle adaptation, latency-compensated continuous forward projection,
 * and stop-aware overrun prevention.
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
    const targetDistRef = useRef(0); // dynamic target distance along polyline
    const velocityRef = useRef(CITY_BUS_BASE_VELOCITY); // estimated cruising velocity (coord-units / ms)
    const currentVelocityRef = useRef(CITY_BUS_BASE_VELOCITY); // smoothed dynamic velocity
    const lastFrameRef = useRef(0);

    // ---- Timing & Extrapolation ----
    const lastDataTimeRef = useRef(0); // performance.now() of last data arrival (network heartbeat)
    const lastRealMoveTimeRef = useRef(0); // performance.now() of last REAL GPS movement
    const lastRealMoveDistRef = useRef(0); // raw scalar distance of last REAL GPS movement
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
    const updateMarkerDirect = useCallback(
        (pos: Coordinate, angle: number) => {
            const marker = markerRef?.current;
            if (!marker) return false;
            try {
                marker.setLngLat([pos[1], pos[0]]);
                marker.setRotation(angle);
                return true;
            } catch {
                return false;
            }
        },
        [markerRef]
    );

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
        lastRealMoveTimeRef.current = 0;
        lastRealMoveDistRef.current = 0;
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
            const cumDist =
                cumDistRef.current.length >= 2
                    ? cumDistRef.current
                    : computeCumulativeDistances(polyline);
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
            lastRealMoveDistRef.current = dist;
            hasDataRef.current = true;
            lastDataTimeRef.current = performance.now();
            lastRealMoveTimeRef.current = lastDataTimeRef.current;

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
                const cumDist =
                    cumDistRef.current.length >= 2
                        ? cumDistRef.current
                        : computeCumulativeDistances(polyline);
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
                lastRealMoveDistRef.current = dist;
                hasDataRef.current = true;
                const nowInit = performance.now();
                lastDataTimeRef.current = nowInit;
                lastRealMoveTimeRef.current = nowInit;
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

        const prev = prevTargetRef.current;
        const isDuplicateCoords = targetPosition[0] === prev[0] && targetPosition[1] === prev[1];
        prevTargetRef.current = targetPosition;

        if (!shouldSnap || !hasPolyline) return;
        const cumDist = cumDistRef.current;
        if (cumDist.length < 2) return;

        const now = performance.now();

        // ----------------------------------------------------------------
        // Duplicate GPS coordinate handling (TAGO 10-15s batch cycle vs client 3s polling)
        // ----------------------------------------------------------------
        if (isDuplicateCoords) {
            lastDataTimeRef.current = now; // update network heartbeat
            const stationaryDuration =
                lastRealMoveTimeRef.current > 0 ? now - lastRealMoveTimeRef.current : 0;

            if (stationaryDuration > STATIONARY_CONFIRM_MS) {
                // If coordinates have not changed for >20 seconds (spanning multiple upstream update windows),
                // the vehicle is genuinely stopped (signal light, long passenger boarding, terminus standby).
                velocityRef.current = 0;
                currentVelocityRef.current = Math.max(0, currentVelocityRef.current * 0.85);

                const snapped = snapPointToPolyline(targetPosition, polyline, {
                    segmentHint: snapIndexHint,
                    searchRadius: snapIndexRange,
                });
                const rawDist = polylineScalarDist(cumDist, snapped.segmentIndex, snapped.t);
                targetDistRef.current = rawDist;
                isOvershotOnDataRef.current = markerDistRef.current > rawDist + 0.00005;
            }
            // If stationaryDuration <= STATIONARY_CONFIRM_MS, upstream simply hasn't ticked yet!
            // Maintain smooth cruising & dead reckoning without dropping speed.
            return;
        }

        const snapped = snapPointToPolyline(targetPosition, polyline, {
            segmentHint: snapIndexHint,
            searchRadius: snapIndexRange,
        });
        const rawDist = polylineScalarDist(cumDist, snapped.segmentIndex, snapped.t);
        const totalDist = cumDist[cumDist.length - 1];
        const lagMeters = getApproxDistanceMeters(currentPosRef.current, snapped.position);

        // ----------------------------------------------------------------
        // TELEPORT / TURNAROUND RE-ANCHOR: Only for extreme jumps or route resets
        // ----------------------------------------------------------------
        const scalarDropMeters = (prevRawDistRef.current - rawDist) * 111000;
        const isTurnaroundLoop =
            hasDataRef.current &&
            rawDist < prevRawDistRef.current &&
            scalarDropMeters > SCALAR_LOOP_RESTART_THRESHOLD_METERS;
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
            lastRealMoveDistRef.current = rawDist;
            lastRealMoveTimeRef.current = now;
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
        if (
            hasDataRef.current &&
            rawDist < prevRawDistRef.current &&
            lagMeters <= BACKWARD_JITTER_METERS
        ) {
            prevRawDistRef.current = rawDist;
            return;
        }

        // ----------------------------------------------------------------
        // NORMAL PROGRESS & SPEED CALCULATION:
        // Use last REAL movement timestamp and distance for accurate velocity estimation
        // ----------------------------------------------------------------
        const dtMs =
            lastRealMoveTimeRef.current > 0
                ? now - lastRealMoveTimeRef.current
                : (lastDataTimeRef.current > 0 ? now - lastDataTimeRef.current : 0);
        const moved = rawDist - lastRealMoveDistRef.current;
        const isStationary = Math.abs(moved) < STATIONARY_COORD_THRESHOLD; // < ~3.5 meters GPS jitter

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
            const smoothing =
                clampedV < velocityRef.current ? VELOCITY_DECEL_SMOOTHING : VELOCITY_SMOOTHING;
            const measuredEMA =
                velocityRef.current <= STOP_THRESHOLD
                    ? clampedV
                    : smoothing * clampedV + (1 - smoothing) * velocityRef.current;

            velocityRef.current = Math.min(
                blendVelocityWithPrior(measuredEMA, samples),
                MAX_VELOCITY
            );

            // Initial latency projection upon data arrival (compensates physical + TAGO batch delay)
            const v = Math.max(velocityRef.current, MIN_MOVING_VELOCITY);
            const effectivePhysicalDelay = Math.max(0, Math.min(PREDICTIVE_LATENCY_LEAD_MS, 15000));
            const newTargetDist = Math.min(rawDist + v * effectivePhysicalDelay, totalDist);
            targetDistRef.current = newTargetDist;

            // Overshoot detection: if marker is ahead of newly projected position
            const currentDist = markerDistRef.current;
            const overshoot = currentDist - newTargetDist;
            if (overshoot > 0.00005) {
                isOvershotOnDataRef.current = true;
                const dampingRatio = Math.max(0, 1 - overshoot / 0.0012);
                currentVelocityRef.current = currentVelocityRef.current * dampingRatio;
            } else {
                isOvershotOnDataRef.current = false;
            }
        } else {
            targetDistRef.current = rawDist;
            isOvershotOnDataRef.current = markerDistRef.current > rawDist + 0.00005;
        }

        prevRawDistRef.current = rawDist;
        lastRealMoveDistRef.current = rawDist;
        lastRealMoveTimeRef.current = now;
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
    // Animation loop — Continuous 60fps Rapid Catch-Up & Continuous Dead Reckoning
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
            const activeV =
                currentV + (targetV - currentV) * Math.min(clampedDt / VELOCITY_TAU_MS, 1);
            currentVelocityRef.current = activeV;

            const totalDist = cumDist[cumDist.length - 1];
            let dist = markerDistRef.current;

            // ----------------------------------------------------------------
            // Dynamic Real-Time Target Projection:
            // Continuously project target forward based on elapsed time since real observation
            // ----------------------------------------------------------------
            const timeSinceRealMove =
                lastRealMoveTimeRef.current > 0 ? now - lastRealMoveTimeRef.current : 0;
            const effectiveElapsedMs = PREDICTIVE_LATENCY_LEAD_MS + timeSinceRealMove;
            const dynamicLead = Math.min(
                activeV * effectiveElapsedMs,
                MAX_DEAD_RECKONING_LEAD_COORD
            );
            let dynamicTarget = Math.min(
                lastRealMoveDistRef.current + dynamicLead,
                totalDist
            );

            // Stop-aware overrun clamp: if bus is approaching an unpassed stop and cruising speed is low/decelerating,
            // clamp forward projection to stop position so marker doesn't fly past station during dwell
            const stopDists = stopDistancesRef.current;
            const nextStopIdx = stopDists.findIndex((d) => d > lastRealMoveDistRef.current);
            if (nextStopIdx !== -1) {
                const nextStopDist = stopDists[nextStopIdx];
                const distToStop = nextStopDist - lastRealMoveDistRef.current;
                if (distToStop < STOP_DECEL_ZONE && (activeV < CITY_BUS_BASE_VELOCITY * 0.75 || isOvershotOnDataRef.current)) {
                    dynamicTarget = Math.min(dynamicTarget, nextStopDist + STOP_DWELL_PROXIMITY * 0.5);
                }
            }

            targetDistRef.current = dynamicTarget;
            const target = targetDistRef.current;
            const gap = target - dist; // positive = marker behind target, negative = marker past target

            // Check dead reckoning timeout / fadeout
            const timeSinceLastData =
                lastDataTimeRef.current > 0 ? now - lastDataTimeRef.current : 0;
            let deadReckoningFactor = 1.0;
            if (timeSinceLastData > DEAD_RECKONING_CRUISE_MS) {
                const over = timeSinceLastData - DEAD_RECKONING_CRUISE_MS;
                deadReckoningFactor = Math.max(0, 1 - over / DEAD_RECKONING_FADEOUT_MS);
            }

            // SAFETY CEILING: Extrapolation is strictly capped at MAX_DEAD_RECKONING_LEAD_COORD (~1.75km) past raw API position
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
                    // Dwell at station: gentle crawl instead of full freeze
                    const dwellAdvance = activeV * 0.2 * clampedDt;
                    dist = Math.min(dist + dwellAdvance, hardCeilingDist);
                    markerDistRef.current = dist;
                } else {
                    let effectiveVelocity: number;

                    if (gap > 0) {
                        // --------------------------------------------------------
                        // Catch-up phase: marker is tracking toward live projected position
                        // --------------------------------------------------------
                        const baseVelocity = activeV * deadReckoningFactor * stopMult;
                        const linearBoost = gap / CATCHUP_TAU_MS;
                        const surgeBoost = Math.max(0, (gap - 0.0001) * 0.002);
                        const catchupVelocity = Math.min(
                            linearBoost + surgeBoost,
                            MAX_CATCHUP_VELOCITY
                        );
                        effectiveVelocity = Math.min(
                            MAX_CATCHUP_VELOCITY,
                            baseVelocity + catchupVelocity
                        );
                    } else if (isOvershotOnDataRef.current) {
                        // --------------------------------------------------------
                        // Overshoot phase: real bus stopped or slowed down, smooth coasting deceleration
                        // --------------------------------------------------------
                        currentVelocityRef.current = Math.max(0, currentVelocityRef.current * 0.92);
                        effectiveVelocity = activeV * 0.35 * stopMult;
                    } else {
                        // --------------------------------------------------------
                        // Cruising lock phase: marker is aligned with dynamic live target
                        // --------------------------------------------------------
                        const leadBeyondTarget = Math.max(0, dist - target);
                        const maxExtraLead = MAX_DEAD_RECKONING_LEAD_COORD;
                        const extraProgress = Math.min(
                            1,
                            leadBeyondTarget / Math.max(0.001, maxExtraLead)
                        );
                        const taperFactor =
                            POST_TARGET_VELOCITY_RATIO * (1 - extraProgress * 0.15);
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
