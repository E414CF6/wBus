"use client";

import {type Coordinate, getApproxDistanceMeters, snapPointToPolyline} from "@shared/utils/geo";
import {useCallback, useEffect, useRef, useState} from "react";

import {
    BACKWARD_JITTER_METERS,
    CITY_BUS_BASE_VELOCITY,
    DEFAULT_DATA_DELAY_MS,
    MAX_VELOCITY,
    MIN_MOVING_VELOCITY,
    PREDICTIVE_LATENCY_LEAD_MS,
    SCALAR_LOOP_RESTART_THRESHOLD_METERS,
    STATE_UPDATE_THROTTLE_MS,
    STATIONARY_CONFIRM_MS,
    STATIONARY_COORD_THRESHOLD,
    STOP_ACCEL_ZONE,
    STOP_THRESHOLD,
    TELEPORT_DISTANCE_METERS,
    VELOCITY_DECEL_SMOOTHING,
    VELOCITY_SMOOTHING,
} from "./constants";
import {type AnimationRuntimeState, computeInitialSnappedState, stepAnimationFrame,} from "./interpolationEngine";
import {computeCumulativeDistances, computeStopDistances, polylineScalarDist} from "./scalarGeometry";
import {blendVelocityWithPrior} from "./speedModulation";
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
        onDirectAngle,
        dataDelayMs = DEFAULT_DATA_DELAY_MS,
        stopCoordIndices = [],
    } = options;

    const [state, setState] = useState<AnimatedPositionState>(() => {
        if (shouldSnap && polyline.length >= 2) {
            const snapped = computeInitialSnappedState(targetPosition, targetAngle, polyline, {
                snapIndexHint,
                snapIndexRange,
                dataDelayMs,
            });
            return {position: snapped.position, angle: snapped.angle};
        }
        return {position: targetPosition, angle: targetAngle};
    });

    const animFrameRef = useRef<number | null>(null);
    const isFirstDataRef = useRef(true);
    const prevPolylineRef = useRef(polyline);
    const prevPolylineLenRef = useRef(polyline.length);
    const prevTargetRef = useRef<Coordinate>(targetPosition);
    const resetKeyRef = useRef(resetKey);
    const lastStateUpdateRef = useRef(0);

    const polylineRef = useRef(polyline);
    const cumDistRef = useRef<number[]>([]);
    const stopDistancesRef = useRef<number[]>([]);

    const runtimeRef = useRef<AnimationRuntimeState>({
        currentPos: state.position,
        currentAngle: state.angle,
        markerDist: 0,
        targetDist: 0,
        velocity: CITY_BUS_BASE_VELOCITY,
        currentVelocity: CITY_BUS_BASE_VELOCITY,
        lastFrame: 0,
        lastDataTime: 0,
        lastRealMoveTime: 0,
        lastRealMoveDist: 0,
        prevRawDist: 0,
        hasData: false,
        sampleCount: 0,
        isOvershotOnData: false,
        lastDwelledStopIdx: -1,
        dwellStartTime: 0,
    });

    const isLoopRunningRef = useRef(false);
    const startLoopRef = useRef<() => void>(() => {
    });

    const updateMarkerDirect = useCallback(
        (pos: Coordinate, angle: number) => {
            const marker = markerRef?.current;
            if (!marker) return false;
            try {
                marker.setLngLat([pos[1], pos[0]]);
                if (onDirectAngle) {
                    onDirectAngle(angle);
                } else {
                    marker.setRotation(angle);
                }
                return true;
            } catch {
                return false;
            }
        },
        [markerRef, onDirectAngle]
    );

    useEffect(() => {
        polylineRef.current = polyline;
        const cumDist = polyline.length >= 2 ? computeCumulativeDistances(polyline) : [];
        cumDistRef.current = cumDist;
        stopDistancesRef.current = computeStopDistances(stopCoordIndices, cumDist);
    }, [polyline, stopCoordIndices]);

    useEffect(() => {
        const polylineChanged = prevPolylineRef.current !== polyline;
        const resetKeyChanged = resetKeyRef.current !== resetKey;

        if (!resetKeyChanged && !polylineChanged) return;
        resetKeyRef.current = resetKey;
        prevPolylineRef.current = polyline;

        const rt = runtimeRef.current;
        rt.velocity = CITY_BUS_BASE_VELOCITY;
        rt.currentVelocity = CITY_BUS_BASE_VELOCITY;
        rt.lastDataTime = 0;
        rt.lastRealMoveTime = 0;
        rt.lastRealMoveDist = 0;
        rt.prevRawDist = 0;
        rt.hasData = false;
        isFirstDataRef.current = true;
        rt.lastFrame = 0;
        rt.sampleCount = 0;
        rt.isOvershotOnData = false;
        rt.lastDwelledStopIdx = -1;
        rt.dwellStartTime = 0;

        let nextPos = targetPosition;
        let nextAngle = targetAngle;

        if (shouldSnap && polyline.length >= 2) {
            const snapped = computeInitialSnappedState(targetPosition, targetAngle, polyline, {
                snapIndexHint,
                snapIndexRange,
                dataDelayMs,
                existingCumDist: cumDistRef.current,
            });
            cumDistRef.current = snapped.cumDist;
            rt.markerDist = snapped.initialDist;
            rt.targetDist = snapped.initialDist;
            rt.prevRawDist = snapped.rawDist;
            rt.lastRealMoveDist = snapped.rawDist;
            rt.hasData = true;
            rt.lastDataTime = performance.now();
            rt.lastRealMoveTime = rt.lastDataTime;
            nextPos = snapped.position;
            nextAngle = snapped.angle;
        }

        rt.currentPos = nextPos;
        rt.currentAngle = nextAngle;
        prevTargetRef.current = targetPosition;
        updateMarkerDirect(nextPos, nextAngle);
        setState({position: nextPos, angle: nextAngle});
        startLoopRef.current();
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

    useEffect(() => {
        const rt = runtimeRef.current;
        const hasPolyline = polyline.length >= 2;
        const polylineJustLoaded = hasPolyline && prevPolylineLenRef.current < 2;
        prevPolylineLenRef.current = polyline.length;

        if (isFirstDataRef.current || polylineJustLoaded) {
            isFirstDataRef.current = false;

            if (shouldSnap && hasPolyline) {
                const snapped = computeInitialSnappedState(targetPosition, targetAngle, polyline, {
                    snapIndexHint,
                    snapIndexRange,
                    dataDelayMs,
                    existingCumDist: cumDistRef.current,
                });
                cumDistRef.current = snapped.cumDist;
                rt.markerDist = snapped.initialDist;
                rt.targetDist = snapped.initialDist;
                rt.prevRawDist = snapped.rawDist;
                rt.lastRealMoveDist = snapped.rawDist;
                rt.hasData = true;
                const nowInit = performance.now();
                rt.lastDataTime = nowInit;
                rt.lastRealMoveTime = nowInit;
                rt.sampleCount = 0;
                rt.isOvershotOnData = false;
                rt.velocity = CITY_BUS_BASE_VELOCITY;
                rt.currentVelocity = CITY_BUS_BASE_VELOCITY;
                rt.currentPos = snapped.position;
                rt.currentAngle = snapped.angle;
                updateMarkerDirect(snapped.position, snapped.angle);
                setState({position: snapped.position, angle: snapped.angle});
            } else {
                rt.currentPos = targetPosition;
                rt.currentAngle = targetAngle;
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

        if (isDuplicateCoords) {
            rt.lastDataTime = now;
            const stationaryDuration = rt.lastRealMoveTime > 0 ? now - rt.lastRealMoveTime : 0;
            if (stationaryDuration > STATIONARY_CONFIRM_MS) {
                rt.velocity = 0;
                rt.currentVelocity = Math.max(0, rt.currentVelocity * 0.85);
                const snapped = snapPointToPolyline(targetPosition, polyline, {
                    segmentHint: snapIndexHint,
                    searchRadius: snapIndexRange,
                });
                const rawDist = polylineScalarDist(cumDist, snapped.segmentIndex, snapped.t);
                rt.targetDist = rawDist;
                rt.isOvershotOnData = rt.markerDist > rawDist + 0.00005;
            }
            return;
        }

        const snapped = snapPointToPolyline(targetPosition, polyline, {
            segmentHint: snapIndexHint,
            searchRadius: snapIndexRange,
        });
        const rawDist = polylineScalarDist(cumDist, snapped.segmentIndex, snapped.t);
        const totalDist = cumDist[cumDist.length - 1];
        const lagMeters = getApproxDistanceMeters(rt.currentPos, snapped.position);

        const scalarDropMeters = (rt.prevRawDist - rawDist) * 111000;
        const isTurnaroundLoop =
            rt.hasData &&
            rawDist < rt.prevRawDist &&
            scalarDropMeters > SCALAR_LOOP_RESTART_THRESHOLD_METERS;
        const isExtremeTeleport = lagMeters > TELEPORT_DISTANCE_METERS;

        if (isTurnaroundLoop || isExtremeTeleport) {
            const reanchored = computeInitialSnappedState(targetPosition, targetAngle, polyline, {
                snapIndexHint,
                snapIndexRange,
                dataDelayMs,
                maxDelayCapMs: 10000,
                existingCumDist: cumDist,
            });
            rt.markerDist = reanchored.initialDist;
            rt.targetDist = reanchored.initialDist;
            rt.velocity = CITY_BUS_BASE_VELOCITY;
            rt.currentVelocity = CITY_BUS_BASE_VELOCITY;
            rt.sampleCount = 0;
            rt.isOvershotOnData = false;
            rt.lastDwelledStopIdx = -1;
            rt.dwellStartTime = 0;
            rt.prevRawDist = rawDist;
            rt.lastRealMoveDist = rawDist;
            rt.lastRealMoveTime = now;
            rt.lastDataTime = now;
            rt.currentPos = reanchored.position;
            rt.currentAngle = reanchored.angle;
            updateMarkerDirect(reanchored.position, reanchored.angle);
            setState({position: reanchored.position, angle: reanchored.angle});
            return;
        }

        if (rt.hasData && rawDist < rt.prevRawDist && lagMeters <= BACKWARD_JITTER_METERS) {
            rt.prevRawDist = rawDist;
            return;
        }

        const dtMs =
            rt.lastRealMoveTime > 0
                ? now - rt.lastRealMoveTime
                : rt.lastDataTime > 0
                    ? now - rt.lastDataTime
                    : 0;
        const moved = rawDist - rt.lastRealMoveDist;
        const isStationary = Math.abs(moved) < STATIONARY_COORD_THRESHOLD;

        if (isStationary) {
            rt.velocity = 0;
            rt.currentVelocity = 0;
            rt.targetDist = rawDist;
            rt.isOvershotOnData = rt.markerDist > rawDist + 0.00005;
        } else if (dtMs > 600 && rt.hasData && moved > 0) {
            const rawV = moved / dtMs;
            const clampedV = Math.min(Math.max(rawV, MIN_MOVING_VELOCITY), MAX_VELOCITY);

            rt.sampleCount++;
            const smoothing = clampedV < rt.velocity ? VELOCITY_DECEL_SMOOTHING : VELOCITY_SMOOTHING;
            const measuredEMA =
                rt.velocity <= STOP_THRESHOLD
                    ? clampedV
                    : smoothing * clampedV + (1 - smoothing) * rt.velocity;

            rt.velocity = Math.min(blendVelocityWithPrior(measuredEMA, rt.sampleCount), MAX_VELOCITY);

            const v = Math.max(rt.velocity, MIN_MOVING_VELOCITY);
            const effectivePhysicalDelay = Math.max(0, Math.min(PREDICTIVE_LATENCY_LEAD_MS, 15000));
            const newTargetDist = Math.min(rawDist + v * effectivePhysicalDelay, totalDist);
            rt.targetDist = newTargetDist;

            const overshoot = rt.markerDist - newTargetDist;
            if (overshoot > 0.00005) {
                rt.isOvershotOnData = true;
                const dampingRatio = Math.max(0, 1 - overshoot / 0.0012);
                rt.currentVelocity = rt.currentVelocity * dampingRatio;
            } else {
                rt.isOvershotOnData = false;
            }
        } else {
            rt.targetDist = rawDist;
            rt.isOvershotOnData = rt.markerDist > rawDist + 0.00005;
        }

        rt.prevRawDist = rawDist;
        rt.lastRealMoveDist = rawDist;
        rt.lastRealMoveTime = now;
        rt.lastDataTime = now;
        rt.hasData = true;

        const stopDists = stopDistancesRef.current;
        if (rt.lastDwelledStopIdx >= 0 && rt.lastDwelledStopIdx < stopDists.length) {
            if (rawDist > stopDists[rt.lastDwelledStopIdx] + STOP_ACCEL_ZONE) {
                rt.lastDwelledStopIdx = -1;
                rt.dwellStartTime = 0;
            }
        }
        startLoopRef.current();
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

    useEffect(() => {
        const stopLoop = () => {
            if (animFrameRef.current !== null) {
                cancelAnimationFrame(animFrameRef.current);
                animFrameRef.current = null;
            }
            isLoopRunningRef.current = false;
        };

        const tick = (now: number) => {
            if (typeof document !== "undefined" && document.visibilityState === "hidden") {
                stopLoop();
                return;
            }

            const pl = polylineRef.current;
            const cumDist = cumDistRef.current;

            if (pl.length < 2 || cumDist.length < 2) {
                runtimeRef.current.lastFrame = now;
                animFrameRef.current = requestAnimationFrame(tick);
                return;
            }

            const step = stepAnimationFrame(
                runtimeRef.current,
                pl,
                cumDist,
                stopDistancesRef.current,
                now
            );

            if (step.shouldSleep) {
                stopLoop();
                return;
            }

            updateMarkerDirect(step.position, step.angle);

            const elapsed = now - lastStateUpdateRef.current;
            if (elapsed >= STATE_UPDATE_THROTTLE_MS) {
                lastStateUpdateRef.current = now;
                setState((prev) => {
                    const dLat = Math.abs(prev.position[0] - step.position[0]);
                    const dLng = Math.abs(prev.position[1] - step.position[1]);
                    const dAngle = Math.abs(prev.angle - step.angle);
                    if (dLat < 1e-6 && dLng < 1e-6 && dAngle < 0.5) {
                        return prev;
                    }
                    return {position: step.position, angle: step.angle};
                });
            }

            animFrameRef.current = requestAnimationFrame(tick);
        };

        const startLoop = () => {
            if (typeof document !== "undefined" && document.visibilityState === "hidden") {
                return;
            }
            if (!isLoopRunningRef.current) {
                isLoopRunningRef.current = true;
                runtimeRef.current.lastFrame = performance.now();
                animFrameRef.current = requestAnimationFrame(tick);
            }
        };

        startLoopRef.current = startLoop;

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                startLoop();
            } else {
                stopLoop();
            }
        };

        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", handleVisibilityChange);
        }

        startLoop();

        return () => {
            if (typeof document !== "undefined") {
                document.removeEventListener("visibilitychange", handleVisibilityChange);
            }
            stopLoop();
        };
    }, [updateMarkerDirect]);

    return state;
}
