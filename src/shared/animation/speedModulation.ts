import {
    CITY_BUS_BASE_VELOCITY,
    STOP_ACCEL_ZONE,
    STOP_DECEL_ZONE,
    STOP_DWELL_PROXIMITY,
    STOP_MIN_SPEED_MULT,
    VELOCITY_PRIOR_BLEND_MAX,
    VELOCITY_PRIOR_BLEND_MIN,
    VELOCITY_PRIOR_RAMP_SAMPLES,
} from "./constants";

/**
 * Returns speed multiplier and nearest stop index info based on proximity to stops.
 * Bypasses deceleration/dwell for intermediate stops if target position has already moved past them.
 */
export function getStopSpeedMultiplier(
    markerDist: number,
    targetDist: number,
    stopDistances: number[]
): {
    multiplier: number;
    nearStopIdx: number | null;
} {
    if (stopDistances.length === 0) return {multiplier: 1.0, nearStopIdx: null};

    let minMult = 1.0;
    let nearStopIdx: number | null = null;

    let lo = 0,
        hi = stopDistances.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (stopDistances[mid] < markerDist) lo = mid + 1;
        else hi = mid;
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
export function blendVelocityWithPrior(measured: number, sampleCount: number): number {
    const trust = Math.min(
        VELOCITY_PRIOR_BLEND_MAX,
        VELOCITY_PRIOR_BLEND_MIN +
        (VELOCITY_PRIOR_BLEND_MAX - VELOCITY_PRIOR_BLEND_MIN) *
        (sampleCount / VELOCITY_PRIOR_RAMP_SAMPLES)
    );
    return trust * measured + (1 - trust) * CITY_BUS_BASE_VELOCITY;
}
