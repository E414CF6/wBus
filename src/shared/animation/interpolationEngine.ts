import {type Coordinate, interpolateAngle, snapPointToPolyline} from "@shared/utils/geo";
import {
    ANGULAR_SMOOTHING_FACTOR,
    CATCHUP_TAU_MS,
    CITY_BUS_BASE_VELOCITY,
    DEAD_RECKONING_CRUISE_MS,
    DEAD_RECKONING_FADEOUT_MS,
    MAX_CATCHUP_VELOCITY,
    MAX_DEAD_RECKONING_LEAD_COORD,
    MAX_DT_MS,
    MAX_LATENCY_PROJECTION_COORD,
    MIN_MOVING_VELOCITY,
    POST_TARGET_VELOCITY_RATIO,
    PREDICTIVE_LATENCY_LEAD_MS,
    STOP_DECEL_ZONE,
    STOP_DWELL_MS,
    STOP_DWELL_PROXIMITY,
    STOP_THRESHOLD,
    TELEPORT_COORD_THRESHOLD,
    VELOCITY_TAU_MS,
} from "./constants";
import {
    computeCumulativeDistances,
    polylineScalarDist,
    positionFromSegT,
    scalarToSegT,
} from "./scalarGeometry";
import {getStopSpeedMultiplier} from "./speedModulation";

export interface InitialSnapResult {
    position: Coordinate;
    angle: number;
    rawDist: number;
    initialDist: number;
    cumDist: number[];
}

export function computeInitialSnappedState(
    targetPosition: Coordinate,
    targetAngle: number,
    polyline: Coordinate[],
    options: {
        snapIndexHint?: number | null;
        snapIndexRange?: number;
        dataDelayMs: number;
        maxDelayCapMs?: number;
        existingCumDist?: number[];
    }
): InitialSnapResult {
    const snapped = snapPointToPolyline(targetPosition, polyline, {
        segmentHint: options.snapIndexHint,
        searchRadius: options.snapIndexRange,
    });
    const cumDist =
        options.existingCumDist && options.existingCumDist.length >= 2
            ? options.existingCumDist
            : computeCumulativeDistances(polyline);
    const rawDist = polylineScalarDist(cumDist, snapped.segmentIndex, snapped.t);
    const effectiveDelay = Math.max(0, Math.min(options.dataDelayMs, options.maxDelayCapMs ?? 25000));
    const totalDist = cumDist[cumDist.length - 1] ?? rawDist;
    const maxAllowedProj = Math.max(
        0,
        Math.min(
            CITY_BUS_BASE_VELOCITY * effectiveDelay,
            MAX_LATENCY_PROJECTION_COORD,
            totalDist - rawDist - STOP_DECEL_ZONE * 0.5
        )
    );
    const initialDist = Math.min(rawDist + maxAllowedProj, totalDist);
    const {segIdx, t} = scalarToSegT(cumDist, initialDist);
    const {position, angle: pathAngle} = positionFromSegT(polyline, segIdx, t);
    return {
        position,
        angle: pathAngle || snapped.angle || targetAngle,
        rawDist,
        initialDist,
        cumDist,
    };
}

export interface AnimationRuntimeState {
    currentPos: Coordinate;
    currentAngle: number;
    markerDist: number;
    targetDist: number;
    velocity: number;
    currentVelocity: number;
    lastFrame: number;
    lastDataTime: number;
    lastRealMoveTime: number;
    lastRealMoveDist: number;
    prevRawDist: number;
    hasData: boolean;
    sampleCount: number;
    isOvershotOnData: boolean;
    lastDwelledStopIdx: number;
    dwellStartTime: number;
}

export interface StepFrameResult {
    shouldSleep: boolean;
    position: Coordinate;
    angle: number;
}

