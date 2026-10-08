"use client";

import {getPolyline} from "@entities/route/api";
import type {Coordinate, GeoPolyline} from "@entities/route/types";

import {CacheManager} from "@shared/cache/CacheManager";
import {getStationMap} from "@entities/station/api";
import type {StationLocation} from "@entities/station/types";
import {isFiniteNumber, snapPointToPolyline} from "@shared/utils/geo";

import type {Feature, FeatureCollection} from "geojson";

export interface StopIndexMap {
    byId: Record<string, number>;
    byIdDir: Record<string, number>;
    byOrd: Record<string, number>;
    byOrdDir: Record<string, number>;
}

export interface PolylineData {
    upPolyline: Coordinate[];
    downPolyline: Coordinate[];
    stopIndexMap?: StopIndexMap;
    turnIndex?: number;
    bbox?: [[number, number], [number, number]];
}

const processedCache = new CacheManager<PolylineData>(50);

async function buildStopIndexMap(upPolyline: Coordinate[], downPolyline: Coordinate[], data: GeoPolyline): Promise<StopIndexMap | undefined> {
    const stops = data.stops || [];
    if (stops.length === 0) return undefined;

    const map: StopIndexMap = {byId: {}, byIdDir: {}, byOrd: {}, byOrdDir: {}};

    const needsStationMap = stops.some(s => s.lat === undefined || s.lon === undefined);
    let stationMap: Record<string, StationLocation> = {};
    if (needsStationMap) {
        try {
            stationMap = await getStationMap();
        } catch (_e) {
            console.warn("Failed to get station map for exact stop indexing", _e);
        }
    }

    // Group stops by direction and strictly sort by order
    const upStops = stops.filter(s => Number(s.ud) === 1).sort((a, b) => a.ord - b.ord);
    const downStops = stops.filter(s => Number(s.ud) === 0).sort((a, b) => a.ord - b.ord);

    const processStops = (dirStops: typeof stops, polyline: Coordinate[], dir: number) => {
        let lastIdx = 0;
        dirStops.forEach((stop, i) => {
            const rawId = typeof stop.id === "string" ? stop.id.trim() : "";
            const ord = Number(stop.ord);
            let exactIndex = lastIdx;

            const stopLat = stop.lat ?? (rawId ? stationMap[rawId]?.gpslati : undefined);
            const stopLon = stop.lon ?? (rawId ? stationMap[rawId]?.gpslong : undefined);

            if (isFiniteNumber(stopLat) && isFiniteNumber(stopLon) && polyline.length >= 2) {
                // We enforce monotonicity by forcing minSegmentIndex to lastIdx
                const searchRadius = Math.max(100, Math.floor(polyline.length / dirStops.length) * 3);
                const snapped = snapPointToPolyline([stopLat!, stopLon!], polyline, {
                    minSegmentIndex: lastIdx,
                    searchRadius: searchRadius,
                    segmentHint: lastIdx
                });

                if (snapped && snapped.segmentIndex >= lastIdx) {
                    exactIndex = snapped.segmentIndex;
                }
            } else {
                // Fallback ratio calculation
                const remainingNodes = dirStops.length - i;
                const remainingSegments = (polyline.length - 1) - lastIdx;
                if (remainingNodes > 0) {
                    exactIndex = lastIdx + Math.floor(remainingSegments / remainingNodes);
                }
            }

            lastIdx = exactIndex;

            if (rawId) {
                map.byId[rawId] = exactIndex;
                if (Number.isFinite(dir)) map.byIdDir[`${rawId}-${dir}`] = exactIndex;
            }
            const relOrd = i + 1;
            if (Number.isFinite(dir)) {
                if (Number.isFinite(ord)) map.byOrdDir[`${ord}-${dir}`] = exactIndex;
                map.byOrdDir[`${relOrd}-${dir}`] = exactIndex;
            }
            if (Number.isFinite(ord)) {
                map.byOrd[String(ord)] = exactIndex;
            }
        });
    };

    processStops(upStops, upPolyline, 1);
    processStops(downStops, downPolyline, 0);

    return map;
}

function extractBBox(data: GeoPolyline, coords: [number, number][]): [[number, number], [number, number]] | undefined {
    const bbox = data.bbox;
    if (bbox && bbox.length === 4) {
        return [[bbox[1], bbox[0]], [bbox[3], bbox[2]]];
    }

    if (coords.length === 0) return undefined;
    let [minLng, minLat, maxLng, maxLat] = [coords[0][0], coords[0][1], coords[0][0], coords[0][1]];
    for (const [lng, lat] of coords) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
    }
    return [[minLat, minLng], [maxLat, maxLng]];
}

