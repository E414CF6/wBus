/**
 * Lightweight, safe mobile haptic feedback utility.
 * Utilizes navigator.vibrate when supported on mobile devices.
 * Respects user preferences (prefers-reduced-motion) and fails silently without throwing.
 */

export type HapticFeedbackType = "light" | "medium" | "heavy" | "selection" | "success" | "warning";

let isHapticEnabled = true;

export function setHapticEnabled(enabled: boolean): void {
    isHapticEnabled = enabled;
}

export function getHapticEnabled(): boolean {
    return isHapticEnabled;
}

const HAPTIC_PATTERNS: Record<HapticFeedbackType, number | number[]> = {
    light: 8,
    medium: 18,
    heavy: 30,
    selection: 6,
    success: [10, 30, 12],
    warning: [20, 40, 20],
};

export function triggerHaptic(type: HapticFeedbackType = "light"): boolean {
    if (!isHapticEnabled) {
        return false;
    }

    if (typeof window === "undefined" || typeof navigator === "undefined") {
        return false;
    }

    try {
        if (!("vibrate" in navigator) || typeof navigator.vibrate !== "function") {
            return false;
        }

        // Check if user prefers reduced motion
        if (
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
            return false;
        }

        const pattern = HAPTIC_PATTERNS[type] ?? 8;
        return navigator.vibrate(pattern);
    } catch {
        // Silently catch security or permission errors
        return false;
    }
}
