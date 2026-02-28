import type { BusSchedule, RowItem } from "@entities/route/types";

// ----------------------------------------------------------------------
// Constants & Types
// ----------------------------------------------------------------------

const MINUTES_IN_HOUR = 60;
const MINUTES_IN_DAY = 1440;

export interface NearestBusInfo {
    time: string;
    minutesUntil: number;
    destination: string;
}

export interface NextBusInfo {
    hour: string;
    minute: string;
    timeUntil: { minutes: number; seconds: number } | null;
}

// ----------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------

export function getCurrentHour(date: Date = new Date()): string {
    return String(date.getHours()).padStart(2, '0');
}

export function getCurrentDayType(date: Date = new Date()): 'weekday' | 'weekend' {
    const day = date.getDay();
    return day === 0 || day === 6 ? 'weekend' : 'weekday';
}

export function formatTime(hour: string, minute: string): string {
    return `${hour}:${minute.padStart(2, '0')}`;
}

export function getCurrentMinutes(date: Date = new Date()): number {
    return date.getHours() * MINUTES_IN_HOUR + date.getMinutes();
}

export function timeToMinutes(timeStr: string): number {
    const colonIndex = timeStr.indexOf(':');
    if (colonIndex === -1) {
        return parseInt(timeStr, 10) * MINUTES_IN_HOUR;
    }
    const hours = parseInt(timeStr.substring(0, colonIndex), 10);
    const minutes = parseInt(timeStr.substring(colonIndex + 1), 10);
    return (hours * MINUTES_IN_HOUR) + minutes;
}

export function getNearestBusTime(busData: BusSchedule): NearestBusInfo | null {
    const schedule = busData.schedule?.general || busData.schedule?.[getCurrentDayType()];
    if (!schedule) return null;

    const currentTotalMinutes = getCurrentMinutes();
    let minDifference = Infinity;
    let nearestBus: NearestBusInfo | null = null;

    for (const [hourStr, hourlySchedule] of Object.entries(schedule)) {
        const hourNum = parseInt(hourStr, 10);
        const baseHourMinutes = hourNum * MINUTES_IN_HOUR;

        for (const [destination, busTimes] of Object.entries(hourlySchedule)) {
            for (const {minute} of busTimes) {
                const busTotalMinutes = baseHourMinutes + parseInt(minute, 10);
                const difference = busTotalMinutes >= currentTotalMinutes
                    ? busTotalMinutes - currentTotalMinutes
                    : MINUTES_IN_DAY + busTotalMinutes - currentTotalMinutes;

                if (difference < minDifference) {
                    minDifference = difference;
                    nearestBus = {
                        time: `${hourStr}:${minute}`,
                        minutesUntil: difference,
                        destination
                    };
                }
            }
        }
    }

    return nearestBus;
}

export function findNextBus(
    schedule: Record<string, Record<string, RowItem[]>>,
    hours: string[],
    direction: string,
    now: Date
): NextBusInfo | null {
    const currentHour = now.getHours().toString().padStart(2, "0");
    const currentMinute = now.getMinutes();

    for (const hour of hours) {
        const buses = schedule[hour]?.[direction];
        if (!buses?.length) continue;

        const hourNum = parseInt(hour, 10);
        const currentHourNum = parseInt(currentHour, 10);

        if (hourNum < currentHourNum) continue;

        for (const bus of buses) {
            const busMinute = parseInt(bus.minute, 10);
            if (hourNum === currentHourNum && busMinute < currentMinute) continue;

            const busTime = new Date(now);
            busTime.setHours(hourNum, busMinute, 0, 0);

            const diff = busTime.getTime() - now.getTime();
            if (diff < 0) continue;

            return {
                hour,
                minute: bus.minute,
                timeUntil: {
                    minutes: Math.floor(diff / 60000),
                    seconds: Math.floor((diff % 60000) / 1000),
                },
            };
        }
    }

    return null;
}
