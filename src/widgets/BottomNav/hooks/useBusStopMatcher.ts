import {useMemo} from "react";
import type {BusItem} from "@entities/bus/types";
import type {DirectionCode, RouteVariation, RouteVariationStop} from "@entities/route/types";
import {getHaversineDistance} from "@shared/utils/geo";

export type GetDirectionFn = (
    nodeId: string | null | undefined,
    nodeOrd: number,
    routeId?: string | null
) => DirectionCode;

/**
 * Pure function to match a single running bus to candidate stops along the route.
 * Fallback priority:
 * 1. Exact nodeid AND nodeord match
 * 2. Match by nodeid (disambiguated by direction or ordinal proximity)
 * 3. Match by nodeord
 * 4. Match by stop name (nodenm)
 * 5. Spatial proximity (< 500m)
 */
export function matchSingleBusToStop(
    bus: BusItem,
    stops: RouteVariationStop[],
    getDirection?: GetDirectionFn
): RouteVariationStop | null {
    if (!stops.length) return null;

    // 1. Exact match: both nodeid and nodeord match
    const exactMatch = stops.find(
        (s) =>
            bus.nodeid &&
            s.nodeid === bus.nodeid &&
            bus.nodeord !== undefined &&
            s.nodeord === bus.nodeord
    );
    if (exactMatch) return exactMatch;

    // 2. Match by nodeid
    if (bus.nodeid) {
        const candidates = stops.filter((s) => s.nodeid === bus.nodeid);
        if (candidates.length === 1) {
            return candidates[0];
        }
        if (candidates.length > 1) {
            const dir = getDirection ? getDirection(bus.nodeid, bus.nodeord ?? 0, bus.routeid) : null;
            if (dir !== null && dir !== undefined) {
                const targetUd = dir === 1 ? 1 : 0;
                return candidates.find((c) => c.updowncd === targetUd) || candidates[0];
            }
            if (bus.nodeord !== undefined) {
                return candidates.reduce((prev, curr) =>
                    Math.abs(curr.nodeord - (bus.nodeord ?? 0)) <
                    Math.abs(prev.nodeord - (bus.nodeord ?? 0))
                        ? curr
                        : prev
                );
            }
            return candidates[0];
        }
    }

    // 3. Match by nodeord
    if (bus.nodeord !== undefined) {
        const ordMatch = stops.find((s) => s.nodeord === bus.nodeord);
        if (ordMatch) return ordMatch;
    }

    // 4. Match by stop name
    if (bus.nodenm) {
        const nameCandidates = stops.filter((s) => s.nodenm === bus.nodenm);
        if (nameCandidates.length > 0) {
            return nameCandidates[0];
        }
    }

    // 5. Fallback: Proximity search within 500m (0.5 km)
    if (bus.gpslati && bus.gpslong) {
        let minDistance = 0.5;
        let closest: RouteVariationStop | null = null;
        for (const s of stops) {
            const d = getHaversineDistance(bus.gpslati, bus.gpslong, s.gpslati, s.gpslong);
            if (d < minDistance) {
                minDistance = d;
                closest = s;
            }
        }
        if (closest) return closest;
    }

    return null;
}

export function makeStopKey(stop: RouteVariationStop): string {
    return `${stop.nodeid}-${stop.nodeord ?? ""}`;
}

export interface MatchedBusStopEntry {
    stopKey: string;
    stop: RouteVariationStop;
    plateDigits: string;
    bus: BusItem;
}

/**
 * Find the matched live bus entry closest to a given map center coordinate.
 * Uses the live bus GPS coordinates first, falling back to its matched stop coordinates.
 */
export function findNearestBusEntity(
    center: { lat: number; lng: number },
    candidates: MatchedBusStopEntry[]
): MatchedBusStopEntry | null {
    let nearest: MatchedBusStopEntry | null = null;
    let nearestDistance = Infinity;

    for (const entry of candidates) {
        const lat = entry.bus.gpslati || entry.stop.gpslati;
        const lng = entry.bus.gpslong || entry.stop.gpslong;
        if (!lat || !lng) continue;

        const distance = getHaversineDistance(center.lat, center.lng, lat, lng);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = entry;
        }
    }

    return nearest;
}

export interface UseBusStopMatcherParams {
    runningBuses: BusItem[];
    currentStops: RouteVariationStop[];
    effectiveVariations: RouteVariation[];
    currentVariant: RouteVariation | null;
    getDirection?: GetDirectionFn;
}

/**
 * Hook to match live buses to the stops of the active route variation.
 */
export function useBusStopMatcher({
                                      runningBuses,
                                      currentStops,
                                      effectiveVariations,
                                      currentVariant,
                                      getDirection,
                                  }: UseBusStopMatcherParams) {
    const busesByStopKey = useMemo(() => {
        const map = new Map<string, BusItem[]>();
        if (!runningBuses.length || !currentStops.length) {
            return map;
        }

        for (const bus of runningBuses) {
            // When multiple variations exist, ignore buses that explicitly belong to a different variation
            if (
                effectiveVariations.length > 1 &&
                bus.routeid &&
                currentVariant &&
                bus.routeid !== currentVariant.routeId
            ) {
                continue;
            }

            const matched = matchSingleBusToStop(bus, currentStops, getDirection);
            if (matched) {
                const key = makeStopKey(matched);
                const existing = map.get(key) || [];
                existing.push(bus);
                map.set(key, existing);
            }
        }

        return map;
    }, [runningBuses, currentStops, effectiveVariations.length, currentVariant, getDirection]);

    return {
        busesByStopKey,
    };
}
