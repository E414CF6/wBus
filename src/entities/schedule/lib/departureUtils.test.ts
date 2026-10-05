import {describe, expect, it} from "vitest";
import {getNextDeparture, getUpcomingDepartures, selectRouteVariant} from "./departureUtils";
import type {BusRoute, TimetableEntry} from "../types";

describe("departureUtils", () => {
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

        it("identifies the earliest upcoming departure even if timetable is not sorted in chronological order", () => {
            const unsortedTimetable: TimetableEntry[] = [{
                seq: 1,
                originDepTime: "08:45",
                destDepTime: "08:45",
                type: "공통",
                notes: ""
            }, {seq: 2, originDepTime: "06:32", destDepTime: "06:32", type: "공통", notes: ""}, {
                seq: 3,
                originDepTime: "07:40",
                destDepTime: "07:40",
                type: "공통",
                notes: ""
            },];
            const midnight = new Date("2026-10-06T00:09:00");
            const res = getNextDeparture(unsortedTimetable, midnight);

            expect(res.nextDest?.destDepTime).toBe("06:32");
            expect(res.nextOrigin?.originDepTime).toBe("06:32");
            expect(res.soonest?.time).toBe("06:32");

            const upcoming = getUpcomingDepartures(unsortedTimetable, "DEST", midnight);
            expect(upcoming.nextDeparture?.timeStr).toBe("06:32");
            expect(upcoming.subsequentDepartures[0]?.timeStr).toBe("07:40");
            expect(upcoming.subsequentDepartures[1]?.timeStr).toBe("08:45");
        });

        it("correctly handles midnight 00:00 departures", () => {
            const midnightTimetable: TimetableEntry[] = [{
                seq: 1,
                originDepTime: "00:00",
                destDepTime: "00:00",
                type: "공통",
                notes: ""
            }, {seq: 2, originDepTime: "06:30", destDepTime: "06:30", type: "공통", notes: ""},];
            const midnight = new Date("2026-10-06T00:00:00");
            const res = getNextDeparture(midnightTimetable, midnight);

            expect(res.nextDest?.destDepTime).toBe("00:00");
            expect(res.nextOrigin?.originDepTime).toBe("00:00");
        });
    });
});
