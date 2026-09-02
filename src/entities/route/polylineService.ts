"use client";

import {getPolyline, getSegmentsJSON} from "@entities/route/api";
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
    stopPolylineIndices?: number[];
    inactiveUpSegments?: PolylineSegment[];
    inactiveDownSegments?: PolylineSegment[];
    bounds?: [[number, number], [number, number]] | null;
}

export interface PolylineSegment {
    coords: Coordinate[];
    routeIds: string[];
    direction: "up" | "down";
}

export interface MultiPolylineData {
    activeUpSegments: PolylineSegment[];
    activeDownSegments: PolylineSegment[];
    inactiveUpSegments: PolylineSegment[];
    inactiveDownSegments: PolylineSegment[];
    bounds: [[number, number], [number, number]] | null;
}

const processedCache = new CacheManager<PolylineData>(50);

async function buildStopIndexMap(upPolyline: Coordinate[], downPolyline: Coordinate[], data: GeoPolyline): Promise<StopIndexMap | undefined> {
    const stops = data.stops || [];
    if (stops.length === 0) return undefined;

    const map: StopIndexMap = {byId: {}, byIdDir: {}, byOrd: {}, byOrdDir: {}};

    let stationMap: Record<string, StationLocation> = {};
    try {
        stationMap = await getStationMap();
    } catch (_e) {
        console.warn("Failed to get station map for exact stop indexing", _e);
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

            const station = rawId ? stationMap[rawId] : null;
            if (station && polyline.length >= 2) {
                // We enforce monotonicity by forcing minSegmentIndex to lastIdx
                const searchRadius = Math.max(100, Math.floor(polyline.length / dirStops.length) * 3);
                const snapped = snapPointToPolyline([station.gpslati, station.gpslong], polyline, {
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

    let segmentsData: Record<string, [number, number][]> = {};
    try {
        segmentsData = await getSegmentsJSON();
    } catch {
        // Fallback for missing segment.json
    }

    const assemblePolyline = (segmentIds: string[]): [number, number][] => {
        if (!segmentIds || segmentIds.length === 0) return [];
        const coords: [number, number][] = [];
        let segmentsAdded = 0;

        for (const segId of segmentIds) {
            const segCoords = segmentsData[segId];
            if (segCoords && segCoords.length > 0) {
                if (coords.length > 0) {
                    const cFirst = coords[0];
                    const cLast = coords[coords.length - 1];
                    const sFirst = segCoords[0];
                    const sLast = segCoords[segCoords.length - 1];

                    if (cLast[0] === sFirst[0] && cLast[1] === sFirst[1]) {
                        coords.push(...segCoords.slice(1));
                    } else if (cLast[0] === sLast[0] && cLast[1] === sLast[1]) {
                        const reversedSeg = [...segCoords].reverse();
                        coords.push(...reversedSeg.slice(1));
                    } else if (segmentsAdded === 1 && cFirst[0] === sFirst[0] && cFirst[1] === sFirst[1]) {
                        coords.reverse();
                        coords.push(...segCoords.slice(1));
                    } else if (segmentsAdded === 1 && cFirst[0] === sLast[0] && cFirst[1] === sLast[1]) {
                        coords.reverse();
                        const reversedSeg = [...segCoords].reverse();
                        coords.push(...reversedSeg.slice(1));
                    } else {
                        coords.push(...segCoords);
                    }
                } else {
                    coords.push(...segCoords);
                }
                segmentsAdded++;
            }
        }
        return coords;
    };

    const upCoords = assemblePolyline(rawData.up_segments);
    const downCoords = assemblePolyline(rawData.down_segments);

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

    let stationMap: Record<string, StationLocation> = {};
    try {
        stationMap = await getStationMap();
    } catch {
        // Warning ignored
    }

    const buildPolylineFromStops = (dirStops: typeof rawData.stops, stationMapData: Record<string, StationLocation>): Coordinate[] => {
        const coords: Coordinate[] = [];
        const sorted = [...dirStops].sort((a, b) => a.ord - b.ord);
        for (const s of sorted) {
            const rawId = typeof s.id === "string" ? s.id.trim() : "";
            const station = rawId ? stationMapData[rawId] : null;
            const sCoords = s as { id?: string; ord: number; lat?: number; lon?: number };
            if (station && isFiniteNumber(station.gpslati) && isFiniteNumber(station.gpslong)) {
                coords.push([station.gpslati, station.gpslong]);
            } else if (isFiniteNumber(sCoords.lat) && isFiniteNumber(sCoords.lon)) {
                coords.push([sCoords.lat!, sCoords.lon!]);
            }
        }
        return coords;
    };

    const stops = rawData.stops || [];
    const upStops = stops.filter(s => Number(s.ud) === 1);
    const downStops = stops.filter(s => Number(s.ud) === 0);

    const upSpan = getPolylineSpanMeters(upPolyline);
    const upStopsPoly = buildPolylineFromStops(upStops, stationMap);
    const upStopSpan = getPolylineSpanMeters(upStopsPoly);

    if (upSpan < 1000 && upStopSpan > 1500) {
        upPolyline = upStopsPoly;
    }

    const downSpan = getPolylineSpanMeters(downPolyline);
    const downStopsPoly = buildPolylineFromStops(downStops, stationMap);
    const downStopSpan = getPolylineSpanMeters(downStopsPoly);

    if (downSpan < 1000 && downStopSpan > 1500) {
        downPolyline = downStopsPoly;
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
    const maxDegLng = maxDistMeters / 88000;
    const maxDistSq = maxDegLat * maxDegLat;

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
            const distSq = (pLat - aLat) ** 2 + (pLng - aLng) ** 2;
            if (distSq <= maxDistSq) return true;
            continue;
        }

        const t = Math.max(0, Math.min(1, ((pLat - aLat) * dLat + (pLng - aLng) * dLng) / lenSq));
        const projLat = aLat + t * dLat;
        const projLng = aLng + t * dLng;
        const distSq = (pLat - projLat) ** 2 + (pLng - projLng) ** 2;
        if (distSq <= maxDistSq) return true;
    }

    return false;
}

/**
 * Builds a clean GeoJSON FeatureCollection where:
 * - Overlapping/shared route segments across sub-routes are styled in unified blue (#2563eb) without duplicates.
 * - Diverging/unique branch segments receive distinct palette colors (#059669, #d97706, etc.).
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

            const otherPolylines = validRouteIds
                .filter((_, idx) => idx !== rIdx)
                .map(id => polylineMap.get(id)?.[polylineKey])
                .filter((p): p is Coordinate[] => Boolean(p && p.length >= 2));

            // Classify each edge along this route variant
            const edgeInfos: Array<{ isShared: boolean; color: string }> = [];
            for (let i = 0; i < poly.length - 1; i++) {
                const mid: Coordinate = [(poly[i][0] + poly[i + 1][0]) / 2, (poly[i][1] + poly[i + 1][1]) / 2];
                let isShared = false;
                for (const otherPoly of otherPolylines) {
                    if (isPointNearPolyline(mid, otherPoly, 25)) {
                        isShared = true;
                        break;
                    }
                }

                let color = SHARED_BLUE_COLOR;
                if (!isShared) {
                    // Unique to this route ID
                    color = BRANCH_PALETTE[(rIdx > 0 ? rIdx - 1 : 0) % BRANCH_PALETTE.length];
                }
                edgeInfos.push({isShared, color});
            }

            // Group contiguous edges of same color into LineString features
            let currentGroupCoords: [number, number][] = [[poly[0][1], poly[0][0]]];
            let currentColor = edgeInfos[0]?.color ?? SHARED_BLUE_COLOR;
            let currentShared = edgeInfos[0]?.isShared ?? false;

            for (let i = 0; i < edgeInfos.length; i++) {
                currentGroupCoords.push([poly[i + 1][1], poly[i + 1][0]]);

                const isLast = i === edgeInfos.length - 1;
                const nextInfo = !isLast ? edgeInfos[i + 1] : null;

                if (isLast || nextInfo?.color !== currentColor) {
                    // Only emit shared segment for the primary route (rIdx === 0) to avoid drawing duplicate overlapping blue lines
                    const shouldEmit = !currentShared || rIdx === 0;

                    if (shouldEmit && currentGroupCoords.length >= 2) {
                        features.push({
                            type: "Feature",
                            geometry: {
                                type: "LineString",
                                coordinates: currentGroupCoords
                            },
                            properties: {
                                route_id: rId,
                                direction: dir,
                                color: currentColor,
                                is_shared: currentShared
                            }
                        });
                    }

                    if (!isLast && nextInfo) {
                        currentGroupCoords = [[poly[i + 1][1], poly[i + 1][0]]];
                        currentColor = nextInfo.color;
                        currentShared = nextInfo.isShared;
                    }
                }
            }
        }
    }

    return {type: "FeatureCollection", features};
}

export function createMultiPolylineData(polylineMap: Map<string, PolylineData>, activeRouteIds?: string[]): MultiPolylineData {
    const segmentMap = new Map<string, PolylineSegment>();
    const activeSet = new Set(activeRouteIds ?? []);
    const generateKey = (coords: Coordinate[]) => {
        const n = coords.length;
        if (n === 0) return "empty";
        const first = coords[0];
        const last = coords[n - 1];
        const mid = coords[Math.floor(n / 2)];
        return `${n}:${first[0].toFixed(6)},${first[1].toFixed(6)}:${mid[0].toFixed(6)},${mid[1].toFixed(6)}:${last[0].toFixed(6)},${last[1].toFixed(6)}`;
    };
    const addSegments = (routeId: string, coords: Coordinate[], dir: "up" | "down") => {
        if (coords.length < 2) return;
        const key = `${dir}:${generateKey(coords)}`;
        const existing = segmentMap.get(key);
        if (existing) {
            if (!existing.routeIds.includes(routeId)) existing.routeIds.push(routeId);
        } else {
            segmentMap.set(key, {coords, routeIds: [routeId], direction: dir});
        }
    };
    for (const [routeId, data] of polylineMap) {
        addSegments(routeId, data.upPolyline, "up");
        addSegments(routeId, data.downPolyline, "down");
    }
    const activeUp: PolylineSegment[] = [];
    const activeDown: PolylineSegment[] = [];
    const inactiveUp: PolylineSegment[] = [];
    const inactiveDown: PolylineSegment[] = [];
    for (const segment of segmentMap.values()) {
        const isActive = activeSet.size === 0 || segment.routeIds.some((id) => activeSet.has(id));
        const targetUp = segment.direction === "up" ? (isActive ? activeUp : inactiveUp) : null;
        const targetDown = segment.direction === "down" ? (isActive ? activeDown : inactiveDown) : null;
        if (targetUp) targetUp.push(segment);
        if (targetDown) targetDown.push(segment);
    }
    let bounds: [[number, number], [number, number]] | null = null;
    for (const data of polylineMap.values()) {
        if (data.bbox) {
            if (!bounds) {
                bounds = data.bbox;
            } else {
                bounds = [[Math.min(bounds[0][0], data.bbox[0][0]), Math.min(bounds[0][1], data.bbox[0][1])], [Math.max(bounds[1][0], data.bbox[1][0]), Math.max(bounds[1][1], data.bbox[1][1])],];
            }
        }
    }
    return {
        activeUpSegments: activeUp,
        activeDownSegments: activeDown,
        inactiveUpSegments: inactiveUp,
        inactiveDownSegments: inactiveDown,
        bounds
    };
}
