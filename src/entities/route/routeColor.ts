import type {Coordinate} from "@entities/route/types";
import {BRANCH_PALETTE, isPointNearPolyline, type PolylineData} from "@entities/route/polylineService";

export type GenericRouteType = "EXPRESS" | "MAIN" | "BRANCH" | "VILLAGE";

export interface RouteColorConfig {
    main: string;
    downMain: string;
    bg: string;
    text: string;
    border: string;
    badgeBg: string;
    ring?: string;
    shadow?: string;
}

export const ROUTE_TYPE_COLORS: Record<GenericRouteType, RouteColorConfig> = {
    EXPRESS: {
        main: "#dc2626",      // Red (급행 / 광역)
        downMain: "#b91c1c",
        bg: "bg-red-600",
        text: "text-red-600 dark:text-red-400",
        border: "border-red-500/30",
        badgeBg: "bg-red-500/10 dark:bg-red-400/15",
        ring: "ring-red-500/40 dark:ring-red-400/40",
        shadow: "shadow-red-600/30",
    },
    MAIN: {
        main: "#2563eb",      // Blue (간선 / 일반)
        downMain: "#1d4ed8",
        bg: "bg-blue-600",
        text: "text-blue-600 dark:text-blue-400",
        border: "border-blue-500/30",
        badgeBg: "bg-blue-500/10 dark:bg-blue-400/15",
        ring: "ring-blue-500/40 dark:ring-blue-400/40",
        shadow: "shadow-blue-600/30",
    },
    BRANCH: {
        main: "#16a34a",      // Green (지선 / 순환)
        downMain: "#15803d",
        bg: "bg-emerald-600",
        text: "text-emerald-600 dark:text-emerald-400",
        border: "border-emerald-500/30",
        badgeBg: "bg-emerald-500/10 dark:bg-emerald-400/15",
        ring: "ring-emerald-500/40 dark:ring-emerald-400/40",
        shadow: "shadow-emerald-600/30",
    },
    VILLAGE: {
        main: "#65a30d",      // Lime (마을버스)
        downMain: "#4d7c0f",
        bg: "bg-lime-600",
        text: "text-lime-700 dark:text-lime-400",
        border: "border-lime-500/30",
        badgeBg: "bg-lime-500/10 dark:bg-lime-400/15",
        ring: "ring-lime-500/40 dark:ring-lime-400/40",
        shadow: "shadow-lime-600/30",
    },
};

/**
 * Classifies a route into EXPRESS (red), MAIN (blue), BRANCH (green), or VILLAGE (lime)
 * strictly driven by official transit dataset route type (routetp / routeType).
 * No heuristic number guessing.
 */
export function classifyRouteType(routeName?: string, routeTp?: string): GenericRouteType {
    const tp = (routeTp || "").trim().toLowerCase();

    // Data-driven classification based on official route type from TAGO / Seoul TOPIS
    if (tp) {
        // 1. Village / Town buses (마을버스)
        if (/마을|village|town/i.test(tp)) {
            return "VILLAGE";
        }
        // 2. Express / Wide-Area / Airport / Night buses (급행/광역/직행좌석/좌석/심야/공항)
        if (/급행|광역|직행좌석|좌석|공항|시외|심야|express/i.test(tp)) {
            return "EXPRESS";
        }
        // 3. Feeder / Branch / Circular / Rural / Public / Tailored buses (지선/순환/공영/농어촌/맞춤형/따복)
        if (/지선|순환|공영|맞춤|따복|농어촌|feeder|branch|circuit/i.test(tp)) {
            return "BRANCH";
        }
        // 4. Trunk / Main / General city buses (간선/일반/시내)
        if (/간선|일반|시내|trunk|main/i.test(tp)) {
            return "MAIN";
        }
    }

    // Default standard city transit type when unspecified
    return "MAIN";
}

/**
 * Returns a smart bus marker color:
 * - On distinct/diverging branch sections: Branch color matching polyline (#059669, #d97706, etc.).
 * - On shared/standard route sections:
 *   - Express: Red (#dc2626 Up, #b91c1c Down)
 *   - Main: Blue (#2563eb Up, #1d4ed8 Down)
 *   - Branch: Green (#16a34a Up, #15803d Down)
 */
export function getBusMarkerColor(
    routeName: string,
    direction?: number | null,
    routeId?: string | null,
    routeIds?: string[],
    busPos?: Coordinate,
    polylineMap?: Map<string, PolylineData>,
    routeType?: string
): string {
    // 1. Check if the bus is on a distinct branch of a multi-route variant
    if (routeIds && routeIds.length > 1 && routeId && busPos && polylineMap) {
        const rIdx = routeIds.indexOf(routeId);
        if (rIdx !== -1) {
            // Find all other route polylines in the same direction
            const dirKey = direction === 0 ? "downPolyline" : "upPolyline";
            const otherPolylines = routeIds
                .filter((_, idx) => idx !== rIdx)
                .map((id) => polylineMap.get(id)?.[dirKey])
                .filter((p): p is Coordinate[] => Boolean(p && p.length >= 2));

            // Check if bus position is near any other route variant
            let isShared = false;
            for (const otherPoly of otherPolylines) {
                if (isPointNearPolyline(busPos, otherPoly, 30)) {
                    isShared = true;
                    break;
                }
            }

            // If bus is on its unique branch section, return the exact branch palette color matching polyline!
            if (!isShared) {
                const branchIdx = rIdx > 0 ? rIdx - 1 : 0;
                return BRANCH_PALETTE[branchIdx % BRANCH_PALETTE.length];
            }
        }
    }

    // 2. On shared section or standard route: Distinguish by classified route type & direction
    const genericType = classifyRouteType(routeName, routeType);
    const theme = ROUTE_TYPE_COLORS[genericType];

    if (direction === 0) {
        // Down / Inbound / 기점행
        return theme.downMain;
    }

    // Up / Outbound / 종점행 (or unknown)
    return theme.main;
}
