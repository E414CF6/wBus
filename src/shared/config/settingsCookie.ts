import {STORAGE_KEYS} from "@shared/config/env";
import type {DayMode} from "@shared/types/navigation";
import {setHapticEnabled} from "@shared/utils/haptics";

export const SETTINGS_COOKIE_NAME = "wbus_settings";
export const SETTINGS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export type DefaultStartPage = "map" | "yonsei";
export type YonseiDefaultDirection = "AUTO" | "OUTBOUND" | "INBOUND";
export type LivePollingIntervalMs = 5000 | 10000 | 15000 | 30000;

export const LIVE_POLLING_INTERVAL_OPTIONS: readonly LivePollingIntervalMs[] = [
    5000,
    10000,
    15000,
    30000,
];

export interface AppSettings {
    defaultStartPage: DefaultStartPage;
    showYonseiFeatures: boolean;
    yonseiDefaultDirection: YonseiDefaultDirection;
    defaultDayMode: DayMode;
    autoDetectCity: boolean;
    hapticEnabled: boolean;
    hasCompletedOnboarding: boolean;
    livePollingIntervalMs: LivePollingIntervalMs;
    smoothBusAnimation: boolean;
    showNearbyStops: boolean;
    showStopLabels: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
    defaultStartPage: "map",
    showYonseiFeatures: true,
    yonseiDefaultDirection: "AUTO",
    defaultDayMode: "AUTO",
    autoDetectCity: true,
    hapticEnabled: true,
    hasCompletedOnboarding: false,
    livePollingIntervalMs: 10000,
    smoothBusAnimation: true,
    showNearbyStops: true,
    showStopLabels: true,
};

function sanitizeSettings(raw: unknown): AppSettings {
    if (!raw || typeof raw !== "object") {
        return {...DEFAULT_APP_SETTINGS};
    }

    const obj = raw as Record<string, unknown>;

    const defaultStartPage: DefaultStartPage =
        obj.defaultStartPage === "yonsei" || obj.defaultStartPage === "map"
            ? obj.defaultStartPage
            : DEFAULT_APP_SETTINGS.defaultStartPage;

    const showYonseiFeatures: boolean =
        typeof obj.showYonseiFeatures === "boolean"
            ? obj.showYonseiFeatures
            : DEFAULT_APP_SETTINGS.showYonseiFeatures;

    const yonseiDefaultDirection: YonseiDefaultDirection =
        obj.yonseiDefaultDirection === "AUTO" ||
        obj.yonseiDefaultDirection === "OUTBOUND" ||
        obj.yonseiDefaultDirection === "INBOUND"
            ? obj.yonseiDefaultDirection
            : DEFAULT_APP_SETTINGS.yonseiDefaultDirection;

    const defaultDayMode: DayMode =
        obj.defaultDayMode === "AUTO" ||
        obj.defaultDayMode === "WEEKDAY" ||
        obj.defaultDayMode === "VACATION"
            ? obj.defaultDayMode
            : DEFAULT_APP_SETTINGS.defaultDayMode;

    const autoDetectCity: boolean =
        typeof obj.autoDetectCity === "boolean"
            ? obj.autoDetectCity
            : DEFAULT_APP_SETTINGS.autoDetectCity;

    const hapticEnabled: boolean =
        typeof obj.hapticEnabled === "boolean"
            ? obj.hapticEnabled
            : DEFAULT_APP_SETTINGS.hapticEnabled;

    const hasCompletedOnboarding: boolean =
        typeof obj.hasCompletedOnboarding === "boolean"
            ? obj.hasCompletedOnboarding
            : DEFAULT_APP_SETTINGS.hasCompletedOnboarding;

    const livePollingIntervalMs: LivePollingIntervalMs =
        obj.livePollingIntervalMs === 5000 ||
        obj.livePollingIntervalMs === 10000 ||
        obj.livePollingIntervalMs === 15000 ||
        obj.livePollingIntervalMs === 30000
            ? obj.livePollingIntervalMs
            : DEFAULT_APP_SETTINGS.livePollingIntervalMs;

    const smoothBusAnimation: boolean =
        typeof obj.smoothBusAnimation === "boolean"
            ? obj.smoothBusAnimation
            : DEFAULT_APP_SETTINGS.smoothBusAnimation;

    const showNearbyStops: boolean =
        typeof obj.showNearbyStops === "boolean"
            ? obj.showNearbyStops
            : DEFAULT_APP_SETTINGS.showNearbyStops;

    const showStopLabels: boolean =
        typeof obj.showStopLabels === "boolean"
            ? obj.showStopLabels
            : DEFAULT_APP_SETTINGS.showStopLabels;

    return {
        defaultStartPage,
        showYonseiFeatures,
        yonseiDefaultDirection,
        defaultDayMode,
        autoDetectCity,
        hapticEnabled,
        hasCompletedOnboarding,
        livePollingIntervalMs,
        smoothBusAnimation,
        showNearbyStops,
        showStopLabels,
    };
}

