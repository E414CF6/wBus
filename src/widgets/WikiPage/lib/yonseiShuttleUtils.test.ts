import {describe, expect, it} from "vitest";
import type {ShuttleBusScheduleData} from "@entities/schedule";
import {filterShuttleSchedule, getNextShuttleDepartures, resolveEffectiveShuttleDayType,} from "./yonseiShuttleUtils";

const TEST_SHUTTLE_SCHEDULE: ShuttleBusScheduleData = {
    title: "무료 셔틀버스 시간표",
    stop_locations: [
        {name: "원주고속터미널", location_description: "그랜드 치과 병원 앞"},
        {name: "원주역", location_description: "원주역 시내버스정류장"},
    ],
    inbound_to_campus: [
        {
            operation_type: "평일 운행",
            departure_point: "원주고속터미널 건너편 그랜드치과",
            departure_time: "08:20",
            via: [{name: "원주역", time: "08:30", is_fixed_time: true}],
            destination: "미래캠퍼스",
            note: null,
        },
        {
            operation_type: "평일 운행",
            departure_point: "여주역",
            departure_time: "14:20",
            via: [],
            destination: "미래캠퍼스",
            note: "직행 버스",
        },
        {
            operation_type: "일요일 특별편",
            departure_point: "원주고속터미널 건너편 그랜드치과",
            departure_time: "19:40",
            via: [{name: "원주역", time: null, is_fixed_time: false}],
            destination: "미래캠퍼스",
            note: "일요일 운행",
        },
    ],
    outbound_from_campus: [
        {
            operation_type: "평일 운행",
            departure_point: "미래관",
            departure_time: "14:00",
            destination: "원주고속터미널",
            via: [{name: "원주역", time: null}],
            note: null,
        },
        {
            operation_type: "평일 운행",
            departure_point: "미래관",
            departure_time: "16:10",
            destination: "만종역",
            via: [{name: "원주역", time: null}],
            note: null,
        },
        {
            operation_type: "평일 운행",
            departure_point: "미래관",
            departure_time: "16:10",
            destination: "원주세브란스 장례식장",
            via: [{name: "시청사거리", time: null}],
            note: "원주역 미정차",
        },
        {
            operation_type: "일요일 운행",
            departure_point: "미래관",
            departure_time: "18:45",
            destination: "원주고속터미널",
            via: [{name: "원주역", time: null}],
            note: "일요일 운행",
        },
        {
            operation_type: "일요일 운행",
            departure_point: "미래관",
            departure_time: "20:05",
            destination: "원주고속터미널",
            via: [{name: "원주역", time: null}],
            note: "일요일 운행",
        },
    ],
    guidelines: ["출발 5분 전까지 탑승 완료 바랍니다."],
};

describe("yonseiShuttleUtils", () => {
    describe("resolveEffectiveShuttleDayType", () => {
        it("detects Saturday as non-operating in AUTO mode", () => {
            // 2026-11-14 is Saturday
            const sat = new Date(2026, 10, 14, 10, 0);
            const result = resolveEffectiveShuttleDayType("AUTO", sat);
            expect(result.isSaturday).toBe(true);
            expect(result.isSunday).toBe(false);
        });

        it("allows weekday override on Saturday", () => {
            const sat = new Date(2026, 10, 14, 10, 0);
            const result = resolveEffectiveShuttleDayType("WEEKDAY", sat);
            expect(result.isSaturday).toBe(false);
            expect(result.isSunday).toBe(false);
            expect(result.label).toBe("평일 정규운행");
        });

        it("detects Sunday special schedule in AUTO mode", () => {
            // 2026-11-15 is Sunday
            const sun = new Date(2026, 10, 15, 10, 0);
            const result = resolveEffectiveShuttleDayType("AUTO", sun);
            expect(result.isSaturday).toBe(false);
            expect(result.isSunday).toBe(true);
            expect(result.label).toBe("일요일 특별운행");
        });
    });

    describe("getNextShuttleDepartures", () => {
        it("returns empty lists and null next departures on Saturday in AUTO mode", () => {
            const sat = new Date(2026, 10, 14, 10, 0);
            const res = getNextShuttleDepartures(TEST_SHUTTLE_SCHEDULE, "AUTO", sat);
            expect(res.dayType.isSaturday).toBe(true);
            expect(res.nextInbound).toBeNull();
            expect(res.nextOutbound).toBeNull();
            expect(res.applicableInbound).toHaveLength(0);
            expect(res.applicableOutbound).toHaveLength(0);
        });

        it("finds the next weekday inbound and outbound shuttles", () => {
            // 2026-11-13 is Friday 14:00
            const fri = new Date(2026, 10, 13, 14, 0);
            const res = getNextShuttleDepartures(TEST_SHUTTLE_SCHEDULE, "AUTO", fri);
            expect(res.dayType.isSaturday).toBe(false);
            expect(res.dayType.isSunday).toBe(false);
            expect(res.nextInbound?.item.departure_time).toBe("14:20");
            expect(res.nextInbound?.waitMins).toBe(20);
            expect(res.nextOutbound?.item.departure_time).toBe("14:00");
            expect(res.nextOutbound?.waitMins).toBe(0);
        });

        it("finds Sunday special departures on Sunday", () => {
            // 2026-11-15 is Sunday 18:10
            const sun = new Date(2026, 10, 15, 18, 10);
            const res = getNextShuttleDepartures(TEST_SHUTTLE_SCHEDULE, "AUTO", sun);
            expect(res.dayType.isSunday).toBe(true);
            expect(res.nextInbound?.item.departure_time).toBe("19:40");
            expect(res.nextOutbound?.item.departure_time).toBe("18:45");
        });
    });

    describe("filterShuttleSchedule", () => {
        it("filters by dayFilter (WEEKDAY vs SUNDAY)", () => {
            const sundayItems = filterShuttleSchedule(
                TEST_SHUTTLE_SCHEDULE.outbound_from_campus,
                "SUNDAY",
                ""
            );
            expect(sundayItems.length).toBe(2);
            expect(sundayItems.every((i) => i.operation_type.includes("일요일"))).toBe(true);

            const weekdayItems = filterShuttleSchedule(
                TEST_SHUTTLE_SCHEDULE.outbound_from_campus,
                "WEEKDAY",
                ""
            );
            expect(weekdayItems.every((i) => !i.operation_type.includes("일요일"))).toBe(true);
        });

        it("supports Korean Choseong search across departure, destination, and via stops", () => {
            // "ㅇㅈㅇ" -> 여주역 / 원주역
            const matched = filterShuttleSchedule(
                TEST_SHUTTLE_SCHEDULE.inbound_to_campus,
                "ALL",
                "ㅇㅈㅇ"
            );
            expect(matched.length).toBeGreaterThan(0);
            expect(
                matched.some(
                    (i) =>
                        i.departure_point.includes("여주역") ||
                        i.departure_point.includes("원주역") ||
                        i.via.some((v) => v.name.includes("원주역"))
                )
            ).toBe(true);
        });

        it("filters by departure time string", () => {
            const matched = filterShuttleSchedule(
                TEST_SHUTTLE_SCHEDULE.outbound_from_campus,
                "ALL",
                "16:10"
            );
            expect(matched.length).toBe(2);
            expect(matched.every((i) => i.departure_time === "16:10")).toBe(true);
        });
    });
});
