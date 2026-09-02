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
    SCALAR_LOOP_RESTART_THRESHOLD_METERS,
    STATE_UPDATE_THROTTLE_MS,
    STOP_ACCEL_ZONE,
    STOP_DECEL_ZONE,
    STOP_DWELL_MS,
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
                targetDistRef.current = polylineScalarDist(
                    cumDistRef.current,
                    snapped.segmentIndex,
                    snapped.t
                );
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
            const activeV =
                currentV + (targetV - currentV) * Math.min(clampedDt / VELOCITY_TAU_MS, 1);
            currentVelocityRef.current = activeV;

            const totalDist = cumDist[cumDist.length - 1];
            let dist = markerDistRef.current;
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
                    let effectiveVelocity = 0;

                    if (gap > 0) {
                        // --------------------------------------------------------
                        // 1차 예측 지점 도달 전: 빠른 캐치업 가속 주행
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
                        // 새 API 데이터 수신 시 과예측(오버슈트) 판정된 경우: 대기 / 제동
                        // --------------------------------------------------------
                        currentVelocityRef.current = Math.max(0, currentVelocityRef.current * 0.9);
                        effectiveVelocity = 0;
                    } else {
                        // --------------------------------------------------------
                        // 1차 예측 지점 이후 (2차 연장 외삽 구간):
                        // 공격적인 지속 주행: 기본 속도의 85%를 유지하며 원거리 시에도 완만하게(최소 64%) 유지
                        // --------------------------------------------------------
                        const leadBeyondTarget = Math.max(0, dist - target);
                        const maxExtraLead = MAX_DEAD_RECKONING_LEAD_COORD;
                        const extraProgress = Math.min(
                            1,
                            leadBeyondTarget / Math.max(0.001, maxExtraLead)
                        );
                        const taperFactor =
                            POST_TARGET_VELOCITY_RATIO * (1 - extraProgress * 0.25);
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
