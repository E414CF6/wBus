export interface RouteColorConfig {
    main: string;
    downMain: string;
    bg: string;
    text: string;
    border: string;
    badgeBg: string;
}

export const ROUTE_COLOR_PALETTE: RouteColorConfig[] = [{
    main: "#2563eb", // Blue
    downMain: "#1d4ed8",
    bg: "bg-blue-600",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/30",
    badgeBg: "bg-blue-500/10 dark:bg-blue-400/15"
}, {
    main: "#059669", // Emerald
    downMain: "#047857",
    bg: "bg-emerald-600",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/30",
    badgeBg: "bg-emerald-500/10 dark:bg-emerald-400/15"
}, {
    main: "#d97706", // Amber
    downMain: "#b45309",
    bg: "bg-amber-600",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/30",
    badgeBg: "bg-amber-500/10 dark:bg-amber-400/15"
}, {
    main: "#7c3aed", // Purple
    downMain: "#6d28d9",
    bg: "bg-purple-600",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/30",
    badgeBg: "bg-purple-500/10 dark:bg-purple-400/15"
}, {
    main: "#e11d48", // Rose
    downMain: "#be123c",
    bg: "bg-rose-600",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-500/30",
    badgeBg: "bg-rose-500/10 dark:bg-rose-400/15"
}, {
    main: "#0891b2", // Cyan
    downMain: "#0e7490",
    bg: "bg-cyan-600",
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-500/30",
    badgeBg: "bg-cyan-500/10 dark:bg-cyan-400/15"
}, {
    main: "#ea580c", // Orange
    downMain: "#c2410c",
    bg: "bg-orange-600",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-500/30",
    badgeBg: "bg-orange-500/10 dark:bg-orange-400/15"
}, {
    main: "#4f46e5", // Indigo
    downMain: "#4338ca",
    bg: "bg-indigo-600",
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-500/30",
    badgeBg: "bg-indigo-500/10 dark:bg-indigo-400/15"
}, {
    main: "#db2777", // Pink
    downMain: "#be185d",
    bg: "bg-pink-600",
    text: "text-pink-600 dark:text-pink-400",
    border: "border-pink-500/30",
    badgeBg: "bg-pink-500/10 dark:bg-pink-400/15"
}, {
    main: "#0d9488", // Teal
    downMain: "#0f766e",
    bg: "bg-teal-600",
    text: "text-teal-600 dark:text-teal-400",
    border: "border-teal-500/30",
    badgeBg: "bg-teal-500/10 dark:bg-teal-400/15"
}, {
    main: "#65a30d", // Lime
    downMain: "#4d7c0f",
    bg: "bg-lime-600",
    text: "text-lime-600 dark:text-lime-400",
    border: "border-lime-500/30",
    badgeBg: "bg-lime-500/10 dark:bg-lime-400/15"
}, {
    main: "#0284c7", // Sky
    downMain: "#0369a1",
    bg: "bg-sky-600",
    text: "text-sky-600 dark:text-sky-400",
    border: "border-sky-500/30",
    badgeBg: "bg-sky-500/10 dark:bg-sky-400/15"
},];

/**
 * Returns a deterministic, consistent color configuration for a given route name.
 */
export function getRouteColor(routeName: string): RouteColorConfig {
    if (!routeName) return ROUTE_COLOR_PALETTE[0];
    let hash = 0;
    for (let i = 0; i < routeName.length; i++) {
        hash = (hash << 5) - hash + routeName.charCodeAt(i);
        hash |= 0;
    }
    const index = Math.abs(hash) % ROUTE_COLOR_PALETTE.length;
    return ROUTE_COLOR_PALETTE[index];
}

/**
 * Returns a distinct color configuration for a specific route ID within a route or by ID hash.
 * If routeIds array is provided and routeId is found, assigns color by its index to guarantee distinct colors.
 */
export function getRouteIdColor(routeId?: string | null, routeIds?: string[], routeName?: string): RouteColorConfig {
    if (routeIds && routeIds.length > 0 && routeId) {
        const idx = routeIds.indexOf(routeId);
        if (idx !== -1) {
            return ROUTE_COLOR_PALETTE[idx % ROUTE_COLOR_PALETTE.length];
        }
    }

    if (routeId) {
        let hash = 0;
        for (let i = 0; i < routeId.length; i++) {
            hash = (hash << 5) - hash + routeId.charCodeAt(i);
            hash |= 0;
        }
        const index = Math.abs(hash) % ROUTE_COLOR_PALETTE.length;
        return ROUTE_COLOR_PALETTE[index];
    }

    return getRouteColor(routeName || "");
}

/**
 * Returns a distinct bus marker color based on route ID (matching polyline color)
 * or falls back to route / direction based color if route ID is not provided.
 * @param routeName Route name (e.g., "30")
 * @param direction 1 for upbound (상행), 0 for downbound (하행)
 * @param routeId Specific route ID (e.g., "WJB251000036")
 * @param routeIds List of route IDs for this route name
 */
export function getBusMarkerColor(routeName: string, direction?: number | null, routeId?: string | null, routeIds?: string[]): string {
    if (routeId) {
        return getRouteIdColor(routeId, routeIds, routeName).main;
    }
    if (direction === 0) return "#dc2626"; // 하행 (Downbound): Red fallback
    if (direction === 1) return "#2563eb"; // 상행 (Upbound): Blue fallback
    return getRouteColor(routeName).main;
}
