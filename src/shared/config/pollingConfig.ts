import {API_CONFIG} from "@shared/config/env";

type PollingIntervalListener = (intervalMs: number) => void;

let globalPollingIntervalMs: number = API_CONFIG.LIVE.POLLING_INTERVAL_MS;
const listeners = new Set<PollingIntervalListener>();

/**
 * Returns the current global live-tracking polling interval in milliseconds.
 */
export function getGlobalPollingIntervalMs(): number {
    return globalPollingIntervalMs;
}

/**
 * Updates the global live-tracking polling interval and notifies subscribers.
 */
export function setGlobalPollingIntervalMs(intervalMs: number): void {
    if (!Number.isFinite(intervalMs) || intervalMs < 1000) return;
    if (globalPollingIntervalMs === intervalMs) return;
    globalPollingIntervalMs = intervalMs;
    for (const listener of listeners) {
        listener(intervalMs);
    }
}

/**
 * Subscribes to global live-tracking polling interval changes.
 */
export function subscribeGlobalPollingInterval(listener: PollingIntervalListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
