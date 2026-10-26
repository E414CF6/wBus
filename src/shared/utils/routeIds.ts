export function normalizeRouteIds(routeIds: readonly string[]): string[] {
    return Array.from(new Set(routeIds
        .map((id) => id.trim())
        .filter(Boolean))).sort();
}

export function buildRouteIdsKey(routeIds: readonly string[], separator = ","): string {
    return normalizeRouteIds(routeIds).join(separator);
}
