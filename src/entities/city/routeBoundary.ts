/**
 * City-level route boundary rules.
 *
 * MOLIT TAGO API shares cityCode "32020" between Wonju (WJB251*) and Hoengseong (WJB258*).
 * Centralizing the filtering logic here avoids repeating prefix checks across 11+ modules.
 */

export const WONJU_CITY_CODE = "32020";
export const HOENGSEONG_CITY_CODE = "32320";
export const HOENGSEONG_ROUTE_PREFIX = "WJB258";

export function isRouteAllowedInCity(cityCode: string, routeId: string): boolean {
    if (!routeId) return false;
    if (cityCode === WONJU_CITY_CODE) {
        return !routeId.startsWith(HOENGSEONG_ROUTE_PREFIX);
    }
    if (cityCode === HOENGSEONG_CITY_CODE) {
        return routeId.startsWith(HOENGSEONG_ROUTE_PREFIX);
    }
    return true;
}

export function filterRouteIdsByCity(cityCode: string, routeIds: string[]): string[] {
    if (cityCode !== WONJU_CITY_CODE && cityCode !== HOENGSEONG_CITY_CODE) {
        return routeIds;
    }
    return routeIds.filter((id) => isRouteAllowedInCity(cityCode, id));
}

export function filterRoutesByCity<T extends { routeid: string }>(cityCode: string, routes: T[]): T[] {
    if (cityCode !== WONJU_CITY_CODE && cityCode !== HOENGSEONG_CITY_CODE) {
        return routes;
    }
    return routes.filter((r) => isRouteAllowedInCity(cityCode, String(r.routeid)));
}

export function filterRouteNumbersMapByCity(
    cityCode: string,
    routeNumbers: Record<string, string[]>
): { cleaned: Record<string, string[]>; hadContamination: boolean } {
    if (cityCode !== WONJU_CITY_CODE && cityCode !== HOENGSEONG_CITY_CODE) {
        return {cleaned: routeNumbers, hadContamination: false};
    }

    const cleaned: Record<string, string[]> = {};
    let hadContamination = false;

    for (const [routeNo, ids] of Object.entries(routeNumbers)) {
        const filtered = filterRouteIdsByCity(cityCode, ids);
        if (filtered.length !== ids.length) {
            hadContamination = true;
        }
        if (filtered.length > 0) {
            cleaned[routeNo] = filtered;
        }
    }

    return {cleaned, hadContamination};
}

export function getCityBoundaryErrorMessage(cityCode: string, routeId: string): string | null {
    if (cityCode === WONJU_CITY_CODE && routeId.startsWith(HOENGSEONG_ROUTE_PREFIX)) {
        return `Route ${routeId} belongs to Hoengseong (32320), not Wonju (32020)`;
    }
    if (cityCode === HOENGSEONG_CITY_CODE && !routeId.startsWith(HOENGSEONG_ROUTE_PREFIX)) {
        return `Route ${routeId} belongs to Wonju (32020), not Hoengseong (32320)`;
    }
    return null;
}
