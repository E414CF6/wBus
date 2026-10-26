import {describe, expect, it} from "vitest";
import {resolveActiveScheduleVariant} from "./scheduleVariant";
import type {BusRoute} from "../types";

describe("resolveActiveScheduleVariant", () => {
    const createMockRoute = (overrides: Partial<BusRoute> = {}): BusRoute => ({
        id: "R1",
        rawNo: "34",
        routeNo: "34",
        dayType: "평일",
        origin: "회촌",
        destination: "태장동",
        firstBus: "06:00",
        lastBus: "22:00",
        runCount: "10회",
        interval: "60분",
        timetable: [],
        ...overrides,
    });

    const mockVariants: BusRoute[] = [
        createMockRoute({
            id: "R34_WEEKDAY",
            routeNo: "34",
            dayType: "평일",
        }),
        createMockRoute({
            id: "R34_HOLIDAY",
            routeNo: "34",
            dayType: "토·공휴일",
        }),
    ];

    it("returns null when variants list is empty", () => {
        expect(resolveActiveScheduleVariant([])).toBeNull();
    });

    it("prioritizes manually selected variant ID when provided", () => {
        const result = resolveActiveScheduleVariant(mockVariants, "R34_HOLIDAY", "WEEKDAY");
        expect(result?.id).toBe("R34_HOLIDAY");
    });

    it("selects weekday variant when dayMode is WEEKDAY", () => {
        const result = resolveActiveScheduleVariant(mockVariants, null, "WEEKDAY", true);
        expect(result?.id).toBe("R34_WEEKDAY");
        expect(result?.dayType).toBe("평일");
    });

    it("selects holiday variant when dayMode is VACATION", () => {
        const result = resolveActiveScheduleVariant(mockVariants, null, "VACATION", false);
        expect(result?.id).toBe("R34_HOLIDAY");
        expect(result?.dayType).toBe("토·공휴일");
    });

    it("selects holiday variant when dayMode is AUTO and isTodayWeekendOrHoliday is true", () => {
        const result = resolveActiveScheduleVariant(mockVariants, null, "AUTO", true);
        expect(result?.id).toBe("R34_HOLIDAY");
    });

    it("selects weekday variant when dayMode is AUTO and isTodayWeekendOrHoliday is false", () => {
        const result = resolveActiveScheduleVariant(mockVariants, null, "AUTO", false);
        expect(result?.id).toBe("R34_WEEKDAY");
    });

    it("matches variants with '매일' if weekday or holiday is not strictly distinguished", () => {
        const dailyVariants: BusRoute[] = [
            createMockRoute({
                id: "R_DAILY",
                routeNo: "100",
                dayType: "매일",
            }),
        ];
        const resWeekday = resolveActiveScheduleVariant(dailyVariants, null, "WEEKDAY");
        expect(resWeekday?.id).toBe("R_DAILY");

        const resHoliday = resolveActiveScheduleVariant(dailyVariants, null, "VACATION");
        expect(resHoliday?.id).toBe("R_DAILY");
    });
});
