import { CacheManager } from "@core/cache/CacheManager";
import { getPolyline, getRouteDetails } from "@entities/route/api";
import type { Coordinate, GeoPolyline, RouteDetail } from "@entities/route/types";
import { getStationMap } from "@entities/station/api";
import type { StationLocation } from "@entities/station/types";
import { isFiniteNumber } from "@shared/utils/geo";

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
    isSwapped?: boolean;
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

function toLatLngCoords(coords: Array<[number, number]>): Coordinate[] {
    return coords.map(([lng, lat]) => [lat, lng]);
}

function buildStopIndexMap(data: GeoPolyline): StopIndexMap | undefined {
    const feature = data.features?.[0];
    const stops = feature?.properties?.stops ?? [];
    const stopToCoord = feature?.properties?.stop_to_coord ?? [];
    if (stops.length === 0 || stopToCoord.length === 0) return undefined;

    const map: StopIndexMap = {byId: {}, byIdDir: {}, byOrd: {}, byOrdDir: {}};
    stops.forEach((stop, idx) => {
        const coordIndex = stopToCoord[idx];
        if (!isFiniteNumber(coordIndex)) return;
        const rawId = typeof stop.id === "string" ? stop.id.trim() : "";
        const ord = Number(stop.ord);
        const dir = Number(stop.ud);
        if (rawId) {
            map.byId[rawId] = coordIndex;
            if (Number.isFinite(dir)) map.byIdDir[`${rawId}-${dir}`] = coordIndex;
        }
        if (Number.isFinite(ord)) {
            map.byOrd[String(ord)] = coordIndex;
            if (Number.isFinite(dir)) map.byOrdDir[`${ord}-${dir}`] = coordIndex;
        }
    });
    return map;
}

function splitByTurnIndex(coords: Coordinate[], turnIndex: number): { up: Coordinate[]; down: Coordinate[] } {
    if (coords.length < 2) return {up: [], down: []};
    const idx = Math.max(0, Math.min(Math.round(turnIndex), coords.length - 1));
    return {up: coords.slice(0, idx + 1), down: coords.slice(idx)};
}

function transformPolyline(data: GeoPolyline): { up: Coordinate[]; down: Coordinate[] } {
    if (!data.features || data.features.length === 0) return {up: [], down: []};
    const feature = data.features[0];
    const coords = toLatLngCoords(feature.geometry.coordinates);
    if (feature.properties.turn_idx !== undefined) {
        return splitByTurnIndex(coords, feature.properties.turn_idx);
    }
    return {up: coords, down: []};
}

function shouldSwapPolylines(
    routeDetail: RouteDetail | null, stationMap: Record<string, StationLocation> | null,
    upPolyline: Coordinate[], downPolyline: Coordinate[]
): boolean {
    if (!routeDetail || !stationMap) return false;
    if (upPolyline.length < 2 || downPolyline.length < 2) return false;
    const upStops: Coordinate[] = [];
    const downStops: Coordinate[] = [];
    for (const stop of routeDetail.sequence) {
        const station = stationMap[stop.nodeid];
        if (!station) continue;
        const coord: Coordinate = [station.gpslati, station.gpslong];
        if (stop.updowncd === 1) upStops.push(coord);
        else downStops.push(coord);
    }
    if (upStops.length < 3 || downStops.length < 3) return false;
    const sample = (arr: Coordinate[], max: number) => {
        if (arr.length <= max) return arr;
        const step = Math.ceil(arr.length / max);
        return arr.filter((_, i) => i % step === 0).slice(0, max);
    };
    const sampledUp = sample(upStops, 20);
    const sampledDown = sample(downStops, 20);
    const calcMSE = (points: Coordinate[], line: Coordinate[]) => {
        let total = 0;
        for (const p of points) {
            let minDist = Infinity;
            for (let i = 0; i < line.length - 1; i++) {
                const A = line[i], B = line[i + 1];
                const AB = [B[0] - A[0], B[1] - A[1]];
                const AP = [p[0] - A[0], p[1] - A[1]];
                const ab2 = AB[0] * AB[0] + AB[1] * AB[1];
                const t = ab2 > 0 ? Math.max(0, Math.min(1, (AP[0] * AB[0] + AP[1] * AB[1]) / ab2)) : 0;
                const proj = [A[0] + AB[0] * t, A[1] + AB[1] * t];
                const d = (p[0] - proj[0]) ** 2 + (p[1] - proj[1]) ** 2;
                if (d < minDist) minDist = d;
            }
            total += minDist;
        }
        return total / points.length;
    };
    const upToUp = calcMSE(sampledUp, upPolyline);
    const upToDown = calcMSE(sampledUp, downPolyline);
    const downToUp = calcMSE(sampledDown, upPolyline);
    const downToDown = calcMSE(sampledDown, downPolyline);
    const SWAP_RATIO = 0.81;
    return upToDown < upToUp * SWAP_RATIO && downToUp < downToDown * SWAP_RATIO;
}

function extractBBox(data: GeoPolyline): [[number, number], [number, number]] | undefined {
    const feature = data.features?.[0];
    if (!feature) return undefined;
    const bbox = feature.bbox;
    if (bbox && bbox.length === 4) {
        return [[bbox[1], bbox[0]], [bbox[3], bbox[2]]];
    }
    const coords = feature.geometry?.coordinates ?? [];
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

export async function fetchRoutePolyline(routeId: string): Promise<PolylineData> {
    const cached = processedCache.get(routeId);
    if (cached) return cached;
    const [rawData, routeDetail, stationMap] = await Promise.all([
        getPolyline(routeId), getRouteDetails(routeId), getStationMap(),
    ]);
    if (!rawData) {
        const empty: PolylineData = {upPolyline: [], downPolyline: []};
        processedCache.set(routeId, empty);
        return empty;
    }
    const {up, down} = transformPolyline(rawData);
    const shouldSwap = shouldSwapPolylines(routeDetail, stationMap, up, down);
    const result: PolylineData = {
        upPolyline: shouldSwap ? down : up,
        downPolyline: shouldSwap ? up : down,
        stopIndexMap: buildStopIndexMap(rawData),
        turnIndex: rawData.features[0]?.properties?.turn_idx,
        isSwapped: shouldSwap,
        bbox: extractBBox(rawData),
    };
    processedCache.set(routeId, result);
    return result;
}

export async function fetchRoutePolylines(routeIds: string[]): Promise<Map<string, PolylineData>> {
    const results = await Promise.all(
        routeIds.map(async (id) => ({id, data: await fetchRoutePolyline(id)}))
    );
    const map = new Map<string, PolylineData>();
    for (const {id, data} of results) map.set(id, data);
    return map;
}

export function createMultiPolylineData(
    polylineMap: Map<string, PolylineData>, activeRouteIds?: string[]
): MultiPolylineData {
    const segmentMap = new Map<string, PolylineSegment>();
    const activeSet = new Set(activeRouteIds ?? []);
    const generateKey = (coords: Coordinate[]) =>
        coords.map(([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`).join("|");
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
                bounds = [
                    [Math.min(bounds[0][0], data.bbox[0][0]), Math.min(bounds[0][1], data.bbox[0][1])],
                    [Math.max(bounds[1][0], data.bbox[1][0]), Math.max(bounds[1][1], data.bbox[1][1])],
                ];
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

export function clearPolylineCache(): void {
    processedCache.clear();
}
