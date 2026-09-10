import {LOCALE, UI_TEXT} from "@shared/config/locale";

/**
 * Parses "HH:mm" or "H:mm" to total minutes since 00:00.
 * Returns null if invalid or format is "-".
 */
export function parseTimeToMinutes(timeStr: string | undefined | null): number | null {
    if (!timeStr || timeStr === "-" || timeStr.trim() === "") return null;
    const parts = timeStr.trim().split(":");
    if (parts.length !== 2) return null;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return hours * 60 + minutes;
}

/**
 * Formats total minutes to "HH:mm".
 */
export function formatMinutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Checks if a given date is weekend (Saturday or Sunday).
 */
export function isWeekend(date: Date = new Date()): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
}

/**
 * Calculates remaining 24-hour cooldown time and formatted string.
 */
export function formatCooldownRemaining(updatedAt: string | null | undefined, cooldownHours = 24): {
    isReady: boolean;
    remainingMs: number;
    text: string;
    nextAvailableDate: Date | null;
} {
    if (!updatedAt) {
        return {
            isReady: true,
            remainingMs: 0,
            text: UI_TEXT.TIME.REFRESH_AVAILABLE_NOW,
            nextAvailableDate: null,
        };
    }

    const lastMs = new Date(updatedAt).getTime();
    if (isNaN(lastMs)) {
        return {
            isReady: true,
            remainingMs: 0,
            text: UI_TEXT.TIME.REFRESH_AVAILABLE_NOW,
            nextAvailableDate: null,
        };
    }

    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    const nextMs = lastMs + cooldownMs;
    const nowMs = Date.now();
    const diffMs = nextMs - nowMs;

    if (diffMs <= 0) {
        return {
            isReady: true,
            remainingMs: 0,
            text: UI_TEXT.TIME.REFRESH_AVAILABLE_NOW,
            nextAvailableDate: new Date(nextMs),
        };
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let text: string;
    if (hours > 0) {
        text = UI_TEXT.TIME.REFRESH_AVAILABLE_HOURS(hours, mins);
    } else {
        text = UI_TEXT.TIME.REFRESH_AVAILABLE_MINS(mins);
    }

    return {
        isReady: false,
        remainingMs: diffMs,
        text,
        nextAvailableDate: new Date(nextMs),
    };
}

/**
 * Formats ISO timestamp to human-friendly relative time.
 */
export function formatRelativeTime(isoString: string): string {
    const timestamp = new Date(isoString).getTime();
    if (isNaN(timestamp)) return "";

    const diffSec = Math.floor((Date.now() - timestamp) / 1000);

    if (diffSec < 60) {
        return UI_TEXT.TIME.JUST_NOW;
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
        return UI_TEXT.TIME.MINUTES_AGO(diffMin);
    }
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) {
        return UI_TEXT.TIME.HOURS_AGO(diffHours);
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
        return UI_TEXT.TIME.DAYS_AGO(diffDays);
    }
    return new Date(timestamp).toLocaleDateString(LOCALE, {
        month: "numeric",
        day: "numeric",
    });
}

/**
 * Formats remaining time until target timestamp string.
 */
export function formatRemainingTime(targetDateStr: string | null): string {
    if (!targetDateStr) return "";
    const targetMs = new Date(targetDateStr).getTime();
    if (isNaN(targetMs)) return "";

    const diffMs = targetMs - Date.now();
    if (diffMs <= 0) return UI_TEXT.TIME.REFRESH_AVAILABLE_NOW;

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
        return UI_TEXT.TIME.REFRESH_AVAILABLE_DAYS(days, hours);
    }
    if (hours > 0) {
        return UI_TEXT.TIME.REFRESH_AVAILABLE_HOURS(hours, mins);
    }
    return UI_TEXT.TIME.REFRESH_AVAILABLE_MINS(mins);
}