async function fetchRoutePolyline(routeId: string): Promise<PolylineData> {
    const cached = processedCache.get(routeId);
    if (cached) return cached;
    const rawData = await getPolyline(routeId);
    if (!rawData || !rawData.stops) {
        const empty: PolylineData = {upPolyline: [], downPolyline: [], turnIndex: 0};
        processedCache.set(routeId, empty);
        return empty;
    }

    const upCoords = rawData.up_polyline || [];
    const downCoords = rawData.down_polyline || [];

    // Convert coordinates from [lng, lat] (GeoJSON standard) to [lat, lng] (Leaflet/frontend standard)
    let upPolyline: Coordinate[] = upCoords.map(([lng, lat]) => [lat, lng]);
    let downPolyline: Coordinate[] = downCoords.map(([lng, lat]) => [lat, lng]);

    // Runtime Fallback: Validate polyline span against stop sequence to prevent collapsed polylines
    const getPolylineSpanMeters = (line: Coordinate[]): number => {
        if (line.length < 2) return 0;
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        for (const [lat, lng] of line) {
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
        }
        const dLat = maxLat - minLat;
        const dLng = maxLng - minLng;
        return Math.sqrt(dLat * dLat + dLng * dLng) * 111000;
    };

    let stationMap: Record<string, StationLocation> | null = null;
    const getStationMapLazy = async (): Promise<Record<string, StationLocation>> => {
        if (!stationMap) {
            try {
                stationMap = await getStationMap();
            } catch {
                stationMap = {};
            }
        }
        return stationMap;
    };

    const buildPolylineFromStops = async (dirStops: typeof rawData.stops): Promise<Coordinate[]> => {
        const coords: Coordinate[] = [];
        const sorted = [...dirStops].sort((a, b) => a.ord - b.ord);
        const mapData = dirStops.some(s => s.lat === undefined || s.lon === undefined) ? await getStationMapLazy() : {};

        for (const s of sorted) {
            const rawId = typeof s.id === "string" ? s.id.trim() : "";
            const station = rawId ? mapData[rawId] : null;
            const sCoords = s as { id?: string; ord: number; lat?: number; lon?: number };
            if (isFiniteNumber(sCoords.lat) && isFiniteNumber(sCoords.lon)) {
                coords.push([sCoords.lat!, sCoords.lon!]);
            } else if (station && isFiniteNumber(station.gpslati) && isFiniteNumber(station.gpslong)) {
                coords.push([station.gpslati, station.gpslong]);
            }
        }
        return coords;
    };

    const stops = rawData.stops || [];
    const upStops = stops.filter(s => Number(s.ud) === 1);
    const downStops = stops.filter(s => Number(s.ud) === 0);

    const upSpan = getPolylineSpanMeters(upPolyline);
    if (upSpan < 1000 && upStops.length >= 2) {
        const upStopsPoly = await buildPolylineFromStops(upStops);
        const upStopSpan = getPolylineSpanMeters(upStopsPoly);
        if (upStopSpan > 1500) {
            upPolyline = upStopsPoly;
        }
    }

    const downSpan = getPolylineSpanMeters(downPolyline);
    if (downSpan < 1000 && downStops.length >= 2) {
        const downStopsPoly = await buildPolylineFromStops(downStops);
        const downStopSpan = getPolylineSpanMeters(downStopsPoly);
        if (downStopSpan > 1500) {
            downPolyline = downStopsPoly;
        }
    }

    const result: PolylineData = {
        upPolyline,
        downPolyline,
        stopIndexMap: await buildStopIndexMap(upPolyline, downPolyline, rawData),
        turnIndex: upPolyline.length > 0 ? upPolyline.length - 1 : 0,
        bbox: extractBBox(rawData, [...upCoords, ...downCoords]),
    };
    processedCache.set(routeId, result);
    return result;
}

export async function fetchRoutePolylines(routeIds: string[]): Promise<Map<string, PolylineData>> {
    const results = await Promise.all(routeIds.map(async (id) => ({id, data: await fetchRoutePolyline(id)})));
    const map = new Map<string, PolylineData>();
    for (const {id, data} of results) map.set(id, data);
    return map;
}