function extractRawCookieValue(cookieStr: string, name: string): string | null {
    const pairs = cookieStr.split(";");
    for (const pair of pairs) {
        const trimmed = pair.trim();
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        if (key === name) {
            return trimmed.slice(eqIdx + 1).trim();
        }
    }
    return null;
}

/**
 * Parses AppSettings from a raw document.cookie string.
 * Missing or malformed values safely fall back to DEFAULT_APP_SETTINGS.
 */
export function parseSettingsCookie(cookieStr?: string | null): AppSettings {
    if (!cookieStr || typeof cookieStr !== "string") {
        return {...DEFAULT_APP_SETTINGS};
    }

    const rawValue = extractRawCookieValue(cookieStr, SETTINGS_COOKIE_NAME);
    if (!rawValue) {
        return {...DEFAULT_APP_SETTINGS};
    }

    try {
        const decoded = decodeURIComponent(rawValue);
        const parsed: unknown = JSON.parse(decoded);
        return sanitizeSettings(parsed);
    } catch {
        return {...DEFAULT_APP_SETTINGS};
    }
}

/**
 * Serializes AppSettings into a browser Set-Cookie assignment string.
 */
export function serializeSettingsCookie(settings: AppSettings): string {
    const sanitized = sanitizeSettings(settings);
    const encoded = encodeURIComponent(JSON.stringify(sanitized));
    return `${SETTINGS_COOKIE_NAME}=${encoded}; path=/; max-age=${SETTINGS_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * Reads AppSettings from browser document.cookie (with legacy localStorage autoDetect fallback).
 */
export function readSettingsFromBrowser(): AppSettings {
    if (typeof document === "undefined") {
        return {...DEFAULT_APP_SETTINGS};
    }

    const rawCookie = extractRawCookieValue(document.cookie || "", SETTINGS_COOKIE_NAME);
    const parsed = parseSettingsCookie(document.cookie);

    if (!rawCookie && typeof window !== "undefined") {
        try {
            const savedAuto = window.localStorage.getItem(STORAGE_KEYS.CITY_AUTO_DETECT);
            if (savedAuto !== null) {
                parsed.autoDetectCity = savedAuto !== "false";
            }
        } catch {
            // Ignore localStorage access failure
        }
    }

    return parsed;
}

/**
 * Writes AppSettings to browser document.cookie and syncs localStorage & haptic runtime flag.
 */
export function writeSettingsToBrowser(settings: AppSettings): void {
    const sanitized = sanitizeSettings(settings);
    setHapticEnabled(sanitized.hapticEnabled);

    if (typeof document !== "undefined") {
        document.cookie = serializeSettingsCookie(sanitized);
    }

    if (typeof window !== "undefined") {
        try {
            window.localStorage.setItem(
                STORAGE_KEYS.CITY_AUTO_DETECT,
                String(sanitized.autoDetectCity)
            );
        } catch {
            // Ignore localStorage access failure
        }
    }
}

/**
 * Expires the settings cookie in the browser.
 */
export function clearSettingsCookie(): void {
    if (typeof document !== "undefined") {
        document.cookie = `${SETTINGS_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
    }
}

/**
 * Resolves the initial Yonsei campus direction mode based on user preference and current time.
 * - "AUTO": morning (< 12:00) -> "INBOUND" (등교), afternoon/evening (>= 12:00) -> "OUTBOUND" (하교)
 */
export function resolveInitialCampusDirection(
    pref: YonseiDefaultDirection,
    now: Date = new Date()
): "OUTBOUND" | "INBOUND" {
    if (pref === "OUTBOUND" || pref === "INBOUND") {
        return pref;
    }
    return now.getHours() < 12 ? "INBOUND" : "OUTBOUND";
}
