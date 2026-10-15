/**
 * @fileoverview Resilient polyline chunking, detour filtering, and Catmull-Rom spline smoothing.
 * Designed to handle transit routes with 50~120+ stops without triggering OSRM URI length limits,
 * rate-limit bans, or all-or-nothing failures due to unmapped road stops.
 */

export type Coordinate = [number, number]; // [lng, lat] for GeoJSON / OSRM

const EARTH_RADIUS_METERS = 6371000;

export function haversineMeters(p1: Coordinate, p2: Coordinate): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(p2[1] - p1[1]);
    const dLon = toRad(p2[0] - p1[0]);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(p1[1])) * Math.cos(toRad(p2[1])) * Math.sin(dLon / 2) ** 2;
    return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculatePolylineMeters(coords: Coordinate[]): number {
    if (coords.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        total += haversineMeters(coords[i], coords[i + 1]);
    }
    return total;
}

/**
 * Catmull-Rom Cubic Spline interpolation between points p1 and p2,
 * using control points p0 and p3.
 */
export function interpolateCatmullRom(
    p0: Coordinate,
    p1: Coordinate,
    p2: Coordinate,
    p3: Coordinate,
    steps = 4
): Coordinate[] {
    const pts: Coordinate[] = [];
    for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const t2 = t * t;
        const t3 = t2 * t;

        const f0 = -0.5 * t3 + t2 - 0.5 * t;
        const f1 = 1.5 * t3 - 2.5 * t2 + 1.0;
        const f2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
        const f3 = 0.5 * t3 - 0.5 * t2;

        const lng = f0 * p0[0] + f1 * p1[0] + f2 * p2[0] + f3 * p3[0];
        const lat = f0 * p0[1] + f1 * p1[1] + f2 * p2[1] + f3 * p3[1];
        pts.push([lng, lat]);
    }
    return pts;
}

/**
 * Generates a smooth, curved polyline through all coordinates using Catmull-Rom spline.
 * Used as a graceful fallback when OSRM cannot snap to a road (e.g. depot, bus loop, or new road).
 */
export function smoothPolylineSpline(coords: Coordinate[], pointsPerSegment = 4): Coordinate[] {
    if (coords.length < 3) return coords;
    const result: Coordinate[] = [];
    const n = coords.length;

    for (let i = 0; i < n - 1; i++) {
        const p0 = coords[Math.max(0, i - 1)];
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const p3 = coords[Math.min(n - 1, i + 2)];

        const pts = interpolateCatmullRom(p0, p1, p2, p3, pointsPerSegment);
        result.push(...pts);
    }
    result.push(coords[n - 1]);
    return result;
}

/**
 * Splits a list of coordinates into overlapping sliding windows of chunkSize.
 * Each adjacent pair of chunks shares exactly 1 coordinate at the boundary to allow seamless stitching.
 */
export function chunkCoordinates(coords: Coordinate[], chunkSize = 18): Coordinate[][] {
    if (coords.length <= chunkSize) return [coords];
    const chunks: Coordinate[][] = [];
    let start = 0;
    while (start < coords.length - 1) {
        const end = Math.min(start + chunkSize, coords.length);
        chunks.push(coords.slice(start, end));
        if (end >= coords.length) break;
        start = end - 1; // 1-point overlap at the junction
    }
    return chunks;
}

/**
 * Detects whether an OSRM route is an unnatural car-only detour.
 * In South Korea, city buses often travel on dedicated transit malls or make bus-only turns.
 * Car routing profiles see this as forbidden and route 3~10km around an interchange.
 */
export function isExcessiveDetour(
    straightDistMeters: number,
    routedDistMeters: number,
    ratioThreshold = 2.6,
    absoluteExcessMeters = 1200
): boolean {
    if (straightDistMeters <= 0) return false;
    const excess = routedDistMeters - straightDistMeters;
    return routedDistMeters > straightDistMeters * ratioThreshold && excess > absoluteExcessMeters;
}

/**
 * Stitches together multiple polyline segments, eliminating duplicate junction coordinates.
 */
export function stitchPolylineSegments(segments: Coordinate[][]): Coordinate[] {
    if (segments.length === 0) return [];
    if (segments.length === 1) return segments[0];

    const result: Coordinate[] = [];

    for (const segment of segments) {
        if (segment.length === 0) continue;
        if (result.length === 0) {
            result.push(...segment);
        } else {
            const last = result[result.length - 1];
            const first = segment[0];
            const isDuplicate =
                Math.abs(last[0] - first[0]) < 1e-6 && Math.abs(last[1] - first[1]) < 1e-6;
            const startIdx = isDuplicate ? 1 : 0;
            for (let i = startIdx; i < segment.length; i++) {
                result.push(segment[i]);
            }
        }
    }

    return result;
}