// ----------------------------------------------------------------------
// Smart Polyline Segmentation & Color Assignment
// ----------------------------------------------------------------------

export const SHARED_BLUE_COLOR = "#2563eb"; // Blue (공통 중복 구간)

export const BRANCH_PALETTE = [
    "#059669", // Emerald (분기 1)
    "#d97706", // Amber (분기 2)
    "#7c3aed", // Purple (분기 3)
    "#e11d48", // Rose (분기 4)
    "#0891b2", // Cyan (분기 5)
    "#ea580c", // Orange (분기 6)
    "#db2777", // Pink (분기 7)
];

/**
 * Checks if a given coordinate point is within maxDistMeters of any segment in polyline.
 */
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

        // Bounding box quick check
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

/**
 * Builds a clean GeoJSON FeatureCollection where:
 * - Overlapping/shared route segments across sub-routes are styled in unified blue (#2563eb) without duplicates.
 * - Diverging/unique branch segments receive distinct palette colors (#059669, #d97706, etc.).
 * - Every route segment is guaranteed to be emitted once (no missing branch segments).
 */
export function buildSegmentedRouteGeoJson(
    validRouteIds: string[],
    polylineMap: Map<string, PolylineData>
): FeatureCollection | null {
    if (validRouteIds.length === 0) return null;
    const features: Feature[] = [];

    // Single route ID case: Entire route in unified blue
    if (validRouteIds.length === 1) {
        const id = validRouteIds[0];
        const data = polylineMap.get(id);
        if (!data) return null;

        if (data.upPolyline.length >= 2) {
            features.push({
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: data.upPolyline.map((c) => [c[1], c[0]])
                },
                properties: {
                    route_id: id,
                    direction: "up",
                    color: SHARED_BLUE_COLOR,
                    is_shared: true
                }
            });
        }
        if (data.downPolyline.length >= 2) {
            features.push({
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: data.downPolyline.map((c) => [c[1], c[0]])
                },
                properties: {
                    route_id: id,
                    direction: "down",
                    color: SHARED_BLUE_COLOR,
                    is_shared: true
                }
            });
        }
        return {type: "FeatureCollection", features};
    }

    // Multiple route IDs: Segment into shared (blue) vs distinct branch colors
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

            // Classify each edge along this route variant
            interface EdgeClassification {
                shouldEmit: boolean;
                color: string;
                isShared: boolean;
            }

            const edgeInfos: EdgeClassification[] = [];
            for (let i = 0; i < poly.length - 1; i++) {
                const mid: Coordinate = [(poly[i][0] + poly[i + 1][0]) / 2, (poly[i][1] + poly[i + 1][1]) / 2];

                // Check if this edge is shared with ANY other sub-route
                let isShared = false;
                for (const otherPoly of otherPolylines) {
                    if (isPointNearPolyline(mid, otherPoly, 25)) {
                        isShared = true;
                        break;
                    }
                }

                // Deduplication: Only emit if an earlier sub-route has NOT already emitted this edge
                let inEarlier = false;
                for (const earlierPoly of earlierPolylines) {
                    if (isPointNearPolyline(mid, earlierPoly, 25)) {
                        inEarlier = true;
                        break;
                    }
                }

                const shouldEmit = !inEarlier;
                const color = isShared
                    ? SHARED_BLUE_COLOR
                    : BRANCH_PALETTE[(rIdx > 0 ? rIdx - 1 : 0) % BRANCH_PALETTE.length];

                edgeInfos.push({shouldEmit, color, isShared});
            }

            // Group contiguous edges to emit into clean LineString features
            let activeCoords: [number, number][] | null = null;
            let activeColor = SHARED_BLUE_COLOR;
            let activeShared = false;

            const flushActive = () => {
                if (activeCoords && activeCoords.length >= 2) {
                    features.push({
                        type: "Feature",
                        geometry: {
                            type: "LineString",
                            coordinates: activeCoords
                        },
                        properties: {
                            route_id: rId,
                            direction: dir,
                            color: activeColor,
                            is_shared: activeShared
                        }
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
                    // Color changed between contiguous edges
                    flushActive();
                    activeCoords = [startPoint, endPoint];
                    activeColor = color;
                    activeShared = isShared;
                }
            }

            flushActive();
        }
    }

    return {type: "FeatureCollection", features};
}
