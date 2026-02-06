import type { BusSchedule } from '@core/domain';

// ----------------------------------------------------------------------
// Constants & Types
// ----------------------------------------------------------------------

const MINUTES_IN_HOUR = 60;
const MINUTES_IN_DAY = 1440; // 24 * 60

export interface NearestBusInfo {
    /** formatted time string (HH:mm) */
    time: string;
    /** minutes remaining until this bus arrives */
    minutesUntil: number;
    /** destination of the bus */
    destination: string;
}

// ----------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------

/**
 * Get the current hour as a zero-padded string (e.g., "09", "14").
 * @param date - Optional date object (defaults to now)
 */
export function getCurrentHour(date: Date = new Date()): string {
    return String(date.getHours()).padStart(2, '0');
}

/**
 * Determine if the current day is a 'weekday' or 'weekend'.
 * Note: Does not currently account for public holidays.
 * @param date - Optional date object (defaults to now)
 */
export function getCurrentDayType(date: Date = new Date()): 'weekday' | 'weekend' {
    const day = date.getDay(); // 0 is Sunday, 6 is Saturday
    return day === 0 || day === 6 ? 'weekend' : 'weekday';
}

/**
 * Format hour and minute strings into a display format (HH:mm).
 */
export function formatTime(hour: string, minute: string): string {
    return `${hour}:${minute.padStart(2, '0')}`;
}

/**
 * Get the total minutes passed since midnight for the current time.
 * @param date - Optional date object (defaults to now)
 */
export function getCurrentMinutes(date: Date = new Date()): number {
    return date.getHours() * MINUTES_IN_HOUR + date.getMinutes();
}

/**
 * Convert a time string (HH:mm or HH) to total minutes since midnight.
 * @param timeStr - e.g., "14:30" or "14"
 */
export function timeToMinutes(timeStr: string): number {
    const colonIndex = timeStr.indexOf(':');

    // If format is just "HH"
    if (colonIndex === -1) {
        return parseInt(timeStr, 10) * MINUTES_IN_HOUR;
    }

    // If format is "HH:mm"
    const hours = parseInt(timeStr.substring(0, colonIndex), 10);
    const minutes = parseInt(timeStr.substring(colonIndex + 1), 10);

    return (hours * MINUTES_IN_HOUR) + minutes;
}

/**
 * Find the nearest upcoming bus time from the provided schedule data.
 * This function handles wrapping around midnight (finding the first bus of tomorrow if none are left today).
 * * @param busData - The full bus schedule object
 * @returns The nearest bus info or null if no schedule is available
 */
export function getNearestBusTime(busData: BusSchedule): NearestBusInfo | null {
    // Priority: General Schedule -> Day-specific Schedule (Weekday/Weekend)
    const schedule = busData.schedule?.general || busData.schedule?.[getCurrentDayType()];

    if (!schedule) return null;

    const currentTotalMinutes = getCurrentMinutes();

    let minDifference = Infinity;
    let nearestBus: NearestBusInfo | null = null;

    // Iterate through hours (Keys are "06", "07", etc.)
    for (const [hourStr, hourlySchedule] of Object.entries(schedule)) {
        const hourNum = parseInt(hourStr, 10);
        const baseHourMinutes = hourNum * MINUTES_IN_HOUR;

        // Iterate through destinations
        for (const [destination, busTimes] of Object.entries(hourlySchedule)) {
            // Iterate through specific bus times
            for (const { minute } of busTimes) {
                const busTotalMinutes = baseHourMinutes + parseInt(minute, 10);

                // Calculate time difference
                // If the bus time is earlier than now, we assume it's for the next day (wrap around)
                // e.g. Now: 23:50, Bus: 06:00 -> difference is (06:00 + 24h) - 23:50
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
