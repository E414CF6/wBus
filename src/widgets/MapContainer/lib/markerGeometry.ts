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
 */
export function findNearestFeatureColor(
    stopLat: number,
    stopLng: number,
    features: Feature[],
    fallbackColor: string = SHARED_BLUE_COLOR
): string {
    let minDistance = Infinity;
    let matchedColor = fallbackColor;

    for (const feat of features) {
        if (feat.geometry.type !== "LineString") continue;
        const color = feat.properties?.color;
        if (!color) continue;

        const coords = feat.geometry.coordinates as [number, number][];
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
