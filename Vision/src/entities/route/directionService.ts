import { APP_CONFIG, MAP_SETTINGS } from "@core/constants/env";
import { getRouteDetails } from "@entities/route/api";
import { Direction, type DirectionCode } from "@entities/route/types";

export { Direction, type DirectionCode } from "@entities/route/types";

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

export interface DirectionLookup {
    sequenceMap: SequenceLookupMap;
    routeMixedDirMap: Map<string, boolean>;
    fallbackDirMap: Map<string, DirectionCode>;
    activeRouteIds: Set<string>;
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

    return {sequenceMap, routeMixedDirMap, fallbackDirMap, activeRouteIds};
}

export function resolveDirection(
    lookup: DirectionLookup,
    nodeid: string | null | undefined,
    nodeord: number,
    routeid?: string | null
): DirectionCode {
    if (!nodeid || typeof nodeid !== "string") return null;
    const normalizedNodeId = nodeid.trim();
    if (!normalizedNodeId) return null;

    const targetOrd = Number(nodeord);
    if (!Number.isFinite(targetOrd)) return null;

    if (ALWAYS_UPWARD_NODEIDS.has(normalizedNodeId)) return Direction.UP;

    const candidates = lookup.sequenceMap.get(normalizedNodeId);
    if (!candidates || candidates.length === 0) return null;

    const scopedCandidates = routeid
        ? candidates.filter((c) => c.routeid === routeid)
        : candidates.filter((c) => lookup.activeRouteIds.has(c.routeid));

    const pool = scopedCandidates.length > 0 ? scopedCandidates : candidates;

    const exactMatch = pool.find((c) => c.nodeord === targetOrd);

    const bestMatch = exactMatch || pool.reduce((best, curr) => {
        const bestDiff = Math.abs(best.nodeord - targetOrd);
        const currDiff = Math.abs(curr.nodeord - targetOrd);
        if (currDiff < bestDiff) return curr;
        if (currDiff === bestDiff && curr.nodeord < best.nodeord) return curr;
        return best;
    }, pool[0]);

    if (!bestMatch) return null;

    const isMixed = lookup.routeMixedDirMap.get(bestMatch.routeid) ?? false;
    const fallback = lookup.fallbackDirMap.get(bestMatch.routeid);

    if (!isMixed && fallback !== undefined) return fallback;

    return bestMatch.updowncd === 0 ? Direction.DOWN : Direction.UP;
}

export async function getDirectionFromRouteDetails(
    routeid: string, nodeord: number
): Promise<DirectionCode> {
    try {
        const detail = await getRouteDetails(routeid);
        if (!detail?.sequence) return null;
        const match = detail.sequence.find((s) => s.nodeord === nodeord);
        if (match) return match.updowncd === 0 ? Direction.DOWN : Direction.UP;
        return null;
    } catch (err) {
        if (APP_CONFIG.IS_DEV) console.error("[getDirectionFromRouteDetails] Failed:", err);
        return null;
    }
}
