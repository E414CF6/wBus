"use client";

import type {Coordinate} from "@entities/route/types";
import {CacheManager} from "@shared/cache/CacheManager";
import type {Feature, FeatureCollection} from "geojson";
import type {PolylineData} from "./polylineService";

const segmentedGeoJsonCache = new CacheManager<FeatureCollection>({
    maxSize: 100,
    ttlMs: 24 * 60 * 60 * 1000,
});

export const SHARED_BLUE_COLOR = "#2563eb";

export const BRANCH_PALETTE = [
    "#059669",
    "#d97706",
    "#7c3aed",
    "#e11d48",
    "#0891b2",
    "#ea580c",
    "#db2777",
];

export function clearSegmentedGeoJsonCache(): void {
    segmentedGeoJsonCache.clear();
}

export function isPointNearPolyline(point: Coordinate, polyline: Coordinate[], maxDistMeters = 30): boolean {
    if (!polyline || polyline.length < 2) return false;
    const [pLat, pLng] = point;
    const maxDegLat = maxDistMeters / 111000;
    const cosLat = Math.cos((pLat * Math.PI) / 180);
    const maxDegLng = maxDistMeters / (111000 * Math.max(0.1, cosLat));
    const maxDistSq = maxDistMeters * maxDistMeters;

    for (let i = 0; i < polyline.length - 1; i++) {
        const [aLat, aLng] = polyline[i];
        const [bLat, bLng] = polyline[i + 1];

        const minLat = Math.min(aLat, bLat) - maxDegLat;
        const maxLat = Math.max(aLat, bLat) + maxDegLat;
        const minLng = Math.min(aLng, bLng) - maxDegLng;
        const maxLng = Math.max(aLng, bLng) + maxDegLng;

        if (pLat < minLat || pLat > maxLat || pLng < minLng || pLng > maxLng) {
            continue;
        }

        const dLat = bLat - aLat;
        const dLng = bLng - aLng;
        const lenSq = dLat * dLat + dLng * dLng;
        if (lenSq === 0) {
            const dy = (pLat - aLat) * 111000;
            const dx = (pLng - aLng) * 111000 * cosLat;
            if (dx * dx + dy * dy <= maxDistSq) return true;
            continue;
        }

        const t = Math.max(0, Math.min(1, ((pLat - aLat) * dLat + (pLng - aLng) * dLng) / lenSq));
        const projLat = aLat + t * dLat;
        const projLng = aLng + t * dLng;
        const dy = (pLat - projLat) * 111000;
        const dx = (pLng - projLng) * 111000 * cosLat;
        if (dx * dx + dy * dy <= maxDistSq) return true;
    }

    return false;
}

