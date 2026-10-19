import {describe, expect, it} from "vitest";
import {computeDualHourlyTimetable} from "./hourlyTimetable";
import {selectRouteVariant} from "./departureUtils";
import type {BusRoute} from "../types";
import type {DayMode} from "@shared/types/navigation";

function resolveEffectiveIsHoliday(dayMode: DayMode, isTodayWeekendOrHoliday: boolean): boolean {
    if (dayMode === "WEEKDAY") return false;
    if (dayMode === "VACATION") return true;
    return isTodayWeekendOrHoliday;
}

describe("computeDualHourlyTimetable", () => {
    const mockWeekdayRoute: BusRoute = {
        id: "34(평일)",
        rawNo: "34(평일)",
        routeNo: "34",
        dayType: "평일",
        origin: "장양리",
        destination: "연세대",
        firstBus: "06:25",
        lastBus: "22:05",
        runCount: "28",
        interval: "30",
        timetable: [
            {seq: 1, originDepTime: "통학1번", destDepTime: "-", type: "공통", notes: ""},
            {seq: 2, originDepTime: "통학11번", destDepTime: "8:45", type: "공통", notes: ""},
            {seq: 3, originDepTime: "-", destDepTime: "6:32", type: "공통", notes: ""},
            {seq: 4, originDepTime: "6:25", destDepTime: "7:40", type: "공통", notes: ""},
            {seq: 5, originDepTime: "6:45", destDepTime: "8:15", type: "공통", notes: ""},
            {seq: 6, originDepTime: "7:15", destDepTime: "8:35", type: "공통", notes: ""},
            {seq: 7, originDepTime: "8:15", destDepTime: "9:33", type: "공통", notes: ""},
        ],
    };

    const mockVacationRoute: BusRoute = {
        id: "34(방학,휴일)",
        rawNo: "34(방학,휴일)",
        routeNo: "34",
        dayType: "방학,휴일",
        origin: "장양리",
        destination: "연세대",
        firstBus: "06:30",
        lastBus: "21:55",
        runCount: "23",
        interval: "40",
        timetable: [
            {seq: 1, originDepTime: "-", destDepTime: "6:33", type: "공통", notes: ""},
            {seq: 2, originDepTime: "-", destDepTime: "6:50", type: "공통", notes: ""},
            {seq: 3, originDepTime: "6:30", destDepTime: "7:45", type: "공통", notes: "연세대발)원주역"},
            {seq: 4, originDepTime: "7:17", destDepTime: "8:43", type: "공통", notes: ""},
        ],
    };

    const emptyFootnoteMap = new Map<string, number>();

    it("selects the earliest upcoming bus (06:32) at 00:09, not out-of-order 08:45", () => {
        const midnight = new Date("2026-10-06T00:09:00");
        const rows = computeDualHourlyTimetable({
            route: mockWeekdayRoute,
            weekdayRoute: mockWeekdayRoute,
            vacationRoute: mockVacationRoute,
            tableSearch: "",
            now: midnight,
            footnoteMap: emptyFootnoteMap,
            currentHourStr: "00",
        });

        const hour6 = rows.find((r) => r.hourStr === "06");
        expect(hour6).toBeDefined();

        const w6_32 = hour6?.weekdayMinutes.find((m) => m.destDepTime === "6:32");
        expect(w6_32?.isNextBus).toBe(true);

        const v6_33 = hour6?.vacationMinutes.find((m) => m.destDepTime === "6:33");
        expect(v6_33?.isNextBus).toBe(true);

        const hour8 = rows.find((r) => r.hourStr === "08");
        expect(hour8).toBeDefined();
        const w8_45 = hour8?.weekdayMinutes.find((m) => m.destDepTime === "8:45");
        expect(w8_45?.isNextBus).toBe(false);
    });

    it("sorts minutes chronologically within each hour row", () => {
        const midnight = new Date("2026-10-06T00:09:00");
        const rows = computeDualHourlyTimetable({
            route: mockWeekdayRoute,
            weekdayRoute: mockWeekdayRoute,
            vacationRoute: mockVacationRoute,
            tableSearch: "",
            now: midnight,
            footnoteMap: emptyFootnoteMap,
            currentHourStr: "00",
        });

        const hour8 = rows.find((r) => r.hourStr === "08");
        expect(hour8).toBeDefined();

        const minuteStrs = hour8?.weekdayMinutes.map((m) => m.minuteStr);
        expect(minuteStrs).toEqual(["15", "35", "45"]);
    });

    it("selects next bus correctly in the middle of the day (e.g. 08:20)", () => {
        const time820 = new Date("2026-10-06T08:20:00");
        const rows = computeDualHourlyTimetable({
            route: mockWeekdayRoute,
            weekdayRoute: mockWeekdayRoute,
            vacationRoute: mockVacationRoute,
            tableSearch: "",
            now: time820,
            footnoteMap: emptyFootnoteMap,
            currentHourStr: "08",
        });

        const hour8 = rows.find((r) => r.hourStr === "08");
        expect(hour8).toBeDefined();

        const w8_15 = hour8?.weekdayMinutes.find((m) => m.destDepTime === "8:15");
        const w8_35 = hour8?.weekdayMinutes.find((m) => m.destDepTime === "8:35");
        const w8_45 = hour8?.weekdayMinutes.find((m) => m.destDepTime === "8:45");

        expect(w8_15?.isNextBus).toBe(false);
        expect(w8_35?.isNextBus).toBe(true);
        expect(w8_45?.isNextBus).toBe(false);
    });

    it("marks no bus as next when all runs have passed (e.g. 23:30)", () => {
        const lateNight = new Date("2026-10-06T23:30:00");
        const rows = computeDualHourlyTimetable({
            route: mockWeekdayRoute,
            weekdayRoute: mockWeekdayRoute,
            vacationRoute: mockVacationRoute,
            tableSearch: "",
            now: lateNight,
            footnoteMap: emptyFootnoteMap,
            currentHourStr: "23",
        });

        for (const row of rows) {
            for (const m of row.weekdayMinutes) {
                expect(m.isNextBus).toBe(false);
            }
            for (const m of row.vacationMinutes) {
                expect(m.isNextBus).toBe(false);
            }
        }
    });
});

