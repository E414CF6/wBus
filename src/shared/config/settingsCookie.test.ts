import {describe, expect, it} from "vitest";
import {
    DEFAULT_APP_SETTINGS,
    parseSettingsCookie,
    serializeSettingsCookie,
    SETTINGS_COOKIE_NAME,
} from "./settingsCookie";

describe("settingsCookie", () => {
    describe("serializeSettingsCookie & parseSettingsCookie", () => {
        it("returns default settings when cookie string is empty or missing", () => {
            expect(parseSettingsCookie("")).toEqual(DEFAULT_APP_SETTINGS);
            expect(parseSettingsCookie(null)).toEqual(DEFAULT_APP_SETTINGS);
            expect(parseSettingsCookie("other_cookie=123")).toEqual(DEFAULT_APP_SETTINGS);
        });

        it("round-trips valid AppSettings through cookie serialization", () => {
            const custom = {
                defaultDayMode: "WEEKDAY" as const,
                autoDetectCity: false,
                hapticEnabled: false,
                hasCompletedOnboarding: true,
                livePollingIntervalMs: 5000 as const,
                smoothBusAnimation: false,
                showNearbyStops: false,
                showStopLabels: false,
                autoFitRouteBounds: false,
                showTimetablePins: false,
                showWikiPins: false,
                showBusPlateNumber: true,
                rememberMapView: false,
                showMapControls: false,
                reduceMotion: true,
                fontScale: "large" as const,
            };

            const serialized = serializeSettingsCookie(custom);
            expect(serialized).toContain(`${SETTINGS_COOKIE_NAME}=`);
            expect(serialized).toContain("path=/");
            expect(serialized).toContain("SameSite=Lax");

            const parsed = parseSettingsCookie(`foo=bar; ${serialized.split(";")[0]}; baz=1`);
            expect(parsed).toEqual(custom);
        });

        it("recovers safely from malformed JSON cookie values", () => {
            expect(parseSettingsCookie(`${SETTINGS_COOKIE_NAME}=%7Bbroken-json`)).toEqual(
                DEFAULT_APP_SETTINGS,
            );
        });

        it("merges partial fields and sanitizes invalid field values to defaults", () => {
            const raw = encodeURIComponent(
                JSON.stringify({
                    defaultStartPage: "invalid_page",
                    defaultDayMode: "UNKNOWN",
                    hapticEnabled: "not-boolean",
                    livePollingIntervalMs: 99999,
                    smoothBusAnimation: false,
                    showNearbyStops: "yes",
                    autoFitRouteBounds: "no",
                    showBusPlateNumber: true,
                    fontScale: "huge",
                }),
            );

            const parsed = parseSettingsCookie(`${SETTINGS_COOKIE_NAME}=${raw}`);
            expect(parsed).toEqual({
                defaultDayMode: "AUTO",
                autoDetectCity: true,
                hapticEnabled: true,
                hasCompletedOnboarding: false,
                livePollingIntervalMs: 10000,
                smoothBusAnimation: false,
                showNearbyStops: true,
                showStopLabels: true,
                autoFitRouteBounds: true,
                showTimetablePins: true,
                showWikiPins: true,
                showBusPlateNumber: true,
                rememberMapView: true,
                showMapControls: true,
                reduceMotion: false,
                fontScale: "normal",
            });
        });

        it("defaults hasCompletedOnboarding to false when missing and preserves true once saved", () => {
            expect(parseSettingsCookie("").hasCompletedOnboarding).toBe(false);

            const completedCookie = serializeSettingsCookie({
                ...DEFAULT_APP_SETTINGS,
                hasCompletedOnboarding: true,
            });
            expect(parseSettingsCookie(completedCookie.split(";")[0]).hasCompletedOnboarding).toBe(
                true,
            );
        });
    });
});
