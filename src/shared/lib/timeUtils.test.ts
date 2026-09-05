import {describe, expect, it} from "vitest";
import {
    formatCooldownRemaining,
    formatMinutesToTime,
    formatRelativeTime,
    getNextDeparture,
    getUpcomingDepartures,
    isWeekend,
    parseTimeToMinutes,
    selectRouteVariant,
} from "./timeUtils";
import type {BusRoute, TimetableEntry} from "@shared/types/bus";

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
            expect(parseTimeToMinutes("25:00")).toBe(1500); // parses mathematical minutes
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

    describe("selectRouteVariant", () => {
        const mockRoutes: BusRoute[] = [
            {
                id: "34-w",
                rawNo: "34(평일)",
                routeNo: "34",
                dayType: "평일",
                origin: "장양리",
                destination: "연세대",
                firstBus: "06:00",
                lastBus: "22:00",
                runCount: "20",
                interval: "30",
                timetable: [],
            },
            {
                id: "34-h",
                rawNo: "34(방학,휴일)",
                routeNo: "34",
                dayType: "방학,휴일",
                origin: "장양리",
                destination: "연세대",
                firstBus: "06:30",
                lastBus: "21:30",
                runCount: "15",
                interval: "40",
                timetable: [],
            },
        ];

        it("selects weekday variant when isHolidayOrVacation is false", () => {
            const selected = selectRouteVariant(mockRoutes, "34", false);
            expect(selected?.id).toBe("34-w");
            expect(selected?.dayType).toBe("평일");
        });

        it("selects holiday/vacation variant when isHolidayOrVacation is true", () => {
            const selected = selectRouteVariant(mockRoutes, "34", true);
            expect(selected?.id).toBe("34-h");
            expect(selected?.dayType).toBe("방학,휴일");
        });

        it("returns null for non-existent route numbers", () => {
            expect(selectRouteVariant(mockRoutes, "999", false)).toBeNull();
        });
    });

    describe("getUpcomingDepartures", () => {
        const mockTimetable: TimetableEntry[] = [
            {seq: 1, originDepTime: "07:00", destDepTime: "08:00", type: "일반", notes: ""},
            {seq: 2, originDepTime: "07:30", destDepTime: "08:30", type: "일반", notes: ""},
            {seq: 3, originDepTime: "09:00", destDepTime: "10:00", type: "일반", notes: ""},
            {seq: 4, originDepTime: "12:00", destDepTime: "13:00", type: "일반", notes: ""},
        ];

        it("finds the soonest departure after the given reference time", () => {
            const refDate = new Date("2026-09-04T07:15:00");
            const result = getUpcomingDepartures(mockTimetable, "DEST", refDate);

            expect(result.nextDeparture).not.toBeNull();
            expect(result.nextDeparture?.timeStr).toBe("08:00");
            expect(result.subsequentDepartures.length).toBeGreaterThan(0);
        });

        it("returns null nextDeparture when all runs have passed", () => {
            const lateNight = new Date("2026-09-04T23:30:00");
            const result = getUpcomingDepartures(mockTimetable, "ORIGIN", lateNight);

            expect(result.nextDeparture).toBeNull();
            expect(result.subsequentDepartures).toHaveLength(0);
        });
    });

    describe("getNextDeparture", () => {
        const mockTimetable: TimetableEntry[] = [
            {seq: 1, originDepTime: "08:00", destDepTime: "08:15", type: "일반", notes: ""},
            {seq: 2, originDepTime: "09:00", destDepTime: "09:15", type: "일반", notes: ""},
        ];

        it("identifies the earliest departure between origin and destination", () => {
            const refDate = new Date("2026-09-04T07:30:00");
            const res = getNextDeparture(mockTimetable, refDate);

            expect(res.soonest).not.toBeNull();
            expect(res.soonest?.type).toBe("origin");
            expect(res.soonest?.time).toBe("08:00");
            expect(res.soonest?.waitMins).toBe(30);
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
});
