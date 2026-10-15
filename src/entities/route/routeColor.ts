import type {Coordinate} from "@entities/route/types";
import {BRANCH_PALETTE, isPointNearPolyline, type PolylineData} from "@entities/route/polylineService";

export type GenericRouteType = "EXPRESS" | "MAIN" | "BRANCH";

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
        main: "#dc2626",      // Red (급행)
        downMain: "#b91c1c",
        bg: "bg-red-600",
        text: "text-red-600 dark:text-red-400",
        border: "border-red-500/30",
        badgeBg: "bg-red-500/10 dark:bg-red-400/15",
        ring: "ring-red-500/40 dark:ring-red-400/40",
        shadow: "shadow-red-600/30",
    },
    MAIN: {
        main: "#2563eb",      // Blue (간선)
        downMain: "#1d4ed8",
        bg: "bg-blue-600",
        text: "text-blue-600 dark:text-blue-400",
        border: "border-blue-500/30",
        badgeBg: "bg-blue-500/10 dark:bg-blue-400/15",
        ring: "ring-blue-500/40 dark:ring-blue-400/40",
        shadow: "shadow-blue-600/30",
    },
    BRANCH: {
        main: "#16a34a",      // Green (지선)
        downMain: "#15803d",
        bg: "bg-emerald-600",
        text: "text-emerald-600 dark:text-emerald-400",
        border: "border-emerald-500/30",
        badgeBg: "bg-emerald-500/10 dark:bg-emerald-400/15",
        ring: "ring-emerald-500/40 dark:ring-emerald-400/40",
        shadow: "shadow-emerald-600/30",
    },
};

/**
 * Classifies a route into EXPRESS (red), MAIN (blue), or BRANCH (green)
 */
export function classifyRouteType(routeName: string, routeTp?: string): GenericRouteType {
    const tp = (routeTp || "").trim().toLowerCase();
    const no = (routeName || "").trim();

    // 1. Explicit routetp from TAGO / API
    if (tp) {
        if (/급행|광역|직행좌석|좌석|공항|시외|express/i.test(tp)) {
            return "EXPRESS";
        }
        if (/지선|마을|순환|공영|맞춤|따복|농어촌|feeder|village|branch|circuit/i.test(tp)) {
            return "BRANCH";
        }
        if (/간선|일반|main|trunk/i.test(tp)) {
            return "MAIN";
        }
    }

    // 2. Route Number / Name heuristic patterns
    if (/^[MG]\d|^P\d|급행/i.test(no)) {
        return "EXPRESS";
    }
    if (/마을|공영|순환|조조|통학|따복|희망|누리/i.test(no)) {
        return "BRANCH";
    }

    // 3. Known circular / branch routes in Wonju (3, 4, 16 series)
    if (["3", "3-1", "4", "4-1", "16", "16-1"].includes(no)) {
        return "BRANCH";
    }

    // Default general city bus is MAIN (간선)
    return "MAIN";
}

export const ROUTE_COLOR_PALETTE: RouteColorConfig[] = [
    ROUTE_TYPE_COLORS.MAIN,
    ROUTE_TYPE_COLORS.BRANCH,
    ROUTE_TYPE_COLORS.EXPRESS,
    {
        main: "#d97706", // Amber
        downMain: "#b45309",
        bg: "bg-amber-600",
        text: "text-amber-600 dark:text-amber-400",
        border: "border-amber-500/30",
        badgeBg: "bg-amber-500/10 dark:bg-amber-400/15"
    },
    {
        main: "#7c3aed", // Purple
        downMain: "#6d28d9",
        bg: "bg-purple-600",
        text: "text-purple-600 dark:text-purple-400",
        border: "border-purple-500/30",
        badgeBg: "bg-purple-500/10 dark:bg-purple-400/15"
    },
    {
        main: "#0891b2", // Cyan
        downMain: "#0e7490",
        bg: "bg-cyan-600",
        text: "text-cyan-600 dark:text-cyan-400",
        border: "border-cyan-500/30",
        badgeBg: "bg-cyan-500/10 dark:bg-cyan-400/15"
    },
];

/**
 * Returns a color configuration for a given route name and optional type.
 * EXPRESS: Red, MAIN: Blue, BRANCH: Green.
 */
export function getRouteColor(routeName: string, routeTp?: string): RouteColorConfig {
    if (!routeName) return ROUTE_TYPE_COLORS.MAIN;
    const type = classifyRouteType(routeName, routeTp);
    return ROUTE_TYPE_COLORS[type];
}

/**
 * Returns a distinct color configuration for a specific route ID within a route or by ID hash.
 */
export function getRouteIdColor(routeId?: string | null, routeIds?: string[], routeName?: string, routeTp?: string): RouteColorConfig {
    if (routeIds && routeIds.length > 0 && routeId) {
        const idx = routeIds.indexOf(routeId);
        if (idx === 0) {
            return getRouteColor(routeName || "", routeTp);
        }
        if (idx > 0) {
            return ROUTE_COLOR_PALETTE[(idx + 1) % ROUTE_COLOR_PALETTE.length];
        }
    }

    return getRouteColor(routeName || "", routeTp);
}

export const BUS_DIRECTION_COLORS = {
    UP: "#2563eb",     // Blue
    DOWN: "#1d4ed8",   // Darker Blue
    UNKNOWN: "#2563eb",
} as const;

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
