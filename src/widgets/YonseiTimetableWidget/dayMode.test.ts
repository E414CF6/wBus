import {describe, expect, it} from "vitest";
import {selectRouteVariant} from "@entities/schedule/lib/departureUtils";
import type {BusRoute} from "@entities/schedule";
import type {DayMode} from "@shared/types/navigation";

function resolveEffectiveIsHoliday(dayMode: DayMode, isTodayWeekendOrHoliday: boolean): boolean {
    if (dayMode === "WEEKDAY") return false;
    if (dayMode === "VACATION") return true;
    return isTodayWeekendOrHoliday;
}

describe("DayMode toggle resolution", () => {
    const mockRoutes: BusRoute[] = [{
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
    }, {
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
    },];

    it("correctly switches route variants when dayMode changes between WEEKDAY and VACATION", () => {
        // AUTO on a weekday
        let isHoliday = resolveEffectiveIsHoliday("AUTO", false);
        expect(isHoliday).toBe(false);
        expect(selectRouteVariant(mockRoutes, "34", isHoliday)?.id).toBe("34(평일)");

        // Switch to VACATION
        isHoliday = resolveEffectiveIsHoliday("VACATION", false);
        expect(isHoliday).toBe(true);
        expect(selectRouteVariant(mockRoutes, "34", isHoliday)?.id).toBe("34(방학,휴일)");

        // Switch to WEEKDAY
        isHoliday = resolveEffectiveIsHoliday("WEEKDAY", true);
        expect(isHoliday).toBe(false);
        expect(selectRouteVariant(mockRoutes, "34", isHoliday)?.id).toBe("34(평일)");

        // AUTO on a weekend
        isHoliday = resolveEffectiveIsHoliday("AUTO", true);
        expect(isHoliday).toBe(true);
        expect(selectRouteVariant(mockRoutes, "34", isHoliday)?.id).toBe("34(방학,휴일)");
    });
});