export function buildSegmentedRouteGeoJson(
    validRouteIds: string[],
    polylineMap: Map<string, PolylineData>,
    baseColor: string = SHARED_BLUE_COLOR
): FeatureCollection | null {
    if (validRouteIds.length === 0) return null;

    const keyParts: string[] = [baseColor];
    let hasAnyData = false;
    for (const id of validRouteIds) {
        const d = polylineMap.get(id);
        if (d) {
            hasAnyData = true;
            keyParts.push(`${id}:${d.upPolyline.length}:${d.downPolyline.length}`);
        } else {
            keyParts.push(`${id}:0:0`);
        }
    }
    if (!hasAnyData) return null;

    const cacheKey = keyParts.join("|");
    const cachedGeoJson = segmentedGeoJsonCache.get(cacheKey);
    if (cachedGeoJson) {
        return cachedGeoJson;
    }

    const features: Feature[] = [];

    if (validRouteIds.length === 1) {
        const id = validRouteIds[0];
        const data = polylineMap.get(id);
        if (!data) return null;

        if (data.upPolyline.length >= 2) {
            features.push({
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: data.upPolyline.map((c) => [c[1], c[0]]),
                },
                properties: {route_id: id, direction: "up", color: baseColor, is_shared: true},
            });
        }
        if (data.downPolyline.length >= 2) {
            features.push({
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: data.downPolyline.map((c) => [c[1], c[0]]),
                },
                properties: {route_id: id, direction: "down", color: baseColor, is_shared: true},
            });
        }
        const singleResult: FeatureCollection = {type: "FeatureCollection", features};
        segmentedGeoJsonCache.set(cacheKey, singleResult);
        return singleResult;
    }

    const directions: Array<"up" | "down"> = ["up", "down"];

    for (const dir of directions) {
        const polylineKey = dir === "up" ? "upPolyline" : "downPolyline";

        for (let rIdx = 0; rIdx < validRouteIds.length; rIdx++) {
            const rId = validRouteIds[rIdx];
            const rData = polylineMap.get(rId);
            if (!rData) continue;
            const poly = rData[polylineKey];
            if (poly.length < 2) continue;

            const earlierPolylines = validRouteIds
                .slice(0, rIdx)
                .map((id) => polylineMap.get(id)?.[polylineKey])
                .filter((p): p is Coordinate[] => Boolean(p && p.length >= 2));

            const otherPolylines = validRouteIds
                .filter((_, idx) => idx !== rIdx)
                .map((id) => polylineMap.get(id)?.[polylineKey])
                .filter((p): p is Coordinate[] => Boolean(p && p.length >= 2));

            interface EdgeClassification {
                shouldEmit: boolean;
                color: string;
                isShared: boolean;
            }

            const edgeInfos: EdgeClassification[] = [];
            for (let i = 0; i < poly.length - 1; i++) {
                const mid: Coordinate = [(poly[i][0] + poly[i + 1][0]) / 2, (poly[i][1] + poly[i + 1][1]) / 2];

                let isShared = false;
                for (const otherPoly of otherPolylines) {
                    if (isPointNearPolyline(mid, otherPoly, 25)) {
                        isShared = true;
                        break;
                    }
                }

                let inEarlier = false;
                for (const earlierPoly of earlierPolylines) {
                    if (isPointNearPolyline(mid, earlierPoly, 25)) {
                        inEarlier = true;
                        break;
                    }
                }

                const shouldEmit = !inEarlier;
                const color = isShared
                    ? baseColor
                    : BRANCH_PALETTE[(rIdx > 0 ? rIdx - 1 : 0) % BRANCH_PALETTE.length];

                edgeInfos.push({shouldEmit, color, isShared});
            }

            let activeCoords: [number, number][] | null = null;
            let activeColor = baseColor;
            let activeShared = false;

            const flushActive = () => {
                if (activeCoords && activeCoords.length >= 2) {
                    features.push({
                        type: "Feature",
                        geometry: {type: "LineString", coordinates: activeCoords},
                        properties: {
                            route_id: rId,
                            direction: dir,
                            color: activeColor,
                            is_shared: activeShared,
                        },
                    });
                }
                activeCoords = null;
            };

            for (let i = 0; i < edgeInfos.length; i++) {
                const {shouldEmit, color, isShared} = edgeInfos[i];
                if (!shouldEmit) {
                    flushActive();
                    continue;
                }

                const startPoint: [number, number] = [poly[i][1], poly[i][0]];
                const endPoint: [number, number] = [poly[i + 1][1], poly[i + 1][0]];

                if (!activeCoords) {
                    activeCoords = [startPoint, endPoint];
                    activeColor = color;
                    activeShared = isShared;
                } else if (activeColor === color) {
                    activeCoords.push(endPoint);
                } else {
                    flushActive();
                    activeCoords = [startPoint, endPoint];
                    activeColor = color;
                    activeShared = isShared;
                }
            }

            flushActive();
        }
    }

    const result: FeatureCollection = {type: "FeatureCollection", features};
    segmentedGeoJsonCache.set(cacheKey, result);
    return result;
}
