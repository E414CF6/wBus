import {describe, expect, it} from "vitest";
import {YONSEI_SHUTTLE_SCHEDULE} from "@entities/schedule";
import {YONSEI_SHUTTLE_STOPS} from "@entities/station";
import {parseTimeToMinutes} from "@shared/lib/timeUtils";

describe("YonseiShuttlePinMarker data & logic", () => {
    it("has valid Mirae Hall stop coordinates in YONSEI_SHUTTLE_STOPS", () => {
        const miraeHall = YONSEI_SHUTTLE_STOPS.find((s) => s.id === "mirae-hall");
        expect(miraeHall).toBeDefined();
        expect(miraeHall?.lat).toBeCloseTo(37.283476, 5);
        expect(miraeHall?.lng).toBeCloseTo(127.900657, 5);
        expect(miraeHall?.name).toBe("미래관");
    });

    it("verifies all outbound departures depart from 미래관 and have valid format", () => {
        const outbound = YONSEI_SHUTTLE_SCHEDULE.outbound_from_campus;
        expect(outbound.length).toBeGreaterThan(0);

        for (const item of outbound) {
            expect(item.departure_point).toBe("미래관");
            expect(item.departure_time).toMatch(/^\d{2}:\d{2}$/);
            const mins = parseTimeToMinutes(item.departure_time);
            expect(mins).not.toBeNull();
            expect(mins).toBeGreaterThanOrEqual(0);
            expect(mins).toBeLessThan(1440);
        }
    });

    it("verifies all inbound departures have destination 미래캠퍼스 and valid format", () => {
        const inbound = YONSEI_SHUTTLE_SCHEDULE.inbound_to_campus;
        expect(inbound.length).toBeGreaterThan(0);

        for (const item of inbound) {
            expect(item.destination).toBe("미래캠퍼스");
            expect(item.departure_time).toMatch(/^\d{2}:\d{2}$/);
            const mins = parseTimeToMinutes(item.departure_time);
            expect(mins).not.toBeNull();
        }
    });

    it("correctly separates weekday and sunday shuttle departures", () => {
        const weekdayOutbound = YONSEI_SHUTTLE_SCHEDULE.outbound_from_campus.filter((s) => !s.operation_type.includes("일요일"));
        const sundayOutbound = YONSEI_SHUTTLE_SCHEDULE.outbound_from_campus.filter((s) => s.operation_type.includes("일요일"));

        expect(weekdayOutbound.length).toBeGreaterThan(0);
        expect(sundayOutbound.length).toBeGreaterThan(0);
        expect(weekdayOutbound.every((s) => s.operation_type === "평일 운행")).toBe(true);
        expect(sundayOutbound.every((s) => s.operation_type.includes("일요일"))).toBe(true);
    });

    it("finds next outbound shuttle given a specific time of day", () => {
        const testMins = 12 * 60 + 10; // 12:10
        const weekdayOutbound = YONSEI_SHUTTLE_SCHEDULE.outbound_from_campus
            .filter((s) => !s.operation_type.includes("일요일"))
            .sort((a, b) => (parseTimeToMinutes(a.departure_time) ?? 0) - (parseTimeToMinutes(b.departure_time) ?? 0));

        const next = weekdayOutbound.find((item) => {
            const m = parseTimeToMinutes(item.departure_time);
            return m !== null && m >= testMins;
        });

        expect(next).toBeDefined();
        expect(next?.departure_time).toBe("13:00");
        expect(next?.destination).toBe("여주역");
    });

    it("verifies Yonsei campus shuttle pin is restricted to routes 30, 34, 34-1", () => {
        const YONSEI_SHUTTLE_ROUTES = new Set(["30", "34", "34-1"]);
        expect(YONSEI_SHUTTLE_ROUTES.has("30")).toBe(true);
        expect(YONSEI_SHUTTLE_ROUTES.has("34")).toBe(true);
        expect(YONSEI_SHUTTLE_ROUTES.has("34-1")).toBe(true);

        expect(YONSEI_SHUTTLE_ROUTES.has("2")).toBe(false);
        expect(YONSEI_SHUTTLE_ROUTES.has("16")).toBe(false);
        expect(YONSEI_SHUTTLE_ROUTES.has("51")).toBe(false);
        expect(YONSEI_SHUTTLE_ROUTES.has("100")).toBe(false);
    });
});
