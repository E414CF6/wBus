import type {BusStop} from "@entities/station/types";

export type LabelPlacement = "right" | "left" | "top" | "bottom";

export interface ScreenPoint {
    x: number;
    y: number;
}

export interface StopPlacementInfo {
    placement: LabelPlacement;
    showLabel: boolean;
    disambiguationLabel?: string | null;
    pairedOppositeStop?: BusStop | null;
}

export interface Rect {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

// Standard label dimensions in pixels for collision checking
const LABEL_WIDTH = 92;
const LABEL_HEIGHT = 22;
const PIN_RADIUS = 12;

/**
 * Calculates geographic distance in meters between two lat/long coordinates.
 */
export function calculateDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const cosLat = Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
    const dy = (lat2 - lat1) * 111000;
    const dx = (lon2 - lon1) * 111000 * cosLat;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Normalizes a bus stop name by removing parenthesis content and terminal suffixes.
 */
export function normalizeStopName(name: string): string {
    return name
        .replace(/\s*\([^)]*\)/g, "")
        .replace(/\s*(기점|종점|차고지|승강장|회차지)$/g, "")
        .trim();
}

/**
 * Finds a paired opposite stop (e.g. across the street) based on distance,
 * matching name, or opposing direction (updowncd).
 */
export function findPairedOppositeStop(
    currentStop: BusStop,
    allStops: BusStop[],
    maxDistanceMeters = 85
): BusStop | null {
    const currentNorm = normalizeStopName(currentStop.nodenm);
    let bestMatch: BusStop | null = null;
    let minDistance = maxDistanceMeters;

    for (const other of allStops) {
        if (other.nodeid === currentStop.nodeid) continue;

        const dist = calculateDistanceMeters(
            currentStop.gpslati,
            currentStop.gpslong,
            other.gpslati,
            other.gpslong
        );
        if (dist > minDistance) continue;

        const otherNorm = normalizeStopName(other.nodenm);
        const isNameMatch = currentNorm.length >= 2 && currentNorm === otherNorm;
        const isOppositeDirection =
            currentStop.updowncd !== undefined &&
            other.updowncd !== undefined &&
            currentStop.updowncd !== other.updowncd;

        if (isNameMatch || isOppositeDirection) {
            minDistance = dist;
            bestMatch = other;
        }
    }

    return bestMatch;
}

/**
 * Converts a bus stop coordinate to screen pixel coordinates.
 * Falls back to an equirectangular flat-projection when map is unavailable.
 */
export function calculateScreenPoint(
    stop: { gpslong: number; gpslati: number },
    map: { project?: (lnglat: [number, number]) => { x: number; y: number } } | null,
    centerCoords?: { lat: number; lng: number } | null
): ScreenPoint {
    if (map && typeof map.project === "function") {
        try {
            const pt = map.project([stop.gpslong, stop.gpslati]);
            if (pt && typeof pt.x === "number" && typeof pt.y === "number") {
                return {x: pt.x, y: pt.y};
            }
        } catch {
            // fallback below
        }
    }

    const centerLat = centerCoords?.lat ?? stop.gpslati;
    const centerLng = centerCoords?.lng ?? stop.gpslong;
    const cosLat = Math.cos((centerLat * Math.PI) / 180);
    // Approximate 1 meter ≈ 1 pixel at standard street level zoom
    const x = (stop.gpslong - centerLng) * 111000 * cosLat;
    const y = -(stop.gpslati - centerLat) * 111000;
    return {x, y};
}

/**
 * Computes bounding rectangle of a label given pin coordinate and placement.
 */
export function getLabelRect(pt: ScreenPoint, placement: LabelPlacement): Rect {
    switch (placement) {
        case "left":
            return {
                left: pt.x - PIN_RADIUS - 6 - LABEL_WIDTH,
                right: pt.x - PIN_RADIUS - 6,
                top: pt.y - LABEL_HEIGHT / 2,
                bottom: pt.y + LABEL_HEIGHT / 2,
            };
        case "top":
            return {
                left: pt.x - LABEL_WIDTH / 2,
                right: pt.x + LABEL_WIDTH / 2,
                top: pt.y - PIN_RADIUS - 6 - LABEL_HEIGHT,
                bottom: pt.y - PIN_RADIUS - 6,
            };
        case "bottom":
            return {
                left: pt.x - LABEL_WIDTH / 2,
                right: pt.x + LABEL_WIDTH / 2,
                top: pt.y + PIN_RADIUS + 6,
                bottom: pt.y + PIN_RADIUS + 6 + LABEL_HEIGHT,
            };
        case "right":
        default:
            return {
                left: pt.x + PIN_RADIUS + 6,
                right: pt.x + PIN_RADIUS + 6 + LABEL_WIDTH,
                top: pt.y - LABEL_HEIGHT / 2,
                bottom: pt.y + LABEL_HEIGHT / 2,
            };
    }
}

