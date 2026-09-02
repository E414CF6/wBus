import type {BusItem} from "@entities/bus/types";
import {API_CONFIG} from "@shared/config/env";
import type {CachedData} from "@shared/redis/types";
import {mapWithConcurrencyLimit} from "@shared/utils/concurrency";
import {
    type BusLocationState,
    type BusStreamHandoff,
    type BusStreamReady,
    type BusStreamSnapshot,
    EMPTY_BUS_LIST,
    EMPTY_STATE,
    type Listener,
    SSE_MAX_RUNTIME_MS,
    SSE_RECONNECT_BUFFER_MS,
    SSE_STALE_TIMEOUT_MS,
    STREAM_CONNECT_TIMEOUT_MS,
    STREAM_IMMEDIATE_RECONNECT_DELAY_MS,
    STREAM_RECONNECT_BASE_DELAY_MS,
    STREAM_RECONNECT_MAX_DELAY_MS,
} from "../model/types";

const fetchRouteData = async (url: string): Promise<CachedData<BusItem[]>> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};

function buildStreamUrl(routeIds: string[]): string {
    const query = new URLSearchParams({routeIds: routeIds.join(",")});
    return `/api/bus/stream?${query.toString()}`;
}

function getPositiveNumber(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return null;
    }
    return value;
}

export class BusLocationStore {
    public dataLength = 0;
    private readonly routeIds: string[];
    private readonly routeIdsKey: string;
    private state: BusLocationState;
    private listeners = new Set<Listener>();
    private eventSource: EventSource | null = null;
    private fallbackInterval: ReturnType<typeof setInterval> | null = null;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private proactiveReconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private staleTimeout: ReturnType<typeof setTimeout> | null = null;
    private connectTimeout: ReturnType<typeof setTimeout> | null = null;
    private isConnecting = false;
    private reconnectAttempt = 0;
    private preferredRetryDelayMs = STREAM_RECONNECT_BASE_DELAY_MS;
    private isSuspended = false;
    private routeDataMap = new Map<string, BusItem[]>();

    constructor(routeIds: string[], routeIdsKey: string) {
        this.routeIds = routeIds;
        this.routeIdsKey = routeIdsKey;
        this.state = {
            ...EMPTY_STATE,
            reconnect: () => this.manualReconnect(),
        };
    }

    getSnapshot = () => this.state;

