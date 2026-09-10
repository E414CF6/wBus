import {describe, expect, it} from "vitest";
import {
    formatCooldownRemaining,
    formatMinutesToTime,
    formatRelativeTime,
    formatRemainingTime,
    isWeekend,
    parseTimeToMinutes,
} from "./timeUtils";

describe("timeUtils", () => {
    describe("parseTimeToMinutes", () => {
        it("correctly parses valid HH:mm time strings", () => {
            expect(parseTimeToMinutes("00:00")).toBe(0);
            expect(parseTimeToMinutes("06:30")).toBe(390);
            expect(parseTimeToMinutes("14:45")).toBe(885);
            expect(parseTimeToMinutes("23:59")).toBe(1439);
        });

        it("returns null for invalid inputs or empty strings", () => {
            expect(parseTimeToMinutes(null)).toBeNull();
            expect(parseTimeToMinutes(undefined)).toBeNull();
            expect(parseTimeToMinutes("")).toBeNull();
            expect(parseTimeToMinutes("-")).toBeNull();
            expect(parseTimeToMinutes("invalid")).toBeNull();
            expect(parseTimeToMinutes("25:00")).toBe(1500);
        });
    });

    describe("formatMinutesToTime", () => {
        it("formats total minutes into HH:mm with zero-padding", () => {
            expect(formatMinutesToTime(0)).toBe("00:00");
            expect(formatMinutesToTime(65)).toBe("01:05");
            expect(formatMinutesToTime(885)).toBe("14:45");
        });
    });

    describe("isWeekend", () => {
        it("identifies Saturday and Sunday accurately", () => {
            const saturday = new Date("2026-09-05T12:00:00"); // Saturday
            const sunday = new Date("2026-09-06T12:00:00"); // Sunday
            const monday = new Date("2026-09-07T12:00:00"); // Monday

            expect(isWeekend(saturday)).toBe(true);
            expect(isWeekend(sunday)).toBe(true);
            expect(isWeekend(monday)).toBe(false);
        });
    });

    describe("formatCooldownRemaining", () => {
        it("returns isReady: true when no timestamp is passed or cooldown expired", () => {
            expect(formatCooldownRemaining(null).isReady).toBe(true);
            const pastDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
            expect(formatCooldownRemaining(pastDate).isReady).toBe(true);
        });

        it("returns remaining hours and mins when within cooldown", () => {
            const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
            const res = formatCooldownRemaining(recentDate, 24);
            expect(res.isReady).toBe(false);
            expect(res.remainingMs).toBeGreaterThan(0);
        });
    });

    describe("formatRelativeTime", () => {
        it("formats recent ISO timestamps correctly", () => {
            const now = new Date();
            expect(formatRelativeTime(now.toISOString())).toBe("방금 전");

            const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            expect(formatRelativeTime(fiveMinsAgo)).toBe("5분 전");

            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
            expect(formatRelativeTime(twoHoursAgo)).toBe("2시간 전");
        });
    });

    describe("formatRemainingTime", () => {
        it("returns empty string when input is null or invalid", () => {
            expect(formatRemainingTime(null)).toBe("");
            expect(formatRemainingTime("invalid-date")).toBe("");
        });

        it("returns available now when target is in the past", () => {
            const past = new Date(Date.now() - 60000).toISOString();
            expect(formatRemainingTime(past)).toBe("지금 갱신 가능");
        });

        it("formats remaining days, hours, or minutes for future dates", () => {
            const futureMinutes = new Date(Date.now() + 15 * 60 * 1000).toISOString();
            expect(formatRemainingTime(futureMinutes)).toContain("15분 후");

            const futureHours = new Date(Date.now() + 2 * 3600 * 1000 + 10 * 60 * 1000).toISOString();
            expect(formatRemainingTime(futureHours)).toContain("2시간");

            const futureDays = new Date(Date.now() + 2 * 86400 * 1000 + 3 * 3600 * 1000).toISOString();
            expect(formatRemainingTime(futureDays)).toContain("2일");
        });
    });
});
