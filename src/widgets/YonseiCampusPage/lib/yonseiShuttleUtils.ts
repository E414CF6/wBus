import type {
    ShuttleBusScheduleData,
    ShuttleInboundItem,
    ShuttleOutboundItem,
} from "@entities/schedule";
import {isSaturday, parseTimeToMinutes} from "@shared/lib/timeUtils";
import type {DayMode} from "@shared/types/navigation";
import {matchesHangul} from "@shared/utils/hangul";

export type CampusDirectionMode = "OUTBOUND" | "INBOUND";
export type ShuttleDayFilter = "ALL" | "WEEKDAY" | "SUNDAY";

export interface ShuttleEffectiveDayType {
    isSaturday: boolean;
    isSunday: boolean;
    isVacation: boolean;
    label: string;
}

export interface NextShuttleResult<T> {
    item: T;
    waitMins: number;
}

/**
 * Resolves today's effective shuttle operating mode based on DayMode and current Date.
 * - Saturday: Shuttles do not operate (unless overridden to WEEKDAY).
 * - Sunday / VACATION: Sunday special schedule applies.
 * - Weekday: Regular weekday schedule applies.
 */
export function resolveEffectiveShuttleDayType(
    dayMode: DayMode,
    now: Date = new Date()
): ShuttleEffectiveDayType {
    if (dayMode === "WEEKDAY") {
        return {
            isSaturday: false,
            isSunday: false,
            isVacation: false,
            label: "평일 정규운행",
        };
    }

    if (dayMode === "VACATION") {
        return {
            isSaturday: false,
            isSunday: true,
            isVacation: true,
            label: "방학·휴일(일요일 기준)",
        };
    }

    if (isSaturday(now)) {
        return {
            isSaturday: true,
            isSunday: false,
            isVacation: false,
            label: "토요일 미운행",
        };
    }

    if (now.getDay() === 0) {
        return {
            isSaturday: false,
            isSunday: true,
            isVacation: false,
            label: "일요일 특별운행",
        };
    }

    return {
        isSaturday: false,
        isSunday: false,
        isVacation: false,
        label: "평일 정규운행",
    };
}

function sortByDepartureTime<T extends { departure_time: string }>(items: T[]): T[] {
    return items
        .slice()
        .sort(
            (a, b) =>
                (parseTimeToMinutes(a.departure_time) ?? 0) -
                (parseTimeToMinutes(b.departure_time) ?? 0)
        );
}

function filterApplicableShuttleItems<T extends { operation_type: string }>(
    items: T[],
    isSunday: boolean
): T[] {
    return items.filter((item) =>
        isSunday
            ? item.operation_type.includes("일요일")
            : !item.operation_type.includes("일요일")
    );
}

function findNextDeparture<T extends { departure_time: string }>(
    sortedItems: T[],
    currentMins: number
): NextShuttleResult<T> | null {
    for (const item of sortedItems) {
        const mins = parseTimeToMinutes(item.departure_time);
        if (mins !== null && mins >= currentMins) {
            return {
                item,
                waitMins: mins - currentMins,
            };
        }
    }
    return null;
}

/**
 * Computes the next upcoming inbound and outbound shuttle departures for the given DayMode and Date.
 */
export function getNextShuttleDepartures(
    schedule: ShuttleBusScheduleData,
    dayMode: DayMode,
    now: Date = new Date()
): {
    dayType: ShuttleEffectiveDayType;
    nextInbound: NextShuttleResult<ShuttleInboundItem> | null;
    nextOutbound: NextShuttleResult<ShuttleOutboundItem> | null;
    applicableInbound: ShuttleInboundItem[];
    applicableOutbound: ShuttleOutboundItem[];
} {
    const dayType = resolveEffectiveShuttleDayType(dayMode, now);
    if (dayType.isSaturday) {
        return {
            dayType,
            nextInbound: null,
            nextOutbound: null,
            applicableInbound: [],
            applicableOutbound: [],
        };
    }

    const currentMins = now.getHours() * 60 + now.getMinutes();
    const applicableInbound = sortByDepartureTime(
        filterApplicableShuttleItems(schedule.inbound_to_campus, dayType.isSunday)
    );
    const applicableOutbound = sortByDepartureTime(
        filterApplicableShuttleItems(schedule.outbound_from_campus, dayType.isSunday)
    );

    return {
        dayType,
        nextInbound: findNextDeparture(applicableInbound, currentMins),
        nextOutbound: findNextDeparture(applicableOutbound, currentMins),
        applicableInbound,
        applicableOutbound,
    };
}

/**
 * Filters shuttle schedule items by day type and Korean Choseong-aware search query.
 */
export function filterShuttleSchedule<T extends ShuttleInboundItem | ShuttleOutboundItem>(
    items: T[],
    dayFilter: ShuttleDayFilter,
    query: string
): T[] {
    let list = items;

    if (dayFilter === "WEEKDAY") {
        list = list.filter((item) => !item.operation_type.includes("일요일"));
    } else if (dayFilter === "SUNDAY") {
        list = list.filter((item) => item.operation_type.includes("일요일"));
    }

    const trimmed = query.trim();
    if (trimmed) {
        list = list.filter((item) => {
            if (matchesHangul(item.departure_point, trimmed)) return true;
            if (matchesHangul(item.destination, trimmed)) return true;
            if (matchesHangul(item.departure_time, trimmed)) return true;
            if (item.note && matchesHangul(item.note, trimmed)) return true;
            if (item.via.some((v) => matchesHangul(v.name, trimmed) || (v.time ? matchesHangul(v.time, trimmed) : false))) {
                return true;
            }
            return false;
        });
    }

    return sortByDepartureTime(list);
}
