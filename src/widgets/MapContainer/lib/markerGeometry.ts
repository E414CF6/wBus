import type {Feature} from "geojson";
import {SHARED_BLUE_COLOR} from "@entities/route/polylineService";

/**
 * Calculates perpendicular/segment distance from a point to a 2D line segment in meters.
 */
export function getDistanceToSegmentMeters(
    point: [number, number],
    segA: [number, number],
    segB: [number, number]
): number {
    const [pLat, pLng] = point;
    const [aLat, aLng] = segA;
    const [bLat, bLng] = segB;

    const cosLat = Math.cos((pLat * Math.PI) / 180);
    const dLat = (bLat - aLat) * 111000;
    const dLng = (bLng - aLng) * 111000 * cosLat;
    const lenSq = dLat * dLat + dLng * dLng;

    if (lenSq === 0) {
        const dy = (pLat - aLat) * 111000;
        const dx = (pLng - aLng) * 111000 * cosLat;
        return Math.sqrt(dx * dx + dy * dy);
    }

    const apLat = (pLat - aLat) * 111000;
    const apLng = (pLng - aLng) * 111000 * cosLat;
    const t = Math.max(0, Math.min(1, (apLat * dLat + apLng * dLng) / lenSq));

    const projLat = aLat + t * (bLat - aLat);
    const projLng = aLng + t * (bLng - aLng);

    const dy = (pLat - projLat) * 111000;
    const dx = (pLng - projLng) * 111000 * cosLat;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Finds the nearest polyline segment feature color to a given bus stop coordinate.
 * Pre-filters features using a fast bounding-box check before segment-level distance math.
 */
export function findNearestFeatureColor(
    stopLat: number,
    stopLng: number,
    features: Feature[],
    fallbackColor: string = SHARED_BLUE_COLOR
): string {
    let minDistance = Infinity;
    let matchedColor = fallbackColor;
    const cosLat = Math.cos((stopLat * Math.PI) / 180);

    for (const feat of features) {
        if (feat.geometry.type !== "LineString") continue;
        const color = feat.properties?.color;
        if (!color) continue;

        const coords = feat.geometry.coordinates as [number, number][];
        if (coords.length < 2) continue;

        // Fast bounding-box lower bound in meters before scanning segments
        let minLng = Infinity;
        let maxLng = -Infinity;
        let minLat = Infinity;
        let maxLat = -Infinity;
        for (let i = 0; i < coords.length; i++) {
            const [lng, lat] = coords[i];
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        }

        const dxDeg = stopLng < minLng ? minLng - stopLng : stopLng > maxLng ? stopLng - maxLng : 0;
        const dyDeg = stopLat < minLat ? minLat - stopLat : stopLat > maxLat ? stopLat - maxLat : 0;
        if (dxDeg > 0 || dyDeg > 0) {
            const bboxDist = Math.hypot(dxDeg * 111000 * cosLat, dyDeg * 111000);
            if (bboxDist >= minDistance) continue;
        }

        for (let i = 0; i < coords.length - 1; i++) {
            const segA: [number, number] = [coords[i][1], coords[i][0]];
            const segB: [number, number] = [coords[i + 1][1], coords[i + 1][0]];
            const dist = getDistanceToSegmentMeters([stopLat, stopLng], segA, segB);
            if (dist < minDistance) {
                minDistance = dist;
                matchedColor = color;
            }
        }
    }

    return matchedColor;
}