    subscribe = (listener: Listener) => {
        this.listeners.add(listener);
        if (this.listeners.size === 1) {
            this.registerEventListeners();
            this.start();
        }
        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size === 0) {
                this.unregisterEventListeners();
                this.stop();
                busLocationStores.delete(this.routeIdsKey);
            }
        };
    };

    public manualReconnect = () => {
        console.log(`[useBusLocationData] Manual reconnect requested for ${this.routeIdsKey}`);
        this.routeDataMap.clear();
        this.closeStream();
        this.clearFallbackPolling();
        this.clearReconnectTimer();
        this.isConnecting = false;
        this.isSuspended = false;
        this.reconnectAttempt = 0;
        this.startStream();
    };

    private emit() {
        for (const listener of this.listeners) {
            listener();
        }
    }

    private setState(next: BusLocationState) {
        this.state = next;
        this.emit();
    }

    private updateState(partial: Partial<BusLocationState>) {
        this.setState({
            ...this.state,
            ...partial,
            reconnect: this.state.reconnect,
        });
    }

    private applyData(
        nextData: BusItem[],
        options?: {
            degraded?: boolean;
            timestamp?: number;
            targetRouteIds?: string[];
        }
    ) {
        const degraded = options?.degraded ?? false;
        const timestamp = options?.timestamp ?? Date.now();
        const targetRouteIds = options?.targetRouteIds ?? this.routeIds;

        // Group incoming items by routeId
        const incomingByRouteId = new Map<string, BusItem[]>();
        for (const item of nextData) {
            const rid = item.routeid;
            if (rid) {
                const list = incomingByRouteId.get(rid) ?? [];
                list.push(item);
                incomingByRouteId.set(rid, list);
            }
        }

        // For all target routeIds, update routeDataMap (clearing old buses if route now returns empty)
        for (const rid of targetRouteIds) {
            const items = incomingByRouteId.get(rid) ?? [];
            this.routeDataMap.set(rid, items);
        }

        let finalData: BusItem[] = [];
        for (const items of this.routeDataMap.values()) {
            finalData.push(...items);
        }

        // Preserve existing bus markers ONLY if ALL routes in finalData are empty during degraded/error state
        if (
            finalData.length === 0 &&
            (degraded || this.state.isDegraded) &&
            this.state.data.length > 0
        ) {
            finalData = this.state.data;
        }

        this.dataLength = finalData.length;
        this.setState({
            ...this.state,
            data: finalData,
            error:
                finalData.length === 0 ? (degraded ? "ERR:NETWORK" : "ERR:NONE_RUNNING") : null,
            hasFetched: true,
            lastUpdated: timestamp,
            isDegraded: degraded,
            reconnect: this.state.reconnect,
        });
    }

    private clearFallbackPolling() {
        if (this.fallbackInterval) {
            clearInterval(this.fallbackInterval);
            this.fallbackInterval = null;
        }
    }

    private clearReconnectTimer() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }

    private clearProactiveReconnectTimer() {
        if (this.proactiveReconnectTimeout) {
            clearTimeout(this.proactiveReconnectTimeout);
            this.proactiveReconnectTimeout = null;
        }
    }

    private clearStaleTimer() {
        if (this.staleTimeout) {
            clearTimeout(this.staleTimeout);
            this.staleTimeout = null;
        }
    }

    private clearConnectTimer() {
        if (this.connectTimeout) {
            clearTimeout(this.connectTimeout);
            this.connectTimeout = null;
        }
    }

    private closeStream() {
        this.clearProactiveReconnectTimer();
        this.clearStaleTimer();
        this.clearConnectTimer();
        if (!this.eventSource) return;
        this.eventSource.close();
        this.eventSource = null;
    }

    private async fetchFallback() {
        try {
            const settled = await mapWithConcurrencyLimit(
                this.routeIds,
                (routeId) => fetchRouteData(`/api/bus/${routeId}`),
                {
                    concurrency: 3,
                    staggerMs: 50,
                }
            );

            const fulfilledResults: BusItem[] = [];
            const fulfilledRouteIds: string[] = [];
            let hasFailures = false;

            settled.forEach((result, idx) => {
                const routeId = this.routeIds[idx];
                if (result.status === "fulfilled") {
                    fulfilledRouteIds.push(routeId);
                    const items = result.value.data;
                    if (Array.isArray(items)) {
                        fulfilledResults.push(...items);
                    }
                } else {
                    hasFailures = true;
                }
            });

            if (fulfilledRouteIds.length > 0) {
                this.applyData(fulfilledResults, {
                    degraded: hasFailures,
                    targetRouteIds: fulfilledRouteIds,
                });
            } else if (this.routeIds.length > 0) {
                throw new Error("All fallback route requests failed");
            }
        } catch (err) {
            console.error("[useBusLocationData] Polling fallback failed", err);
            if (this.state.data.length === 0 && !this.eventSource) {
                this.setState({
                    ...this.state,
                    data: EMPTY_BUS_LIST,
                    error: "ERR:NETWORK",
                    hasFetched: true,
                    isDegraded: true,
                });
            } else {
                this.setState({
                    ...this.state,
                    isDegraded: true,
                    error: "ERR:NETWORK",
                });
            }
        }
    }

    private startFallbackPolling() {
        if (this.fallbackInterval) return;
        void this.fetchFallback();
        this.fallbackInterval = setInterval(() => {
            void this.fetchFallback();
        }, API_CONFIG.LIVE.POLLING_INTERVAL_MS);
        this.updateState({connectionStatus: "fallback"});
    }

    private scheduleReconnect(delayOverrideMs?: number) {
        if (this.reconnectTimeout) return;

        const expBackoffMs = Math.min(
            STREAM_RECONNECT_MAX_DELAY_MS,
            this.preferredRetryDelayMs * 2 ** this.reconnectAttempt
        );
        const delayMs = Math.max(
            STREAM_IMMEDIATE_RECONNECT_DELAY_MS,
            delayOverrideMs ?? expBackoffMs
        );

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.reconnectAttempt = Math.min(this.reconnectAttempt + 1, 6);
            this.startStream();
        }, delayMs);
    }

    private scheduleProactiveReconnect(runtimeHintMs?: number) {
        if (!this.eventSource) return;
        this.clearProactiveReconnectTimer();

        const maxRuntimeMs = getPositiveNumber(runtimeHintMs) ?? SSE_MAX_RUNTIME_MS;
        const remainingMs = Math.max(
            STREAM_IMMEDIATE_RECONNECT_DELAY_MS,
            maxRuntimeMs - SSE_RECONNECT_BUFFER_MS
        );

        this.proactiveReconnectTimeout = setTimeout(() => {
            this.proactiveReconnectTimeout = null;
            if (this.isConnecting) return;
            this.closeStream();
            this.isConnecting = false;
            this.startFallbackPolling();
            this.scheduleReconnect(STREAM_IMMEDIATE_RECONNECT_DELAY_MS);
        }, remainingMs);
    }

    private refreshStaleTimer() {
        this.clearStaleTimer();
        this.staleTimeout = setTimeout(() => {
            this.staleTimeout = null;
            if (!this.eventSource || this.isConnecting) return;
            console.warn("[useBusLocationData] SSE stream became stale");
            this.closeStream();
            this.isConnecting = false;
            this.startFallbackPolling();
            this.scheduleReconnect(STREAM_IMMEDIATE_RECONNECT_DELAY_MS);
        }, SSE_STALE_TIMEOUT_MS);
    }

    private handleSnapshot(rawPayload: string) {
        try {
            const payload = JSON.parse(rawPayload) as BusStreamSnapshot;
            if (!Array.isArray(payload.data)) {
                console.error("[useBusLocationData] Invalid snapshot payload", payload);
                return;
            }
            const degraded = Boolean(payload.meta?.degraded || payload.partial);
            this.clearFallbackPolling();
            this.applyData(payload.data, {
                degraded,
                targetRouteIds: payload.routeIds || this.routeIds,
            });
        } catch (err) {
            console.error("[useBusLocationData] Failed to parse SSE snapshot", err);
        }
    }

    private handleReady(rawPayload: string) {
        try {
            const payload = JSON.parse(rawPayload) as BusStreamReady;
            const retryMs = getPositiveNumber(payload.retryMs);
            if (retryMs) {
                this.preferredRetryDelayMs = Math.min(STREAM_RECONNECT_MAX_DELAY_MS, retryMs);
            }
            const runtimeHintMs = getPositiveNumber(payload.reconnectHintMs);
            this.scheduleProactiveReconnect(runtimeHintMs ?? undefined);
        } catch (err) {
            console.error("[useBusLocationData] Failed to parse SSE ready payload", err);
        }
    }

    private handleHandoff(rawPayload: string) {
        let reconnectAfterMs: number | null = null;
        try {
            const payload = JSON.parse(rawPayload) as BusStreamHandoff;
            reconnectAfterMs = getPositiveNumber(payload.reconnectAfterMs);
        } catch (err) {
            console.error("[useBusLocationData] Failed to parse SSE handoff payload", err);
        }

        this.closeStream();
        this.isConnecting = false;
        this.startFallbackPolling();
        this.scheduleReconnect(reconnectAfterMs ?? STREAM_IMMEDIATE_RECONNECT_DELAY_MS);
    }

    private startStream() {
        if (this.eventSource || this.isConnecting || typeof window === "undefined") return;

        this.isConnecting = true;
        this.clearReconnectTimer();

        if (typeof window.EventSource === "undefined") {
            this.isConnecting = false;
            this.startFallbackPolling();
            return;
        }

        this.updateState({connectionStatus: "connecting"});

        const streamUrl = buildStreamUrl(this.routeIds);
        const source = new window.EventSource(streamUrl);
        this.eventSource = source;
        this.connectTimeout = setTimeout(() => {
            this.connectTimeout = null;
            if (!this.eventSource) return;
            console.warn("[useBusLocationData] SSE connection timeout");
            this.closeStream();
            this.isConnecting = false;
            this.startFallbackPolling();
            this.scheduleReconnect();
        }, STREAM_CONNECT_TIMEOUT_MS);

        source.addEventListener("snapshot", (event: MessageEvent<string>) => {
            this.refreshStaleTimer();
            this.handleSnapshot(event.data);
        });

        source.addEventListener("ready", (event: MessageEvent<string>) => {
            this.refreshStaleTimer();
            this.handleReady(event.data);
        });

        source.addEventListener("ping", () => {
            this.refreshStaleTimer();
        });

        source.addEventListener("handoff", (event: MessageEvent<string>) => {
            this.handleHandoff(event.data);
        });

        source.onerror = (err) => {
            console.warn("[useBusLocationData] SSE error", err);
            this.closeStream();
            this.isConnecting = false;
            this.startFallbackPolling();
            this.scheduleReconnect();
        };

        source.onopen = () => {
            this.isConnecting = false;
            this.reconnectAttempt = 0;
            this.clearConnectTimer();
            this.clearFallbackPolling();
            this.refreshStaleTimer();
            this.scheduleProactiveReconnect();
            this.updateState({connectionStatus: "connected"});
        };
    }

    private handleActivityChange = () => {
        if (typeof document === "undefined") return;
        const isVisible = document.visibilityState === "visible";
        const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

        if (isVisible && isOnline) {
            if (this.isSuspended) {
                console.log("[useBusLocationData] Tab visible & online: Resuming SSE stream");
                this.isSuspended = false;
                this.start();
            }
        } else {
            if (!this.isSuspended) {
                console.log(
                    `[useBusLocationData] Suspending SSE stream (visible: ${isVisible}, online: ${isOnline})`
                );
                this.isSuspended = true;
                this.suspend();
            }
        }
    };

    private suspend() {
        this.closeStream();
        this.clearFallbackPolling();
        this.clearReconnectTimer();
        this.isConnecting = false;
        this.updateState({connectionStatus: "suspended"});
    }

    private registerEventListeners() {
        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", this.handleActivityChange);
        }
        if (typeof window !== "undefined") {
            window.addEventListener("online", this.handleActivityChange);
            window.addEventListener("offline", this.handleActivityChange);
        }
    }

    private unregisterEventListeners() {
        if (typeof document !== "undefined") {
            document.removeEventListener("visibilitychange", this.handleActivityChange);
        }
        if (typeof window !== "undefined") {
            window.removeEventListener("online", this.handleActivityChange);
            window.removeEventListener("offline", this.handleActivityChange);
        }
    }

    private start() {
        if (this.routeIds.length === 0) {
            this.setState(EMPTY_STATE);
            return;
        }

        const isVisible =
            typeof document !== "undefined" ? document.visibilityState === "visible" : true;
        const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

        if (!isVisible || !isOnline) {
            this.isSuspended = true;
            this.updateState({connectionStatus: "suspended"});
            return;
        }

        this.isSuspended = false;
        this.startStream();
    }

    private stop() {
        this.closeStream();
        this.clearFallbackPolling();
        this.clearReconnectTimer();
        this.clearProactiveReconnectTimer();
        this.clearStaleTimer();
        this.clearConnectTimer();
        this.isConnecting = false;
        this.reconnectAttempt = 0;
        this.isSuspended = false;
        this.state = EMPTY_STATE;
    }
}

const busLocationStores = new Map<string, BusLocationStore>();

export function getBusLocationStore(routeIdsKey: string): BusLocationStore {
    const existing = busLocationStores.get(routeIdsKey);
    if (existing) return existing;
    const routeIds = routeIdsKey.split(",").filter(Boolean);
    const store = new BusLocationStore(routeIds, routeIdsKey);
    busLocationStores.set(routeIdsKey, store);
    return store;
}
