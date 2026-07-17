"use client";

import {getPolyline, getSegmentsJSON} from "@entities/route/api";
import type {Coordinate, GeoPolyline} from "@entities/route/types";

import {CacheManager} from "@shared/cache/CacheManager";

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
    turnIndex: number;
    bbox?: [[number, number], [number, number]];
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

function buildStopIndexMap(upPolyline: Coordinate[], downPolyline: Coordinate[], data: GeoPolyline): StopIndexMap | undefined {
    const stops = data.stops || [];
    if (stops.length === 0) return undefined;

    const map: StopIndexMap = {byId: {}, byIdDir: {}, byOrd: {}, byOrdDir: {}};

    // Group stops by direction
    const upStops = stops.filter(s => Number(s.ud) === 1);
    const downStops = stops.filter(s => Number(s.ud) === 0);

    let upCount = 0;
    let downCount = 0;

    stops.forEach((stop) => {
        const rawId = typeof stop.id === "string" ? stop.id.trim() : "";
        const ord = Number(stop.ord);
        const dir = Number(stop.ud);

        let roughIndex = 0;
        if (dir === 1) {
            const ratio = upStops.length > 1 ? upCount / (upStops.length - 1) : 0;
            roughIndex = Math.floor(ratio * (upPolyline.length - 1));
            upCount++;
        } else {
            const ratio = downStops.length > 1 ? downCount / (downStops.length - 1) : 0;
            roughIndex = Math.floor(ratio * (downPolyline.length - 1));
            downCount++;
        }

        if (rawId) {
            map.byId[rawId] = roughIndex;
            if (Number.isFinite(dir)) map.byIdDir[`${rawId}-${dir}`] = roughIndex;
        }
        if (Number.isFinite(ord)) {
            map.byOrd[String(ord)] = roughIndex;
            if (Number.isFinite(dir)) map.byOrdDir[`${ord}-${dir}`] = roughIndex;
        }
    });
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
    } catch (e) {
        // Fallback for missing segments.json
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
    const upPolyline: Coordinate[] = upCoords.map(([lng, lat]) => [lat, lng]);
    const downPolyline: Coordinate[] = downCoords.map(([lng, lat]) => [lat, lng]);

    const result: PolylineData = {
        upPolyline,
        downPolyline,
        stopIndexMap: buildStopIndexMap(upPolyline, downPolyline, rawData),
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

export const PALETTE = [
    {up: "#2563eb", down: "#dc2626"}, // 0: Blue / Red (Standard)
    {up: "#7c3aed", down: "#ea580c"}, // 1: Violet / Orange
    {up: "#0d9488", down: "#db2777"}, // 2: Teal / Pink
    {up: "#059669", down: "#e11d48"}, // 3: Emerald / Rose
] as const;

export function areCoordinatesEqual(c1: Coordinate[], c2: Coordinate[]): boolean {
    if (c1.length !== c2.length) return false;
    const steps = [0, Math.floor(c1.length / 4), Math.floor(c1.length / 2), Math.floor(c1.length * 3 / 4), c1.length - 1];
    for (const idx of steps) {
        if (idx < c1.length) {
            const p1 = c1[idx];
            const p2 = c2[idx];
            if (!p1 || !p2 || Math.abs(p1[0] - p2[0]) > 0.0001 || Math.abs(p1[1] - p2[1]) > 0.0001) {
                return false;
            }
        }
    }
    return true;
}

export function areGeometriesEqual(g1: PolylineData, g2: PolylineData): boolean {
    return areCoordinatesEqual(g1.upPolyline, g2.upPolyline) &&
        areCoordinatesEqual(g1.downPolyline, g2.downPolyline);
}

export function getRouteIdColorMapping(routeIds: string[], polylineMap: Map<string, PolylineData>): Record<string, number> {
    const uniqueGeometries: PolylineData[] = [];
    const routeIdToColorIndex: Record<string, number> = {};

    for (const id of routeIds) {
        const data = polylineMap.get(id);
        if (!data) continue;

        let matchIdx = uniqueGeometries.findIndex(g => areGeometriesEqual(g, data));
        if (matchIdx === -1) {
            matchIdx = uniqueGeometries.length;
            uniqueGeometries.push(data);
        }
        routeIdToColorIndex[id] = matchIdx;
    }

    // If all variations have the same geometry, fall back to color index 0 for all
    if (uniqueGeometries.length <= 1) {
        for (const id of routeIds) {
            routeIdToColorIndex[id] = 0;
        }
    }

    return routeIdToColorIndex;
}
