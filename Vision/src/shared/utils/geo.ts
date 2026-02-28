export type Coordinate = [number, number];

type CoordinateLike = { readonly 0: number; readonly 1: number; readonly length: number };

export function getHaversineDistance(
    lat1: number, lon1: number, lat2: number, lon2: number
): number {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getHaversineDistanceMeters(p1: CoordinateLike, p2: CoordinateLike): number {
    return getHaversineDistance(p1[0], p1[1], p2[0], p2[1]) * 1000;
}

export function getApproxDistanceMeters(p1: CoordinateLike, p2: CoordinateLike): number {
    const latRad = ((p1[0] + p2[0]) * 0.5 * Math.PI) / 180;
    const lngScale = Math.cos(latRad);
    const dLat = p2[0] - p1[0];
    const dLng = (p2[1] - p1[1]) * lngScale;
    return Math.sqrt(dLat * dLat + dLng * dLng) * 111_000;
}

export function getEuclideanDistance(P: CoordinateLike, Q: CoordinateLike): number {
    const dx = P[0] - Q[0];
    const dy = P[1] - Q[1];
    return Math.sqrt(dx * dx + dy * dy);
}

export function getEuclideanDistanceSq(P: CoordinateLike, Q: CoordinateLike): number {
    const dx = P[0] - Q[0];
    const dy = P[1] - Q[1];
    return dx * dx + dy * dy;
}

export function calculateBearing(A: CoordinateLike, B: CoordinateLike): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;
    const lat1 = toRad(A[0]);
    const lat2 = toRad(B[0]);
    const dLon = toRad(B[1] - A[1]);
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function calculateAngle(A: Coordinate, B: Coordinate): number {
    const deltaLat = B[0] - A[0];
    const deltaLng = B[1] - A[1];
    return (Math.atan2(deltaLat, deltaLng) * 180) / Math.PI;
}

export function normalizeAngle(angle: number): number {
    return ((angle % 360) + 360) % 360;
}

export function interpolateAngle(from: number, to: number, progress: number): number {
    const normFrom = normalizeAngle(from);
    const normTo = normalizeAngle(to);
    let diff = normTo - normFrom;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return normalizeAngle(normFrom + diff * progress);
}

export interface SnapResult {
    position: Coordinate;
    angle: number;
    segmentIndex: number;
    t: number;
}

export interface SnapOptions {
    segmentHint?: number | null;
    searchRadius?: number;
    minSegmentIndex?: number | null;
}

export function projectPointOnSegment(
    P: Coordinate, A: Coordinate, B: Coordinate
): Coordinate {
    const AP = [P[0] - A[0], P[1] - A[1]];
    const AB = [B[0] - A[0], B[1] - A[1]];
    const abSquared = AB[0] * AB[0] + AB[1] * AB[1];
    if (abSquared === 0) return A;
    const t = Math.max(0, Math.min(1, (AP[0] * AB[0] + AP[1] * AB[1]) / abSquared));
    return [A[0] + AB[0] * t, A[1] + AB[1] * t];
}

export function snapPointToPolyline<T extends CoordinateLike>(
    point: CoordinateLike, polyline: T[], options?: SnapOptions
): SnapResult {
    const defaultResult: SnapResult = {
        position: [point[0], point[1]], angle: 0, segmentIndex: 0, t: 0,
    };
    if (!polyline || polyline.length < 2) return defaultResult;

    const lastSegment = polyline.length - 2;
    const hint = options?.segmentHint;
    const hasHint = typeof hint === "number" && Number.isFinite(hint);
    const radius = Math.max(0, Math.floor(options?.searchRadius ?? 0));
    const minIdx = options?.minSegmentIndex;
    const hasMinIdx = typeof minIdx === "number" && Number.isFinite(minIdx);

    const clampedHint = hasHint ? clamp(Math.round(hint), 0, lastSegment) : 0;
    const baseStartIdx = hasHint ? clamp(clampedHint - radius, 0, lastSegment) : 0;
    const startIdx = hasMinIdx ? Math.max(baseStartIdx, clamp(Math.round(minIdx), 0, lastSegment)) : baseStartIdx;
    const endIdx = hasHint ? clamp(clampedHint + radius, 0, lastSegment) : lastSegment;

    let bestDistSq = Infinity;
    let bestPos: Coordinate = [polyline[0][0], polyline[0][1]];
    let bestIdx = 0;
    let bestT = 0;
    let bestSegment: { A: T; B: T } = {A: polyline[0], B: polyline[0]};

    for (let i = startIdx; i <= endIdx; i++) {
        const A = polyline[i];
        const B = polyline[i + 1];
        const AP_x = point[0] - A[0];
        const AP_y = point[1] - A[1];
        const AB_x = B[0] - A[0];
        const AB_y = B[1] - A[1];
        const ab2 = AB_x * AB_x + AB_y * AB_y;
        let t = 0;
        if (ab2 > 0) {
            t = Math.max(0, Math.min(1, (AP_x * AB_x + AP_y * AB_y) / ab2));
        }
        const projX = A[0] + AB_x * t;
        const projY = A[1] + AB_y * t;
        const dSq = (point[0] - projX) ** 2 + (point[1] - projY) ** 2;
        if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestPos = [projX, projY];
            bestIdx = i;
            bestT = t;
            bestSegment = {A, B};
        }
    }

    return {
        position: bestPos,
        angle: calculateBearing(bestSegment.A, bestSegment.B),
        segmentIndex: bestIdx,
        t: bestT,
    };
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}
