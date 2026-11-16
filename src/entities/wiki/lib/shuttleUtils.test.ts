import {describe, expect, it} from "vitest";
import type {ShuttleBusScheduleData} from "@entities/schedule";
import {
    filterShuttleSchedule,
    getNextShuttleDepartures,
    resolveEffectiveShuttleDayType,
} from "./shuttleUtils";

const SAMPLE_SHUTTLE: ShuttleBusScheduleData = {
    title: "테스트 무료 셔틀",
    stop_locations: [
        {name: "정문 승강장", location_description: "정문 좌측 정류장"},
    ],
    inbound_to_campus: [
        {
            operation_type: "평일 운행",
            departure_point: "원주역",
            departure_time: "08:15",
            via: [{name: "터미널", time: "08:30", is_fixed_time: true}],
            destination: "정문",
            note: null,
        },
        {
            operation_type: "일요일 특별편",
            departure_point: "터미널",
            departure_time: "18:00",
            via: [],
            destination: "정문",
            note: "일요일만 운행",
        },
    ],
    outbound_from_campus: [
        {
            operation_type: "평일 운행",
            departure_point: "본관",
            departure_time: "17:20",
            destination: "원주역",
            via: [],
            note: null,
        },
    ],
    guidelines: ["탑승 5분 전 대기"],
};

describe("shuttleUtils", () => {
    it("resolves effective day type for weekday, vacation, Saturday, Sunday", () => {
        expect(resolveEffectiveShuttleDayType("WEEKDAY").isSunday).toBe(false);
        expect(resolveEffectiveShuttleDayType("VACATION").isVacation).toBe(true);

        // 2026-11-14 is Saturday, 2026-11-15 is Sunday
        expect(
            resolveEffectiveShuttleDayType("AUTO", new Date(2026, 10, 14, 10, 0)).isSaturday,
        ).toBe(true);
        expect(
            resolveEffectiveShuttleDayType("AUTO", new Date(2026, 10, 15, 10, 0)).isSunday,
        ).toBe(true);
    });

    it("computes next inbound and outbound departures and filters schedule", () => {
        // Monday 2026-11-16 08:00
        const mondayMorning = new Date(2026, 10, 16, 8, 0);
        const result = getNextShuttleDepartures(SAMPLE_SHUTTLE, "AUTO", mondayMorning);

        expect(result.nextInbound?.item.departure_time).toBe("08:15");
        expect(result.nextInbound?.waitMins).toBe(15);
        expect(result.nextOutbound?.item.departure_time).toBe("17:20");

        expect(filterShuttleSchedule(SAMPLE_SHUTTLE.inbound_to_campus, "SUNDAY", "")).toHaveLength(1);
        expect(
            filterShuttleSchedule(SAMPLE_SHUTTLE.inbound_to_campus, "ALL", "ㅇㅈㅇ"),
        ).toHaveLength(1);
    });
});