/**
 * Checks if two bounding rectangles overlap.
 */
export function doRectanglesOverlap(r1: Rect, r2: Rect): boolean {
    return !(
        r1.right < r2.left ||
        r1.left > r2.right ||
        r1.bottom < r2.top ||
        r1.top > r2.bottom
    );
}

const CANDIDATE_DIRECTIONS: readonly LabelPlacement[] = ["right", "left", "top", "bottom"] as const;

const DIRECTION_VECTORS: Record<LabelPlacement, { x: number; y: number }> = {
    right: {x: 1, y: 0},
    left: {x: -1, y: 0},
    top: {x: 0, y: -1},
    bottom: {x: 0, y: 1},
};

const BASELINE_PREFERENCE: Record<LabelPlacement, number> = {
    right: 0,
    left: 2,
    top: 6,
    bottom: 8,
};

/**
 * Scores a candidate placement direction for a pin relative to nearby neighbor stops.
 * Lower score = better placement.
 */
export function scoreDirectionPlacement(
    pt_i: ScreenPoint,
    dir: LabelPlacement,
    neighbors: Array<{ pt: ScreenPoint; dist: number }>
): number {
    let penalty = BASELINE_PREFERENCE[dir];
    const dirVec = DIRECTION_VECTORS[dir];

    for (const {pt: pt_j, dist} of neighbors) {
        if (dist <= 0) continue;
        const dx = pt_j.x - pt_i.x;
        const dy = pt_j.y - pt_i.y;
        const unx = dx / dist;
        const uny = dy / dist;

        // 1. Direct Pin Occlusion Check: Does candidate label box cover neighbor pin?
        if (dir === "right" && dx > 0 && dx < PIN_RADIUS + LABEL_WIDTH + 8 && Math.abs(dy) < 22) {
            penalty += 500 * (1 - dx / (PIN_RADIUS + LABEL_WIDTH + 8));
        } else if (dir === "left" && dx < 0 && dx > -(PIN_RADIUS + LABEL_WIDTH + 8) && Math.abs(dy) < 22) {
            penalty += 500 * (1 - Math.abs(dx) / (PIN_RADIUS + LABEL_WIDTH + 8));
        } else if (dir === "top" && dy < 0 && dy > -(PIN_RADIUS + LABEL_HEIGHT + 8) && Math.abs(dx) < 55) {
            penalty += 500 * (1 - Math.abs(dy) / (PIN_RADIUS + LABEL_HEIGHT + 8));
        } else if (dir === "bottom" && dy > 0 && dy < PIN_RADIUS + LABEL_HEIGHT + 8 && Math.abs(dx) < 55) {
            penalty += 500 * (1 - dy / (PIN_RADIUS + LABEL_HEIGHT + 8));
        }

        // 2. Angular Direction Penalty: Does direction vector point towards or away from neighbor?
        const dot = dirVec.x * unx + dirVec.y * uny;
        const weight = Math.max(0, (140 - dist) / 140);

        if (dot > 0) {
            // Points toward neighbor
            penalty += dot * weight * 90;
        } else if (dot < -0.2) {
            // Points away from neighbor (bonus)
            penalty -= Math.abs(dot) * weight * 30;
        }
    }

    return penalty;
}

export type VisibleStopItem = BusStop & {
    isRouteStop?: boolean;
    isFavorite?: boolean;
    showLabel?: boolean;
    color?: string;
};

/**
 * Computes optimal label placements for all visible stops in the viewport.
 * Resolves opposite-stop overlap, prevents pin occlusion, and eliminates label collisions.
 */
