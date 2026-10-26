import type {BusRoute} from "../types";
import type {DayMode} from "@shared/types/navigation";
import {isWeekend} from "@shared/lib/timeUtils";

/**
 * Resolves the active timetable route variant based on DayMode and weekend/holiday status.
 *
 * - When dayMode === "WEEKDAY": Prioritizes "평일" or "매일"
 * - When dayMode === "VACATION": Prioritizes "휴일", "방학", "토요일", "공휴일", or "매일"
 * - When dayMode === "AUTO": Evaluates weekend/holiday status
 */
export function resolveActiveScheduleVariant(
    variants: BusRoute[],
    selectedVariantId?: string | null,
    dayMode: DayMode = "AUTO",
    isTodayWeekendOrHoliday?: boolean
): BusRoute | null {
    if (!variants || variants.length === 0) return null;
    if (selectedVariantId) {
        const found = variants.find((r) => r.id === selectedVariantId);
        if (found) return found;
    }
    const isHol =
        dayMode === "WEEKDAY"
            ? false
            : dayMode === "VACATION"
            ? true
            : (isTodayWeekendOrHoliday ?? isWeekend());
    if (isHol) {
        const hol = variants.find(
            (r) =>
                r.dayType.includes("휴일") ||
                r.dayType.includes("방학") ||
                r.dayType.includes("토요일") ||
                r.dayType.includes("공휴일") ||
                r.dayType === "매일"
        );
        if (hol) return hol;
    } else {
        const wk = variants.find((r) => r.dayType === "평일" || r.dayType === "매일");
        if (wk) return wk;
    }
    return variants[0];
}
