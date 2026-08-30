import {API_CONFIG, APP_CONFIG} from "@shared/config/env";

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

/**
 * Safely joins a base URL and a path, avoiding duplicate slashes.
 */
function joinUrl(base: string, path: string): string {
    const cleanBase = base.replace(/\/+$/, "");
    const cleanPath = path.replace(/^\/+/, "");
    return `${cleanBase}/${cleanPath}`;
}

/**
 * Determines the source URL for the map style JSON.
 * Priority:
 * 1. Environment Variable (NEXT_PUBLIC_MAP_URL)
 * 2. Remote Static Server (if USE_REMOTE is true)
 * 3. Local Public Directory (Default)
 */
export function getMapStyleUrl(): string {
    const {STATIC} = API_CONFIG;

    // Explicit Override via Environment Variable
    // Useful for using third-party styles or a specific CDN in production
    if (process.env.NEXT_PUBLIC_MAP_URL) {
        return process.env.NEXT_PUBLIC_MAP_URL;
    }

    const styleFileName = STATIC.PATHS.MAP_STYLE || "config.json";

    // Remote Mode
    if (STATIC.USE_REMOTE) {
        if (!STATIC.BASE_URL || STATIC.BASE_URL === "NOT_SET") {
            if (APP_CONFIG.IS_DEV) {
                console.warn(
                    "[getMapStyleUrl] 'STATIC_API_URL' is missing while USE_REMOTE is true. Using fallback."
                );
            }
            return API_CONFIG.MAP_STYLE_FALLBACK;
        }
        return joinUrl(STATIC.BASE_URL, styleFileName);
    }

    // Local Mode (Default)
    // Falls back to serving from the local /public/data directory
    const localBase = STATIC.BASE_URL && STATIC.BASE_URL !== "NOT_SET"
        ? STATIC.BASE_URL
        : "/data";

    return joinUrl(localBase, styleFileName);
}