export function computeOptimalLabelPlacements(
    stops: VisibleStopItem[],
    map: { project?: (lnglat: [number, number]) => { x: number; y: number } } | null,
    centerCoords?: { lat: number; lng: number } | null,
    activeFocusedStopId?: string | null
): Map<string, StopPlacementInfo> {
    const results = new Map<string, StopPlacementInfo>();
    if (!stops.length) return results;

    // 1. Precalculate screen positions for each stop
    const screenPoints = new Map<string, ScreenPoint>();
    for (const s of stops) {
        screenPoints.set(s.nodeid, calculateScreenPoint(s, map, centerCoords));
    }

    // 2. Identify duplicate/same-name stops in view for disambiguation
    const nameCounts = new Map<string, number>();
    for (const s of stops) {
        const norm = normalizeStopName(s.nodenm);
        nameCounts.set(norm, (nameCounts.get(norm) ?? 0) + 1);
    }

    // 3. Find paired opposite stop and candidate direction order for each stop
    type StopCandidate = {
        stop: VisibleStopItem;
        pt: ScreenPoint;
        pairedStop: BusStop | null;
        disambiguationLabel: string | null;
        rankedDirections: LabelPlacement[];
    };

    const stopCandidates: StopCandidate[] = [];

    for (const stop of stops) {
        const pt = screenPoints.get(stop.nodeid) || {x: 0, y: 0};
        const norm = normalizeStopName(stop.nodenm);
        const hasDuplicateName = (nameCounts.get(norm) ?? 0) > 1;

        const pairedStop = findPairedOppositeStop(stop, stops);

        let disambiguationLabel: string | null = null;
        if (hasDuplicateName) {
            if (stop.nodeno && String(stop.nodeno).trim() !== "") {
                disambiguationLabel = String(stop.nodeno);
            } else if (stop.updowncd === 0) {
                disambiguationLabel = "상행";
            } else if (stop.updowncd === 1) {
                disambiguationLabel = "하행";
            }
        }

        // Collect neighbors within 140px
        const neighbors: Array<{ pt: ScreenPoint; dist: number }> = [];
        for (const other of stops) {
            if (other.nodeid === stop.nodeid) continue;
            const otherPt = screenPoints.get(other.nodeid);
            if (!otherPt) continue;
            const dist = Math.hypot(otherPt.x - pt.x, otherPt.y - pt.y);
            if (dist < 140) {
                neighbors.push({pt: otherPt, dist});
            }
        }

        // Rank directions by lowest penalty
        const scoredDirections = CANDIDATE_DIRECTIONS.map((dir) => ({
            dir,
            score: scoreDirectionPlacement(pt, dir, neighbors),
        }));

        scoredDirections.sort((a, b) => a.score - b.score);
        const rankedDirections = scoredDirections.map((s) => s.dir);

        stopCandidates.push({
            stop,
            pt,
            pairedStop,
            disambiguationLabel,
            rankedDirections,
        });
    }

    // 4. Sort stops by priority so important stops get primary label placement without collision
    // Priority: Focused Stop > Favorite Stop > Route Stop > Nearby Stop
    stopCandidates.sort((a, b) => {
        const isAFocused = a.stop.nodeid === activeFocusedStopId ? 1 : 0;
        const isBFocused = b.stop.nodeid === activeFocusedStopId ? 1 : 0;
        if (isAFocused !== isBFocused) return isBFocused - isAFocused;

        const isAFav = a.stop.isFavorite ? 1 : 0;
        const isBFav = b.stop.isFavorite ? 1 : 0;
        if (isAFav !== isBFav) return isBFav - isAFav;

        const isARoute = a.stop.isRouteStop ? 1 : 0;
        const isBRoute = b.stop.isRouteStop ? 1 : 0;
        return isBRoute - isARoute;
    });

    // 5. Greedily place labels checking for overlaps against already placed labels
    const placedLabelRects: Rect[] = [];

    for (const candidate of stopCandidates) {
        const {stop, pt, pairedStop, disambiguationLabel, rankedDirections} = candidate;
        const initialShow = stop.showLabel ?? true;

        let chosenPlacement: LabelPlacement = rankedDirections[0] ?? "right";
        let finalShowLabel = initialShow;

        if (initialShow) {
            let foundCollisionFreeDirection = false;

            for (const candidateDir of rankedDirections) {
                const candidateRect = getLabelRect(pt, candidateDir);
                const hasCollision = placedLabelRects.some((existingRect) =>
                    doRectanglesOverlap(candidateRect, existingRect)
                );

                if (!hasCollision) {
                    chosenPlacement = candidateDir;
                    placedLabelRects.push(candidateRect);
                    foundCollisionFreeDirection = true;
                    break;
                }
            }

            // If all 4 directions collide, favorite and focused stops keep best direction, others hide label
            if (!foundCollisionFreeDirection) {
                const mustShow = stop.isFavorite || stop.nodeid === activeFocusedStopId;
                if (mustShow) {
                    chosenPlacement = rankedDirections[0];
                    placedLabelRects.push(getLabelRect(pt, chosenPlacement));
                } else {
                    finalShowLabel = false;
                }
            }
        }

        results.set(stop.nodeid, {
            placement: chosenPlacement,
            showLabel: finalShowLabel,
            disambiguationLabel,
            pairedOppositeStop: pairedStop,
        });
    }

    return results;
}