export function stepAnimationFrame(
    rt: AnimationRuntimeState,
    polyline: Coordinate[],
    cumDist: number[],
    stopDists: number[],
    now: number
): StepFrameResult {
    const dt = rt.lastFrame > 0 ? now - rt.lastFrame : 0;
    rt.lastFrame = now;
    const clampedDt = Math.min(dt, MAX_DT_MS);

    const targetV = Math.max(rt.velocity, MIN_MOVING_VELOCITY);
    const currentV = rt.currentVelocity;
    const activeV = currentV + (targetV - currentV) * Math.min(clampedDt / VELOCITY_TAU_MS, 1);
    rt.currentVelocity = activeV;

    const totalDist = cumDist[cumDist.length - 1];
    let dist = rt.markerDist;

    const timeSinceRealMove = rt.lastRealMoveTime > 0 ? now - rt.lastRealMoveTime : 0;
    const effectiveElapsedMs = PREDICTIVE_LATENCY_LEAD_MS + timeSinceRealMove;
    const dynamicLead = Math.min(activeV * effectiveElapsedMs, MAX_DEAD_RECKONING_LEAD_COORD);
    let dynamicTarget = Math.min(rt.lastRealMoveDist + dynamicLead, totalDist);

    const nextStopIdx = stopDists.findIndex((d) => d > rt.lastRealMoveDist);
    if (nextStopIdx !== -1) {
        const nextStopDist = stopDists[nextStopIdx];
        const distToStop = nextStopDist - rt.lastRealMoveDist;
        if (distToStop < STOP_DECEL_ZONE && (activeV < CITY_BUS_BASE_VELOCITY * 0.75 || rt.isOvershotOnData)) {
            dynamicTarget = Math.min(dynamicTarget, nextStopDist + STOP_DWELL_PROXIMITY * 0.5);
        }
    }

    rt.targetDist = dynamicTarget;
    const target = rt.targetDist;
    const gap = target - dist;

    const timeSinceLastData = rt.lastDataTime > 0 ? now - rt.lastDataTime : 0;
    let deadReckoningFactor = 1.0;
    if (timeSinceLastData > DEAD_RECKONING_CRUISE_MS) {
        const over = timeSinceLastData - DEAD_RECKONING_CRUISE_MS;
        deadReckoningFactor = Math.max(0, 1 - over / DEAD_RECKONING_FADEOUT_MS);
    }

    const maxExtrapolatedDist = rt.prevRawDist + MAX_DEAD_RECKONING_LEAD_COORD;
    const hardCeilingDist = Math.min(totalDist, maxExtrapolatedDist);

    if (dist >= hardCeilingDist || dist >= totalDist - STOP_DECEL_ZONE * 0.5) {
        deadReckoningFactor = 0;
    }

    if (rt.velocity <= STOP_THRESHOLD && deadReckoningFactor <= 0 && Math.abs(gap) < 0.00002) {
        rt.markerDist = target;
        return {shouldSleep: true, position: rt.currentPos, angle: rt.currentAngle};
    }

    if (Math.abs(gap) > TELEPORT_COORD_THRESHOLD) {
        dist = target;
        rt.markerDist = dist;
    } else if (deadReckoningFactor > 0 || gap > 0.00005) {
        const {multiplier: stopMult, nearStopIdx} = getStopSpeedMultiplier(dist, target, stopDists);

        let isDwelling = false;
        if (nearStopIdx !== null) {
            if (rt.lastDwelledStopIdx !== nearStopIdx) {
                rt.lastDwelledStopIdx = nearStopIdx;
                rt.dwellStartTime = now;
                isDwelling = true;
            } else if (now - rt.dwellStartTime < STOP_DWELL_MS) {
                isDwelling = true;
            }
        }

        if (isDwelling) {
            const dwellAdvance = activeV * 0.2 * clampedDt;
            dist = Math.min(dist + dwellAdvance, hardCeilingDist);
            rt.markerDist = dist;
        } else {
            let effectiveVelocity: number;

            if (gap > 0) {
                const baseVelocity = activeV * deadReckoningFactor * stopMult;
                const linearBoost = gap / CATCHUP_TAU_MS;
                const surgeBoost = Math.max(0, (gap - 0.0001) * 0.002);
                const catchupVelocity = Math.min(linearBoost + surgeBoost, MAX_CATCHUP_VELOCITY);
                effectiveVelocity = Math.min(MAX_CATCHUP_VELOCITY, baseVelocity + catchupVelocity);
            } else if (rt.isOvershotOnData) {
                rt.currentVelocity = Math.max(0, rt.currentVelocity * 0.92);
                effectiveVelocity = activeV * 0.35 * stopMult;
            } else {
                const leadBeyondTarget = Math.max(0, dist - target);
                const extraProgress = Math.min(1, leadBeyondTarget / Math.max(0.001, MAX_DEAD_RECKONING_LEAD_COORD));
                const taperFactor = POST_TARGET_VELOCITY_RATIO * (1 - extraProgress * 0.15);
                effectiveVelocity = activeV * deadReckoningFactor * stopMult * taperFactor;
            }

            const advance = effectiveVelocity * clampedDt;
            if (advance > 0) {
                dist = Math.min(dist + advance, hardCeilingDist);
                rt.markerDist = dist;
            }
        }
    }

    const {segIdx, t} = scalarToSegT(cumDist, dist);
    const {position: pos, angle: pathAngle} = positionFromSegT(polyline, segIdx, t);
    const angle = interpolateAngle(rt.currentAngle, pathAngle, ANGULAR_SMOOTHING_FACTOR);

    rt.currentPos = pos;
    rt.currentAngle = angle;

    return {shouldSleep: false, position: pos, angle};
}
