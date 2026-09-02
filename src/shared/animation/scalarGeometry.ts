import {calculateBearing, type Coordinate, getEuclideanDistance, interpolateAngle,} from "@shared/utils/geo";
import {ANGULAR_LOOKAHEAD_THRESHOLD} from "./constants";

/**
 * Computes cumulative euclidean distance array for a polyline.
 */
export function computeCumulativeDistances(polyline: readonly Coordinate[]): number[] {
    const n = polyline.length;
    if (n < 2) return n === 1 ? [0] : [];
    const cumDist = new Array<number>(n);
    cumDist[0] = 0;
    for (let i = 1; i < n; i++) {
        cumDist[i] = cumDist[i - 1] + getEuclideanDistance(polyline[i - 1], polyline[i]);
    }
    return cumDist;
}

/**
 * Computes scalar distance along a polyline segment given t in [0, 1].
 */
export function polylineScalarDist(cumDist: number[], segIdx: number, t: number): number {
    const segStart = cumDist[segIdx] ?? 0;
    const segEnd = cumDist[segIdx + 1] ?? segStart;
    return segStart + (segEnd - segStart) * t;
}

/**
 * Binary search to convert scalar distance along polyline into segment index and t [0, 1].
 */
export function scalarToSegT(cumDist: number[], distance: number): { segIdx: number; t: number } {
    const n = cumDist.length;
    if (n < 2 || distance <= 0) return {segIdx: 0, t: 0};
    if (distance >= cumDist[n - 1]) return {segIdx: n - 2, t: 1};

    let lo = 0,
        hi = n - 1;
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

/**
 * Computes 2D position and interpolated bearing angle from segment index and t.
 */
export function positionFromSegT(
    polyline: readonly Coordinate[],
    segIdx: number,
    t: number
): { position: Coordinate; angle: number } {
    const A = polyline[segIdx];
    const B = polyline[segIdx + 1] ?? A;
    const pos: Coordinate = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
    let angle = calculateBearing(A, B);

    const C = polyline[segIdx + 2];
    if (C && t > ANGULAR_LOOKAHEAD_THRESHOLD) {
        const nextAngle = calculateBearing(B, C);
        const progress = (t - ANGULAR_LOOKAHEAD_THRESHOLD) / (1 - ANGULAR_LOOKAHEAD_THRESHOLD);
        angle = interpolateAngle(angle, nextAngle, progress);
    }
    return {position: pos, angle};
}

/**
 * Convert stop coordinate indices to sorted scalar distances along polyline.
 */
export function computeStopDistances(stopCoordIndices: number[], cumDist: number[]): number[] {
    if (cumDist.length < 2 || stopCoordIndices.length === 0) return [];
    const maxIdx = cumDist.length - 1;
    const dists: number[] = [];
    for (const idx of stopCoordIndices) {
        const clamped = Math.max(0, Math.min(idx, maxIdx));
        const d = cumDist[clamped];
        if (typeof d === "number") dists.push(d);
    }
    return dists.sort((a, b) => a - b);
}
