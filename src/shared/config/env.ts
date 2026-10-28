import {getEnv, getEnvArray, getEnvBounds, getEnvNumber} from "@shared/utils/parser";
import {UI_TEXT} from "@shared/config/locale";

/**
 * Common Static Data File & Folder Names
 */
export const STATIC_FILE_NAMES = {
    STYLE_LIBERTY: "styles/liberty.json",
    STYLE_DARKER: "styles/darker.json",
} as const;

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
        POLLING_INTERVAL_MS: getEnvNumber(process.env.NEXT_PUBLIC_LIVE_API_REFRESH_INTERVAL, 10000),
        DATA_DELAY_MS: getEnvNumber(process.env.NEXT_PUBLIC_LIVE_DATA_DELAY, 12000),
    },
    STATIC: {
        PATHS: {
            MAP_STYLE: STATIC_FILE_NAMES.STYLE_LIBERTY,
            MAP_STYLE_DARK: STATIC_FILE_NAMES.STYLE_DARKER,
        },
    },
} as const;

export const MAP_SETTINGS = {
    BOUNDS: {
        MAX: getEnvBounds(process.env.NEXT_PUBLIC_MAP_MAX_BOUNDS, "32.80,124.00,38.90,132.50"),
        DEFAULT_CENTER: [defaultLat, defaultLng] as [number, number],
    },
    ZOOM: {
        DEFAULT: getEnvNumber(process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM, 13),
        MIN: getEnvNumber(process.env.NEXT_PUBLIC_MAP_MIN_ZOOM, 6),
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
    }, CANVAS: {
        DEFAULT_MAX_SIZE: [getEnvNumber(process.env.NEXT_PUBLIC_MAP_MAX_CANVAS_WIDTH, getEnvNumber(process.env.NEXT_PUBLIC_MAP_MAX_CANVAS_SIZE, 8192)), getEnvNumber(process.env.NEXT_PUBLIC_MAP_MAX_CANVAS_HEIGHT, getEnvNumber(process.env.NEXT_PUBLIC_MAP_MAX_CANVAS_SIZE, 8192)),] as [number, number],
    },
    ALWAYS_UPWARD_NODE_IDS: getEnvArray(process.env.NEXT_PUBLIC_ALWAYS_UPWARD_NODE_IDS, ","),
    DEFAULT_ROUTE: getEnv(process.env.NEXT_PUBLIC_DEFAULT_ROUTE, "30"),
} as const;

export const STORAGE_KEYS = {
    ROUTE_ID: "wbus_selected_route",
    CITY_CODE: "wbus_selected_city",
    CITY_AUTO_DETECT: "wbus_city_auto_detect",
    MAP_VIEW: "wbus_map_view",
    WONJU_BOOKMARKS: "wonju_bus_bookmarks",
    WONJU_RECENT_ROUTES: "wbus_recent_map_routes",
    SCHEDULE_CACHE: "wbus_cached_schedule_v2",
    NOTICE_LIST_CACHE: "wbus_cached_notice_list_v1",
    NOTICE_DETAIL_PREFIX: "wbus_cached_notice_detail_",
    CITY_ROUTES_PREFIX: "wbus_cached_city_routes_v1_",
    POLYLINE_PREFIX: "wbus_cached_polyline_v1_",
    ROUTE_STOPS_PREFIX: "wbus_cached_route_stops_v1_",
    FAVORITE_STOPS: "wbus_favorite_stops_v1",
    TIMETABLE_SUBTAB: "wbus_timetable_subtab",
    ACTIVE_TAB: "wbus_active_tab",
} as const;

export function getBookmarkStorageKey(cityCode: string = "32020"): string {
    return cityCode === "32020" ? STORAGE_KEYS.WONJU_BOOKMARKS : `wbus_bookmarks_${cityCode}`;
}

export function getRecentRoutesStorageKey(cityCode: string = "32020"): string {
    return cityCode === "32020" ? STORAGE_KEYS.WONJU_RECENT_ROUTES : `wbus_recent_routes_${cityCode}`;
}

export function getFavoriteStopsStorageKey(cityCode: string = "32020"): string {
    return `${STORAGE_KEYS.FAVORITE_STOPS}_${cityCode}`;
}

