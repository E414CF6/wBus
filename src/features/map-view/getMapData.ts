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
 * Switches between light and dark map styles according to the current theme.
 * Priority:
 * 1. Environment Variable (NEXT_PUBLIC_MAP_URL / NEXT_PUBLIC_MAP_DARK_URL)
 * 2. Remote Static Server (if USE_REMOTE is true)
 * 3. Local Public Directory (Default: /data/style.json or /data/style-dark.json)
 */
export function getMapStyleUrl(theme?: string | boolean): string {
    let isDark = false;
    if (typeof theme === "string") {
        isDark = theme === "dark";
    } else if (typeof theme === "boolean") {
        isDark = theme;
    } else if (typeof document !== "undefined") {
        isDark = document.documentElement.classList.contains("dark");
    }

    // Explicit Override via Environment Variable
    if (isDark && process.env.NEXT_PUBLIC_MAP_DARK_URL) {
        return process.env.NEXT_PUBLIC_MAP_DARK_URL;
    }
    if (!isDark && process.env.NEXT_PUBLIC_MAP_URL) {
        return process.env.NEXT_PUBLIC_MAP_URL;
    }

    const {STATIC} = API_CONFIG;
    const styleFileName = isDark
        ? (STATIC.PATHS.MAP_STYLE_DARK || "style-dark.json")
        : (STATIC.PATHS.MAP_STYLE || "style.json");

    // Remote Mode
    if (STATIC.USE_REMOTE) {
        if (!STATIC.BASE_URL || STATIC.BASE_URL === "NOT_SET") {
            if (APP_CONFIG.IS_DEV) {
                console.warn(
                    `[getMapStyleUrl] 'STATIC_API_URL' is missing while USE_REMOTE is true. Using fallback for ${isDark ? "dark" : "light"}.`
                );
            }
            return isDark ? API_CONFIG.MAP_STYLE_DARK_FALLBACK : API_CONFIG.MAP_STYLE_FALLBACK;
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
