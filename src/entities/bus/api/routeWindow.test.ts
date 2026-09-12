import {describe, expect, it} from "vitest";
import {
    extractRouteNumber,
    formatMinutesToTime,
    getCurrentKstMinutes,
    parseTimeToMinutes,
} from "./routeWindow";

describe("routeWindow utility functions", () => {
    describe("parseTimeToMinutes", () => {
        it("correctly parses valid HH:MM strings into minutes", () => {
            expect(parseTimeToMinutes("00:00")).toBe(0);
            expect(parseTimeToMinutes("06:30")).toBe(390);
            expect(parseTimeToMinutes("12:00")).toBe(720);
            expect(parseTimeToMinutes("23:59")).toBe(1439);
        });

        it("handles whitespace and single-digit hours", () => {
            expect(parseTimeToMinutes(" 6:30 ")).toBe(390);
            expect(parseTimeToMinutes(" 0:00 ")).toBe(0);
        });

        it("returns null for invalid, empty, or special marker values", () => {
            expect(parseTimeToMinutes(null)).toBeNull();
            expect(parseTimeToMinutes(undefined)).toBeNull();
            expect(parseTimeToMinutes("")).toBeNull();
            expect(parseTimeToMinutes("-")).toBeNull();
            expect(parseTimeToMinutes("통학")).toBeNull();
            expect(parseTimeToMinutes("invalid")).toBeNull();
            expect(parseTimeToMinutes("abc:def")).toBeNull();
        });
    });

    describe("formatMinutesToTime", () => {
        it("formats minutes into padded HH:MM format", () => {
            expect(formatMinutesToTime(0)).toBe("00:00");
            expect(formatMinutesToTime(390)).toBe("06:30");
            expect(formatMinutesToTime(720)).toBe("12:00");
            expect(formatMinutesToTime(1439)).toBe("23:59");
        });

        it("wraps around values beyond 1440 minutes", () => {
            expect(formatMinutesToTime(1440)).toBe("00:00");
            expect(formatMinutesToTime(1470)).toBe("00:30");
        });
    });

    describe("extractRouteNumber", () => {
        it("cleans route variants with dayType annotations", () => {
            expect(extractRouteNumber("30(평일)")).toBe("30");
            expect(extractRouteNumber("34(방학)")).toBe("34");
            expect(extractRouteNumber("34-1(토,공휴일)")).toBe("34-1");
        });

        it("extracts short route number from Wonju city route IDs (GWB32020...)", () => {
            expect(extractRouteNumber("GWB320200030")).toBe("30");
            expect(extractRouteNumber("GWB320200034")).toBe("34");
            expect(extractRouteNumber("GWB320200341")).toBe("341");
        });

        it("returns plain numbers intact", () => {
            expect(extractRouteNumber("30")).toBe("30");
            expect(extractRouteNumber("34-1")).toBe("34-1");
            expect(extractRouteNumber("2-1")).toBe("2-1");
        });
    });

    describe("getCurrentKstMinutes", () => {
        it("returns a valid minute number within 0 ~ 1439", () => {
            const minutes = getCurrentKstMinutes();
            expect(minutes).toBeGreaterThanOrEqual(0);
            expect(minutes).toBeLessThan(1440);
        });

        it("correctly converts UTC dates to KST (UTC+9)", () => {
            // 2026-09-12T00:00:00Z -> 09:00 in KST -> 540 minutes
            const testUtcDate = new Date(Date.UTC(2026, 8, 12, 0, 0, 0));
            const kstMinutes = getCurrentKstMinutes(testUtcDate);
            expect(kstMinutes).toBe(540);
        });
    });
});
