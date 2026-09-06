import {API_CONFIG} from "@shared/config/env";

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
 * 1. Explicit Override via Environment Variable (NEXT_PUBLIC_MAP_URL / NEXT_PUBLIC_MAP_DARK_URL)
 * 2. Remote Static Server / Blob (if NEXT_PUBLIC_STATIC_API_URL or BASE_URL is set)
 * 3. Static asset route from public directory (/styles/liberty.json, /styles/darker.json)
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
    const stylePath = isDark ? (STATIC.PATHS.MAP_STYLE_DARK || "styles/darker.json") : (STATIC.PATHS.MAP_STYLE || "styles/liberty.json");

    // 1. If explicit Remote Base URL is configured with http(s)
    if (STATIC.BASE_URL && STATIC.BASE_URL !== "NOT_SET" && STATIC.BASE_URL.startsWith("http")) {
        return joinUrl(STATIC.BASE_URL, stylePath);
    }

    // 2. Default to static asset route (served statically by Next.js from public/)
    return `/${stylePath}`;
}
