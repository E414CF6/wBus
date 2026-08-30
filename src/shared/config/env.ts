import {getEnv, getEnvArray, getEnvBoolean, getEnvBounds, getEnvNumber} from "@shared/utils/parser";
import {UI_TEXT} from "@shared/config/locale";

/**
 * Common Static Data File & Folder Names
 */
export const STATIC_FILE_NAMES = {
    ROUTE_MAP: "routeMap.json",
    STATION_MAP: "stationMap.json",
    SCHEDULE: "schedule.json",
    STYLE: "style.json",
    STYLE_DARK: "style-dark.json",
    SEGMENTS: "segment.json",
    ROUTE_DIR: "route",
} as const;

/**
 * Resolves the public base URL for Vercel Blob store.
 * Supports explicit CDN base URL, OIDC/Token store ID extraction, or fallback.
 */
export function getBlobBaseUrl(): string | undefined {
    const customUrl = process.env.NEXT_PUBLIC_STATIC_API_URL || process.env.NEXT_PUBLIC_BLOB_BASE_URL;
    if (customUrl && customUrl.startsWith("http")) {
        return customUrl.replace(/\/+$/, "");
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return undefined;

    const match = token.match(/^vercel_blob_rw_([^_]+)_/);
    if (match) {
        return `https://${match[1].toLowerCase()}.public.blob.vercel-storage.com`;
    }

    return undefined;
}

// Default Geolocation Coordinates (Wonju City Hall / Central Station Area)
const DEFAULT_CENTER_COORDINATES = "37.3421,127.91976";
const RAW_POSITION = getEnv(process.env.NEXT_PUBLIC_MAP_DEFAULT_POSITION, DEFAULT_CENTER_COORDINATES);
const [defaultLat, defaultLng] = RAW_POSITION.split(",").map(Number);

export const APP_CONFIG = {
    NAME: getEnv(process.env.NEXT_PUBLIC_APP_NAME, UI_TEXT.METADATA.TITLE),
    IS_DEV: process.env.NODE_ENV === "development",
} as const;

export const SITE_CONFIG = {
    METADATA: {
        TITLE: getEnv(process.env.NEXT_PUBLIC_SITE_TITLE, UI_TEXT.METADATA.TITLE),
        DESCRIPTION: getEnv(process.env.NEXT_PUBLIC_SITE_DESCRIPTION, UI_TEXT.METADATA.DESC),
        BASE_URL: getEnv(process.env.NEXT_PUBLIC_SITE_BASE_URL, "https://wbus.vercel.app"),
        SOCIAL_IMAGE: getEnv(process.env.NEXT_PUBLIC_SOCIAL_IMAGE_PATH, "/opengraph-image.png"),
    },
} as const;

export const API_CONFIG = {
    LIVE: {
        POLLING_INTERVAL_MS: getEnvNumber(process.env.NEXT_PUBLIC_LIVE_API_REFRESH_INTERVAL, 3000),
        DATA_DELAY_MS: getEnvNumber(process.env.NEXT_PUBLIC_LIVE_DATA_DELAY, 0),
    },
    STATIC: {
        BASE_URL: getBlobBaseUrl() || "",
        USE_REMOTE: getEnvBoolean(process.env.NEXT_PUBLIC_USE_REMOTE_STATIC_DATA, true),
        REVALIDATE_SEC: 3600,
        PATHS: {
            ROUTE_DIR: STATIC_FILE_NAMES.ROUTE_DIR,
            SEGMENTS: STATIC_FILE_NAMES.SEGMENTS,
            MAP_STYLE: STATIC_FILE_NAMES.STYLE,
            MAP_STYLE_DARK: STATIC_FILE_NAMES.STYLE_DARK,
            ROUTE_MAP: STATIC_FILE_NAMES.ROUTE_MAP,
            STATION_MAP: STATIC_FILE_NAMES.STATION_MAP,
            SCHEDULE: STATIC_FILE_NAMES.SCHEDULE,
        },
    },
    MAP_STYLE_FALLBACK: getEnv(
        process.env.NEXT_PUBLIC_MAP_FALLBACK_API_URL,
        "https://tiles.openfreemap.org/styles/bright"
    ),
    MAP_STYLE_DARK_FALLBACK: getEnv(
        process.env.NEXT_PUBLIC_MAP_DARK_FALLBACK_API_URL,
        "https://tiles.openfreemap.org/styles/dark"
    ),
} as const;

export const MAP_SETTINGS = {
    BOUNDS: {
        MAX: getEnvBounds(process.env.NEXT_PUBLIC_MAP_MAX_BOUNDS, "37.10,127.60,37.60,128.30"),
        DEFAULT_CENTER: [defaultLat, defaultLng] as [number, number],
    },
    ZOOM: {
        DEFAULT: getEnvNumber(process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM, 13),
        MIN: getEnvNumber(process.env.NEXT_PUBLIC_MAP_MIN_ZOOM, 10),
        MAX: getEnvNumber(process.env.NEXT_PUBLIC_MAP_MAX_ZOOM, 20),
        BUS_STOP_VISIBLE: getEnvNumber(process.env.NEXT_PUBLIC_BUS_STOP_MARKER_MIN_ZOOM, 15),
    },
    ANIMATION: {
        BUS_MOVE_MS: getEnvNumber(process.env.NEXT_PUBLIC_BUS_ANIMATION_DURATION, 4000),
        FLY_TO_MS: getEnvNumber(process.env.NEXT_PUBLIC_MAP_FLY_TO_DURATION, 1000),
    },
    MARKERS: {
        BUS: {
            ICON_SIZE: [29, 43] as [number, number],
        },
    },
    ALWAYS_UPWARD_NODE_IDS: getEnvArray(process.env.NEXT_PUBLIC_ALWAYS_UPWARD_NODE_IDS, ","),
    DEFAULT_ROUTE: getEnv(process.env.NEXT_PUBLIC_DEFAULT_ROUTE, "30"),
    BUS_COLOR_BY_TYPE: {
        EXPRESS: "#f97316",
        GENERAL: "#3b82f6",
        VILLAGE: "#10b981",
        CIRCUIT: "#8b5cf6",
        DEFAULT: "#6b7280",
    },
} as const;

export const UI_CONFIG = {
    TRANSITIONS: {
        SPLASH_FADE_MS: getEnvNumber(process.env.NEXT_PUBLIC_SPLASH_FADE_DURATION, 500),
    },
} as const;

export const STORAGE_KEYS = {
    ROUTE_ID: "wbus_selected_route",
    MAP_VIEW: "wbus_map_view",
    ACTIVE_TAB: "wbus_active_tab",
    TIMETABLE_SUBTAB: "wbus_timetable_subtab",
} as const;
