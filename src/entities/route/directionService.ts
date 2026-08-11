import {Direction, type DirectionCode} from "@entities/route/types";
import {MAP_SETTINGS} from "@shared/config/env";

export interface RouteSequenceData {
    routeid: string;
    sequence: { nodeid: string; nodeord: number; updowncd: number }[];
}

export interface DirectionResolverState {
    sequences: RouteSequenceData[];
    routeIdOrder: string[];
}

interface SequenceCandidate {
    routeid: string;
    nodeord: number;
    updowncd: number;
}

type SequenceLookupMap = Map<string, SequenceCandidate[]>;

export interface TurningPointInfo {
    upTurnNodeId?: string;
    upTurnOrd?: number;
    downTurnNodeId?: string;
    downTurnOrd?: number;
}

interface DirectionLookup {
    sequenceMap: SequenceLookupMap;
    routeMixedDirMap: Map<string, boolean>;
    fallbackDirMap: Map<string, DirectionCode>;
    activeRouteIds: Set<string>;
    turningPointMap: Map<string, TurningPointInfo>;
}

const ALWAYS_UPWARD_NODEIDS = new Set(MAP_SETTINGS.ALWAYS_UPWARD_NODE_IDS);

export function buildDirectionLookup(state: DirectionResolverState): DirectionLookup {
    const sequenceMap: SequenceLookupMap = new Map();
    for (const {routeid, sequence} of state.sequences) {
        for (const item of sequence) {
            const list = sequenceMap.get(item.nodeid) ?? [];
            list.push({routeid, nodeord: item.nodeord, updowncd: item.updowncd});
            sequenceMap.set(item.nodeid, list);
        }
    }

    const routeMixedDirMap = new Map<string, boolean>();
    for (const {routeid, sequence} of state.sequences) {
        const directions = new Set(sequence.map((s) => s.updowncd));
        routeMixedDirMap.set(routeid, directions.size > 1);
    }

    const fallbackDirMap = new Map<string, DirectionCode>();
    if (state.routeIdOrder.length === 2) {
        fallbackDirMap.set(state.routeIdOrder[0], Direction.UP);
        fallbackDirMap.set(state.routeIdOrder[1], Direction.DOWN);
    }

    const activeRouteIds = new Set(state.sequences.map((s) => s.routeid));

    // Map turning point stops for each route to enable smooth direction switching at turnarounds
    const turningPointMap = new Map<string, TurningPointInfo>();
    for (const {routeid, sequence} of state.sequences) {
        const upStops = sequence.filter(s => Number(s.updowncd) === 1).sort((a, b) => Number(a.nodeord) - Number(b.nodeord));
        const downStops = sequence.filter(s => Number(s.updowncd) === 0).sort((a, b) => Number(a.nodeord) - Number(b.nodeord));

        const upTurn = upStops.length > 0 ? upStops[upStops.length - 1] : undefined;
        const downTurn = downStops.length > 0 ? downStops[downStops.length - 1] : undefined;

        turningPointMap.set(routeid, {
            upTurnNodeId: upTurn?.nodeid,
            upTurnOrd: Number(upTurn?.nodeord ?? 0),
            downTurnNodeId: downTurn?.nodeid,
            downTurnOrd: Number(downTurn?.nodeord ?? 0),
        });
    }

    return {sequenceMap, routeMixedDirMap, fallbackDirMap, activeRouteIds, turningPointMap};
}

export function resolveDirection(lookup: DirectionLookup, nodeid: string | null | undefined, nodeord: number, routeid?: string | null): DirectionCode {
    if (!nodeid) return null;

    const normalizedNodeId = nodeid.trim();
    if (!normalizedNodeId) return null;

    const targetOrd = Number(nodeord);
    if (!Number.isFinite(targetOrd)) return null;

    if (ALWAYS_UPWARD_NODEIDS.has(normalizedNodeId)) return Direction.UP;

    const candidates = lookup.sequenceMap.get(normalizedNodeId);
    if (!candidates || candidates.length === 0) return null;

    const scopedCandidates = routeid ? candidates.filter((c) => c.routeid === routeid) : candidates.filter((c) => lookup.activeRouteIds.has(c.routeid));

    const pool = scopedCandidates.length > 0 ? scopedCandidates : candidates;

    let bestMatch = pool.find((c) => c.nodeord === targetOrd);
    if (!bestMatch && pool.length > 0) {
        bestMatch = pool[0];
        let bestDiff = Math.abs(bestMatch.nodeord - targetOrd);
        for (let i = 1; i < pool.length; i++) {
            const curr = pool[i];
            const currDiff = Math.abs(curr.nodeord - targetOrd);
            if (currDiff < bestDiff || (currDiff === bestDiff && curr.nodeord < bestMatch.nodeord)) {
                bestMatch = curr;
                bestDiff = currDiff;
            }
        }
    }

    if (!bestMatch) {
        const fallback = routeid ? lookup.fallbackDirMap.get(routeid) : undefined;
        return fallback ?? null;
    }

    const targetRouteId = routeid || bestMatch.routeid;
    if (targetRouteId && lookup.turningPointMap.has(targetRouteId)) {
        const turnInfo = lookup.turningPointMap.get(targetRouteId)!;
        if (turnInfo.upTurnNodeId && (normalizedNodeId === turnInfo.upTurnNodeId || (turnInfo.upTurnOrd && targetOrd === turnInfo.upTurnOrd))) {
            // Bus is passing UP turning stop -> switch direction to DOWN (0)
            return Direction.DOWN;
        }
        if (turnInfo.downTurnNodeId && (normalizedNodeId === turnInfo.downTurnNodeId || (turnInfo.downTurnOrd && targetOrd === turnInfo.downTurnOrd))) {
            // Bus is passing DOWN turning stop -> switch direction to UP (1)
            return Direction.UP;
        }
    }

    return bestMatch.updowncd === 0 ? Direction.DOWN : Direction.UP;
}

