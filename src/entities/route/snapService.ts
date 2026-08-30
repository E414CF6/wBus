import type {BusItem} from "@entities/bus/types";
import type {StopIndexMap} from "@entities/route/polylineService";
import type {Coordinate} from "@entities/route/types";
import {getHaversineDistanceMeters, isFiniteNumber, snapPointToPolyline} from "@shared/utils/geo";

// ----------------------------------------------------------------------
// Constants & Types
// ----------------------------------------------------------------------

const MAX_SNAP_DISTANCE_METERS = 100; // Increased to allow snapping even with GPS drift when constrained to segments
const DEFAULT_SNAP_INDEX_RANGE = 80;

interface SnappedResult {
    position: Coordinate;
    angle: number;
    direction: number;
    segmentIndex?: number | null;
}

interface SnapCandidate extends SnappedResult {
    distance: number;
    isValid: boolean;
}

interface GetSnappedOptions {
    stopIndexMap?: StopIndexMap | null;
    turnIndex?: number;
    snapIndexRange?: number;
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

function clampIndex(value: number, max: number): number {
    return Math.max(0, Math.min(value, max));
}

function getStopCoordIndex(stopIndexMap: StopIndexMap | null | undefined, nodeid: string | null | undefined, nodeord: number, direction: number | null): number | null {
    if (!stopIndexMap) return null;

    const cleanedId = typeof nodeid === "string" ? nodeid.trim() : "";
    const ord = Number(nodeord);

    if (direction !== null && direction !== undefined) {
        if (cleanedId) {
            const idx = stopIndexMap.byIdDir[`${cleanedId}-${direction}`];
            if (isFiniteNumber(idx)) return idx;
        }

        if (Number.isFinite(ord)) {
            const idx = stopIndexMap.byOrdDir[`${ord}-${direction}`];
            if (isFiniteNumber(idx)) return idx;
        }
    }

    if (cleanedId) {
        const idx = stopIndexMap.byId[cleanedId];
        if (isFiniteNumber(idx)) return idx;
    }

    if (Number.isFinite(ord)) {
        const idx = stopIndexMap.byOrd[String(ord)];
        if (isFiniteNumber(idx)) return idx;
    }

    return null;
}

function getSegmentHint(coordIndex: number | null, lineLength: number): number | null {
    if (!isFiniteNumber(coordIndex) || lineLength < 2) return null;
    return clampIndex(coordIndex, lineLength - 2);
}

function getSegmentBounds(stopIndexMap: StopIndexMap | null | undefined, nodeord: number, dir: number | null, lineLength: number): {
    minIdx: number | null, maxIdx: number | null
} {
    if (!stopIndexMap) return {minIdx: null, maxIdx: null};

    // We try to find a bounding window of segments based on adjacent stops.
    // Assuming nodeord points to the current/approaching stop.
    // We look at nodeord - 2 to nodeord + 2 to give a safe buffer for GPS drift and API delays.
    let minIdx: number | null = null;
    let maxIdx: number | null = null;

    for (let i = nodeord - 2; i <= nodeord; i++) {
        const idx = getStopCoordIndex(stopIndexMap, null, i, dir);
        if (idx !== null) {
            minIdx = minIdx === null ? idx : Math.min(minIdx, idx);
        }
    }

    for (let i = nodeord; i <= nodeord + 2; i++) {
        const idx = getStopCoordIndex(stopIndexMap, null, i, dir);
        if (idx !== null) {
            maxIdx = maxIdx === null ? idx : Math.max(maxIdx, idx);
        }
    }

    if (minIdx !== null) minIdx = Math.max(0, minIdx - 5); // 5 segments buffer
    if (maxIdx !== null) maxIdx = Math.min(lineLength - 2, maxIdx + 5);

    return {minIdx, maxIdx};
}

// ----------------------------------------------------------------------
// Main Logic
// ----------------------------------------------------------------------

export function getSnappedPosition(bus: BusItem, getDirection: (nodeid: string | null | undefined, nodeord: number, routeid?: string | null) => number | null, upPolyline: Coordinate[], downPolyline: Coordinate[], options?: GetSnappedOptions): SnappedResult {
    const {gpslati, gpslong, nodeid} = bus;
    const nodeord = Number(bus.nodeord);
    const rawPosition: Coordinate = [gpslati, gpslong];
    const {
        stopIndexMap, turnIndex: _turnIndex, snapIndexRange = DEFAULT_SNAP_INDEX_RANGE,
    } = options ?? {};

    const apiDirection = getDirection(nodeid, nodeord, bus.routeid);

    const defaultResult: SnappedResult = {
        position: rawPosition, angle: 0, direction: apiDirection ?? 0, segmentIndex: null,
    };

    const stopIndexUp = getStopCoordIndex(stopIndexMap, nodeid, nodeord, 1);
    const stopIndexDown = getStopCoordIndex(stopIndexMap, nodeid, nodeord, 0);
    const stopIndexAny = getStopCoordIndex(stopIndexMap, nodeid, nodeord, null);

    const createCandidate = (line: Coordinate[], dir: number): SnapCandidate | null => {
        if (!line || line.length < 2) return null;

        const coordIndex = dir === 1 ? (stopIndexUp ?? stopIndexAny) : (stopIndexDown ?? stopIndexAny);
        const segmentHint = getSegmentHint(coordIndex, line.length);
        const bounds = getSegmentBounds(stopIndexMap, nodeord, dir, line.length);

        // If we have strict bounds from stops, use them to calculate a dynamic search radius
        // ensuring we only search within the segments between the bus stops.
        let searchRadius = snapIndexRange;
        const minSegmentIndex = bounds.minIdx;

        if (bounds.minIdx !== null && bounds.maxIdx !== null && segmentHint !== null) {
            const dynamicRadius = Math.max(Math.abs(segmentHint - bounds.minIdx), Math.abs(bounds.maxIdx - segmentHint));
            searchRadius = Math.max(10, Math.min(dynamicRadius, snapIndexRange));
        }

        const snapped = snapPointToPolyline(rawPosition, line, {
            segmentHint, searchRadius, minSegmentIndex,
        });
        const distance = getHaversineDistanceMeters(rawPosition, snapped.position);

        return {
            position: snapped.position,
            angle: snapped.angle,
            direction: dir,
            segmentIndex: snapped.segmentIndex,
            distance,
            isValid: distance <= MAX_SNAP_DISTANCE_METERS,
        };
    };

    const candidateUp = createCandidate(upPolyline, 1);
    const candidateDown = createCandidate(downPolyline, 0);

    if (apiDirection === 1 && candidateUp?.isValid) return candidateUp;
    if (apiDirection === 0 && candidateDown?.isValid) return candidateDown;

    if (candidateUp?.isValid && candidateDown?.isValid) {
        return candidateUp.distance < candidateDown.distance ? candidateUp : candidateDown;
    }

    if (candidateUp?.isValid) return candidateUp;
    if (candidateDown?.isValid) return candidateDown;

    return defaultResult;
}