describe("DayMode toggle resolution", () => {
    const mockRoutes: BusRoute[] = [
        {
            id: "34(평일)",
            rawNo: "34(평일)",
            routeNo: "34",
            dayType: "평일",
            origin: "장양리",
            destination: "연세대",
            firstBus: "06:00",
            lastBus: "22:00",
            runCount: "28",
            interval: "30",
            timetable: [],
        },
        {
            id: "34(방학,휴일)",
            rawNo: "34(방학,휴일)",
            routeNo: "34",
            dayType: "방학,휴일",
            origin: "장양리",
            destination: "연세대",
            firstBus: "06:30",
            lastBus: "21:30",
            runCount: "23",
            interval: "40",
            timetable: [],
        },
    ];

    it("correctly switches route variants when dayMode changes between WEEKDAY and VACATION", () => {
        let isHoliday = resolveEffectiveIsHoliday("AUTO", false);
        expect(isHoliday).toBe(false);
        expect(selectRouteVariant(mockRoutes, "34", isHoliday)?.id).toBe("34(평일)");

        isHoliday = resolveEffectiveIsHoliday("VACATION", false);
        expect(isHoliday).toBe(true);
        expect(selectRouteVariant(mockRoutes, "34", isHoliday)?.id).toBe("34(방학,휴일)");

        isHoliday = resolveEffectiveIsHoliday("WEEKDAY", true);
        expect(isHoliday).toBe(false);
        expect(selectRouteVariant(mockRoutes, "34", isHoliday)?.id).toBe("34(평일)");

        isHoliday = resolveEffectiveIsHoliday("AUTO", true);
        expect(isHoliday).toBe(true);
        expect(selectRouteVariant(mockRoutes, "34", isHoliday)?.id).toBe("34(방학,휴일)");
    });
});
