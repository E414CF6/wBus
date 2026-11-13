import {describe, expect, it} from "vitest";
import {
    DEFAULT_APP_SETTINGS,
    parseSettingsCookie,
    resolveInitialCampusDirection,
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
                defaultStartPage: "yonsei" as const,
                showYonseiFeatures: false,
                yonseiDefaultDirection: "INBOUND" as const,
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
                DEFAULT_APP_SETTINGS
            );
        });

        it("merges partial fields and sanitizes invalid field values to defaults", () => {
            const raw = encodeURIComponent(
                JSON.stringify({
                    defaultStartPage: "invalid_page",
                    showYonseiFeatures: false,
                    yonseiDefaultDirection: "OUTBOUND",
                    defaultDayMode: "UNKNOWN",
                    hapticEnabled: "not-boolean",
                    livePollingIntervalMs: 99999,
                    smoothBusAnimation: false,
                    showNearbyStops: "yes",
                    autoFitRouteBounds: "no",
                    showBusPlateNumber: true,
                    fontScale: "huge",
                })
            );

            const parsed = parseSettingsCookie(`${SETTINGS_COOKIE_NAME}=${raw}`);
            expect(parsed).toEqual({
                defaultStartPage: "map",
                showYonseiFeatures: false,
                yonseiDefaultDirection: "OUTBOUND",
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
            expect(parseSettingsCookie(completedCookie.split(";")[0]).hasCompletedOnboarding).toBe(true);
        });
    });

    describe("resolveInitialCampusDirection", () => {
        it("returns fixed direction when preference is OUTBOUND or INBOUND", () => {
            const morning = new Date(2026, 10, 13, 8, 30);
            const evening = new Date(2026, 10, 13, 18, 30);
            expect(resolveInitialCampusDirection("OUTBOUND", morning)).toBe("OUTBOUND");
            expect(resolveInitialCampusDirection("INBOUND", evening)).toBe("INBOUND");
        });

        it("auto-selects INBOUND in morning and OUTBOUND in afternoon/evening", () => {
            const morning = new Date(2026, 10, 13, 9, 15);
            const noon = new Date(2026, 10, 13, 12, 0);
            const afternoon = new Date(2026, 10, 13, 16, 40);
            expect(resolveInitialCampusDirection("AUTO", morning)).toBe("INBOUND");
            expect(resolveInitialCampusDirection("AUTO", noon)).toBe("OUTBOUND");
            expect(resolveInitialCampusDirection("AUTO", afternoon)).toBe("OUTBOUND");
        });
    });
});
