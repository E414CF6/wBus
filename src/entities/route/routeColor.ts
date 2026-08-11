export interface RouteColorConfig {
    main: string;
    downMain: string;
    bg: string;
    text: string;
    border: string;
    badgeBg: string;
}

export const ROUTE_COLOR_PALETTE: RouteColorConfig[] = [{
    main: "#2563eb",
    downMain: "#1d4ed8",
    bg: "bg-blue-600",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/30",
    badgeBg: "bg-blue-500/10 dark:bg-blue-400/15"
}, {
    main: "#7c3aed",
    downMain: "#6d28d9",
    bg: "bg-purple-600",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/30",
    badgeBg: "bg-purple-500/10 dark:bg-purple-400/15"
}, {
    main: "#059669",
    downMain: "#047857",
    bg: "bg-emerald-600",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/30",
    badgeBg: "bg-emerald-500/10 dark:bg-emerald-400/15"
}, {
    main: "#d97706",
    downMain: "#b45309",
    bg: "bg-amber-600",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/30",
    badgeBg: "bg-amber-500/10 dark:bg-amber-400/15"
}, {
    main: "#db2777",
    downMain: "#be185d",
    bg: "bg-pink-600",
    text: "text-pink-600 dark:text-pink-400",
    border: "border-pink-500/30",
    badgeBg: "bg-pink-500/10 dark:bg-pink-400/15"
}, {
    main: "#0891b2",
    downMain: "#0e7490",
    bg: "bg-cyan-600",
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-500/30",
    badgeBg: "bg-cyan-500/10 dark:bg-cyan-400/15"
}, {
    main: "#ea580c",
    downMain: "#c2410c",
    bg: "bg-orange-600",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-500/30",
    badgeBg: "bg-orange-500/10 dark:bg-orange-400/15"
}, {
    main: "#4f46e5",
    downMain: "#4338ca",
    bg: "bg-indigo-600",
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-500/30",
    badgeBg: "bg-indigo-500/10 dark:bg-indigo-400/15"
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
 * Returns a distinct bus marker color based on direction (상행: Blue, 하행: Red).
 * @param routeName Route name (e.g., "30")
 * @param direction 1 for upbound (상행), 0 for downbound (하행)
 */
export function getBusMarkerColor(routeName: string, direction?: number | null): string {
    if (direction === 0) return "#dc2626"; // 하행 (Downbound): Red
    if (direction === 1) return "#2563eb"; // 상행 (Upbound): Blue
    return getRouteColor(routeName).main;
}
