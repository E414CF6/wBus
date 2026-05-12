export function normalizeRouteIds(routeIds: readonly string[]): string[] {
    return Array.from(new Set(routeIds
        .map((id) => id.trim())
        .filter(Boolean))).sort();
}

export function buildRouteIdsKey(routeIds: readonly string[], separator = ","): string {
    return normalizeRouteIds(routeIds).join(separator);
}

export function parseRouteIdsParam(rawRouteIds: string | null | undefined, limit?: number): string[] {
    const normalizedRouteIds = normalizeRouteIds((rawRouteIds ?? "").split(","));
    if (typeof limit !== "number") {
        return normalizedRouteIds;
    }
    return normalizedRouteIds.slice(0, Math.max(0, limit));
}
