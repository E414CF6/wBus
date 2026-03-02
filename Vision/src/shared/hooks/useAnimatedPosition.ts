"use client";

import { MAP_SETTINGS } from "@core/constants/env";
import {
    calculateBearing,
    type Coordinate,
    getApproxDistanceMeters,
    getEuclideanDistance,
    interpolateAngle,
    snapPointToPolyline
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
}

// Thresholds for backward movement detection
const BACKWARD_T_EPSILON = 1e-3;
const BACKWARD_JITTER_METERS = 12;

// Throttle state updates to reduce React re-renders (update every N ms)
const STATE_UPDATE_THROTTLE_MS = 50;

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

    const position: Coordinate = [
        p1[0] + (p2[0] - p1[0]) * t,
        p1[1] + (p2[1] - p1[1]) * t,
    ];

    const angle = calculateBearing(p1, p2);

    return {position, angle};
}

function easeOutQuart(t: number): number {
    return 1 - Math.pow(1 - t, 4);
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

            const isBackward = isBackwardProgress(
                startSnapped.segmentIndex,
                startSnapped.t,
                endSnapped.segmentIndex,
                endSnapped.t
            );

            if (isBackward) {
                const backMeters = getApproxDistanceMeters(startSnapped.position, endSnapped.position);

                if (backMeters <= BACKWARD_JITTER_METERS) {
                    return;
                }

                currentPosRef.current = endSnapped.position;
                currentAngleRef.current = endSnapped.angle;
                prevSnapIndexRef.current = snapIndexHint ?? endSnapped.segmentIndex;
                setState({position: endSnapped.position, angle: endSnapped.angle});
                return;
            }

            path = buildPolylinePath(
                polyline,
                startSnapped.position,
                startSnapped.segmentIndex,
                endSnapped.position,
                endSnapped.segmentIndex
            );
            endPos = endSnapped.position;
            endAngle = endSnapped.angle;
            prevSnapIndexRef.current = snapIndexHint ?? endSnapped.segmentIndex;
        } else {
            path = [startPos, targetPosition];
            endPos = targetPosition;
            endAngle = targetAngle;
        }

        animationPathRef.current = path;
        const {distances, totalDistance} = precomputePathDistances(path);
        pathDistancesRef.current = distances;
        pathTotalDistanceRef.current = totalDistance;

        animationStartTimeRef.current = performance.now();
        animationStartAngleRef.current = startAngle;
        animationEndAngleRef.current = endAngle;
        animationEndPosRef.current = endPos;
        lastStateUpdateRef.current = 0;

        const tick = (currentTime: number) => {
            const elapsed = currentTime - animationStartTimeRef.current;
            const rawProgress = Math.min(elapsed / duration, 1);
            const progress = easeOutQuart(rawProgress);

            const pathResult = interpolateAlongPathWithCache(
                animationPathRef.current,
                pathDistancesRef.current,
                pathTotalDistanceRef.current,
                progress
            );

            const usePathAngle = animationPathRef.current.length > 1;
            const angle = usePathAngle
                ? pathResult.angle
                : interpolateAngle(
                    animationStartAngleRef.current,
                    animationEndAngleRef.current,
                    progress
                );

            currentPosRef.current = pathResult.position;
            currentAngleRef.current = angle;

            const directUpdateSuccess = updateMarkerDirect(pathResult.position, angle);

            const timeSinceLastUpdate = currentTime - lastStateUpdateRef.current;
            const shouldUpdateState = !directUpdateSuccess ||
                timeSinceLastUpdate >= STATE_UPDATE_THROTTLE_MS ||
                rawProgress >= 1;

            if (shouldUpdateState) {
                lastStateUpdateRef.current = currentTime;
                setState({position: pathResult.position, angle});
            }

            if (rawProgress < 1) {
                animationRef.current = requestAnimationFrame(tick);
            } else {
                currentPosRef.current = animationEndPosRef.current;
                currentAngleRef.current = animationEndAngleRef.current;
                updateMarkerDirect(animationEndPosRef.current, animationEndAngleRef.current);
                setState({
                    position: animationEndPosRef.current,
                    angle: animationEndAngleRef.current,
                });
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
    }, [targetPosition[0], targetPosition[1], targetAngle, duration, polyline, shouldSnap, snapIndexHint, snapIndexRange, updateMarkerDirect]);

    return state;
}
