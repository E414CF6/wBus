import {API_CONFIG} from "@shared/config/env";

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

/**
 * Determines the source URL for the map style JSON.
 * Switches between light and dark map styles according to the current theme.
 * Priority:
 * 1. Explicit Override via Environment Variable (NEXT_PUBLIC_MAP_URL / NEXT_PUBLIC_MAP_DARK_URL)
 * 2. Static asset route from public directory (/styles/liberty.json, /styles/darker.json)
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

    // Default to static asset route (served statically by Next.js from public/)
    return `/${stylePath}`;
}

export {getMaxCanvasSize} from "./mapCanvas";
