/**
 * Common API request validation utilities
 */

const ROUTE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const ROUTE_NAME_REGEX = /^[a-zA-Z0-9_\uAC00-\uD7A3-]+$/;
const NUMERIC_ID_REGEX = /^\d+$/;

export const ApiValidators = {
    /** Validates standard route ID (e.g. "WJB251000068", "30", "GWB320200030") */
    isValidRouteId(id?: string | null): boolean {
        if (!id || typeof id !== "string") return false;
        const trimmed = id.trim();
        return trimmed.length > 0 && trimmed.length <= 50 && ROUTE_ID_REGEX.test(trimmed);
    },

    /** Validates route name including Korean characters (e.g. "30", "34-1", "원주공항") */
    isValidRouteName(name?: string | null): boolean {
        if (!name || typeof name !== "string") return false;
        const trimmed = name.trim();
        return trimmed.length > 0 && trimmed.length <= 30 && ROUTE_NAME_REGEX.test(trimmed);
    },

    /** Validates station / bus stop node ID */
    isValidStopId(id?: string | null): boolean {
        if (!id || typeof id !== "string") return false;
        const trimmed = id.trim();
        return trimmed.length > 0 && trimmed.length <= 50 && ROUTE_ID_REGEX.test(trimmed);
    },

    /** Validates purely numeric IDs (e.g. notice ID, page number) */
    isValidNumericId(id?: string | null): boolean {
        if (!id || typeof id !== "string") return false;
        const trimmed = id.trim();
        return trimmed.length > 0 && trimmed.length <= 20 && NUMERIC_ID_REGEX.test(trimmed);
    },
};
