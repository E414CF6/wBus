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
 * 3. Internal /data proxy route (Serves from Vercel Blob / Local public data)
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
    const styleFileName = isDark ? (STATIC.PATHS.MAP_STYLE_DARK || "style-dark.json") : (STATIC.PATHS.MAP_STYLE || "style.json");

    // 1. If explicit Remote Base URL is configured with http(s)
    if (STATIC.BASE_URL && STATIC.BASE_URL !== "NOT_SET" && STATIC.BASE_URL.startsWith("http")) {
        return joinUrl(STATIC.BASE_URL, styleFileName);
    }

    // 2. Default to internal /data route (served via Next.js route handler from Vercel Blob or local files)
    return `/data/${styleFileName}`;
}
