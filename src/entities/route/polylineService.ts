"use client";

import {getPolyline} from "@entities/route/api";
import type {Coordinate, GeoPolyline} from "@entities/route/types";

import {CacheManager} from "@shared/cache/CacheManager";
import {STORAGE_KEYS} from "@shared/config/env";
import {isFiniteNumber, snapPointToPolyline} from "@shared/utils/geo";
import {findTurningDirection, smoothPolylineSpline} from "./polylineChunker";

import {clearSegmentedGeoJsonCache} from "./polylineSegmentation";

export {
    SHARED_BLUE_COLOR,
    BRANCH_PALETTE,
    isPointNearPolyline,
    buildSegmentedRouteGeoJson,
} from "./polylineSegmentation";

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

const processedCache = new CacheManager<PolylineData>({
    maxSize: 150,
    ttlMs: 24 * 60 * 60 * 1000,
});

function buildStopIndexMap(upPolyline: Coordinate[], downPolyline: Coordinate[], data: GeoPolyline): StopIndexMap | undefined {
    const stops = data.stops || [];
    if (stops.length === 0) return undefined;

    const map: StopIndexMap = {byId: {}, byIdDir: {}, byOrd: {}, byOrdDir: {}};

    // Group stops by direction and strictly sort by order
    const upStops = stops.filter(s => Number(s.ud) === 1).sort((a, b) => a.ord - b.ord);
    const downStops = stops.filter(s => Number(s.ud) === 0).sort((a, b) => a.ord - b.ord);

    const processStops = (dirStops: typeof stops, polyline: Coordinate[], dir: number) => {
        let lastIdx = 0;
        dirStops.forEach((stop, i) => {
            const rawId = typeof stop.id === "string" ? stop.id.trim() : "";
            const ord = Number(stop.ord);
            let exactIndex = lastIdx;

            const stopLat = stop.lat;
            const stopLon = stop.lon;

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

function resolveCityCode(cityCode?: string): string {
    return (
        cityCode ||
        (typeof window !== "undefined"
            ? localStorage.getItem(STORAGE_KEYS.CITY_CODE) || "32020"
            : "32020")
    );
}

/**
 * Synchronously inspect processed polyline cache for a set of routeIds.
 * Returns a populated Map if all requested routeIds are already processed in L1 memory, otherwise null.
 */
export function getCachedRoutePolylinesSync(
    routeIds: string[],
    cityCode?: string
): Map<string, PolylineData> | null {
    if (!routeIds || routeIds.length === 0) return null;
    const cCode = resolveCityCode(cityCode);
    const map = new Map<string, PolylineData>();

    for (const id of routeIds) {
        if (!id) continue;
        const cached = processedCache.get(`${cCode}:${id}`);
        if (!cached) return null;
        map.set(id, cached);
    }

    return map.size > 0 ? map : null;
}

async function fetchRoutePolyline(routeId: string, cityCode?: string): Promise<PolylineData> {
    const cCode = resolveCityCode(cityCode);
    const cacheKey = `${cCode}:${routeId}`;

    // Use getOrFetch to coalesce concurrent calls from BusMarker, BusRoutePolyline, and BusStopMarker
    return processedCache.getOrFetch(cacheKey, async () => {
        let rawData = await getPolyline(routeId, cCode);

        // Resilient Fallback: if rawData is missing or has no stops, query /api/bus-stops/[routeId] and construct spline
        if (!rawData || !rawData.stops || rawData.stops.length === 0) {
            try {
                const stopsRes = await fetch(
                    `/api/bus-stops/${encodeURIComponent(routeId)}?cityCode=${cCode}`
                );
                if (stopsRes.ok) {
                    const stopPayload = await stopsRes.json();
                    const stopList = Array.isArray(stopPayload) ? stopPayload : stopPayload?.data;
                    if (Array.isArray(stopList) && stopList.length >= 2) {
                        const sortedStops = [...stopList].sort(
                            (a, b) => Number(a.nodeord || 0) - Number(b.nodeord || 0)
                        );
                        const upStops = sortedStops.filter((s) => Number(s.updowncd) === 1);
                        const downStops = sortedStops.filter((s) => Number(s.updowncd) === 0);

                        let upCoords: [number, number][] = (
                            upStops.length >= 2 ? upStops : sortedStops
                        )
                            .filter((s) => s.gpslong > 0 && s.gpslati > 0)
                            .map((s) => [Number(s.gpslong), Number(s.gpslati)]);
                        let downCoords: [number, number][] = (
                            downStops.length >= 2 ? downStops : upCoords
                        )
                            .filter((s) => s.gpslong > 0 && s.gpslati > 0)
                            .map((s) => [Number(s.gpslong), Number(s.gpslati)]);

                        if (upStops.length >= 2 && downStops.length >= 2 && upCoords.length >= 2 && downCoords.length >= 2) {
                            const turningDir = findTurningDirection(sortedStops);
                            if (turningDir === "down_to_up") {
                                upCoords = [downCoords[downCoords.length - 1], ...upCoords];
                            } else if (turningDir === "up_to_down") {
                                downCoords = [upCoords[upCoords.length - 1], ...downCoords];
                            }
                        }

                        const smoothUp = smoothPolylineSpline(upCoords);
                        const smoothDown =
                            downStops.length >= 2 ? smoothPolylineSpline(downCoords) : smoothUp;

                        rawData = {
                            route_id: routeId,
                            route_no: routeId,
                            stops_count: sortedStops.length,
                            total_dist: 0,
                            up_polyline: smoothUp,
                            down_polyline: smoothDown,
                            stops: sortedStops.map((s) => ({
                                id: String(s.nodeid),
                                name: String(s.nodenm),
                                ord: Number(s.nodeord || 0),
                                ud: Number(s.updowncd ?? 0),
                                lat: Number(s.gpslati),
                                lon: Number(s.gpslong),
                                nodeno: String(s.nodeno || ""),
                            })),
                        };
                    }
                }
            } catch (e) {
                console.warn(`[fetchRoutePolyline] Client bus stops fallback failed for ${routeId}:`, e);
            }
        }

        if (!rawData || !rawData.stops) {
            return {upPolyline: [], downPolyline: [], turnIndex: 0};
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

        const buildPolylineFromStops = (dirStops: typeof rawData.stops): Coordinate[] => {
            const coords: Coordinate[] = [];
            const sorted = [...dirStops].sort((a, b) => a.ord - b.ord);

            for (const s of sorted) {
                const sCoords = s as { id?: string; ord: number; lat?: number; lon?: number };
                if (isFiniteNumber(sCoords.lat) && isFiniteNumber(sCoords.lon)) {
                    coords.push([sCoords.lat!, sCoords.lon!]);
                }
            }
            return coords;
        };

        const stops = rawData.stops || [];
        const upStops = stops.filter(s => Number(s.ud) === 1);
        const downStops = stops.filter(s => Number(s.ud) === 0);

        const upSpan = getPolylineSpanMeters(upPolyline);
        if (upSpan < 1000 && upStops.length >= 2) {
            const upStopsPoly = buildPolylineFromStops(upStops);
            const upStopSpan = getPolylineSpanMeters(upStopsPoly);
            if (upStopSpan > 1500) {
                upPolyline = smoothPolylineSpline(upStopsPoly);
            }
        }

        const downSpan = getPolylineSpanMeters(downPolyline);
        if (downSpan < 1000 && downStops.length >= 2) {
            const downStopsPoly = buildPolylineFromStops(downStops);
            const downStopSpan = getPolylineSpanMeters(downStopsPoly);
            if (downStopSpan > 1500) {
                downPolyline = smoothPolylineSpline(downStopsPoly);
            }
        }

        return {
            upPolyline,
            downPolyline,
            stopIndexMap: buildStopIndexMap(upPolyline, downPolyline, rawData),
            turnIndex: upPolyline.length > 0 ? upPolyline.length - 1 : 0,
            bbox: extractBBox(rawData, [...upCoords, ...downCoords]),
        };
    });
}

export async function fetchRoutePolylines(
    routeIds: string[],
    cityCode?: string
): Promise<Map<string, PolylineData>> {
    const results = await Promise.all(
        routeIds.map(async (id) => ({id, data: await fetchRoutePolyline(id, cityCode)}))
    );
    const map = new Map<string, PolylineData>();
    for (const {id, data} of results) map.set(id, data);
    return map;
}

export function clearProcessedPolylineCache(): void {
    processedCache.clear();
    clearSegmentedGeoJsonCache();
}
