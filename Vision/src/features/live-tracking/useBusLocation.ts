import type {BusDataError, BusItem} from "@entities/bus/types";
import {API_CONFIG} from "@shared/config/env";
import type {CachedData, CacheMeta} from "@shared/redis/types";
import {buildRouteIdsKey} from "@shared/utils/routeIds";
import {useMemo, useSyncExternalStore} from "react";

const fetchRouteData = async (url: string): Promise<CachedData<BusItem[]>> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};

const EMPTY_BUS_LIST: BusItem[] = [];
const STREAM_RECONNECT_BASE_DELAY_MS = 1000;
const STREAM_RECONNECT_MAX_DELAY_MS = 10000;
const STREAM_IMMEDIATE_RECONNECT_DELAY_MS = 150;
const STREAM_CONNECT_TIMEOUT_MS = 8000;
const SSE_MAX_RUNTIME_MS = 60000;
const SSE_RECONNECT_BUFFER_MS = 5000;
const SSE_STALE_TIMEOUT_MS = Math.max(15000, API_CONFIG.LIVE.POLLING_INTERVAL_MS * 4);

interface BusStreamSnapshot {
    routeIds: string[];
    data: BusItem[];
    timestamp: number;
    meta?: CacheMeta;
    partial?: {
        failed: number; total: number;
    };
}

interface BusStreamReady {
    routeIds: string[];
    intervalMs: number;
    reconnectHintMs?: number;
    retryMs?: number;
}

interface BusStreamHandoff {
    reason?: string;
    reconnectAfterMs?: number;
}

interface BusLocationState {
    data: BusItem[];
    error: BusDataError;
    hasFetched: boolean;
}

const EMPTY_STATE: BusLocationState = {
    data: EMPTY_BUS_LIST, error: null, hasFetched: false,
};

type Listener = () => void;

function buildStreamUrl(routeIds: string[]): string {
    const query = new URLSearchParams({routeIds: routeIds.join(",")});
    return `/api/bus/stream?${query.toString()}`;
}

function mergeRouteEntries(entries: CachedData<BusItem[]>[]): BusItem[] {
    return entries.flatMap((entry) => entry.data);
}

function getPositiveNumber(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return null;
    }
    return value;
}

class BusLocationStore {
    private readonly routeIds: string[];
    private state: BusLocationState = EMPTY_STATE;
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
    private dataLength = 0;

    constructor(routeIds: string[]) {
        this.routeIds = routeIds;
    }

    getSnapshot = () => this.state;

    subscribe = (listener: Listener) => {
        this.listeners.add(listener);
        if (this.listeners.size === 1) {
            this.start();
        }
        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size === 0) {
                this.stop();
            }
        };
    };

    private emit() {
        for (const listener of Array.from(this.listeners)) {
            listener();
        }
    }

    private setState(next: BusLocationState) {
        this.state = next;
        this.emit();
    }

    private updateState(partial: Partial<BusLocationState>) {
        this.setState({
            ...this.state, ...partial,
        });
    }

    private applyData(nextData: BusItem[], options?: { degraded?: boolean }) {
        this.dataLength = nextData.length;
        const degraded = options?.degraded ?? false;
        this.setState({
            data: nextData,
            error: nextData.length === 0 ? (degraded ? "ERR:NETWORK" : "ERR:NONE_RUNNING") : null,
            hasFetched: true,
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
            const results = await Promise.all(this.routeIds.map((routeId) => fetchRouteData(`/api/bus/${routeId}`)));
            this.applyData(mergeRouteEntries(results));
        } catch (err) {
            console.error("[useBusLocationData] Polling fallback failed", err);
            if (this.dataLength === 0 && !this.eventSource) {
                this.setState({
                    data: EMPTY_BUS_LIST, error: "ERR:NETWORK", hasFetched: true,
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
    }

    private scheduleReconnect(delayOverrideMs?: number) {
        if (this.reconnectTimeout) return;

        const expBackoffMs = Math.min(STREAM_RECONNECT_MAX_DELAY_MS, this.preferredRetryDelayMs * (2 ** this.reconnectAttempt));
        const delayMs = Math.max(STREAM_IMMEDIATE_RECONNECT_DELAY_MS, delayOverrideMs ?? expBackoffMs);

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
        const remainingMs = Math.max(STREAM_IMMEDIATE_RECONNECT_DELAY_MS, maxRuntimeMs - SSE_RECONNECT_BUFFER_MS);

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
            this.applyData(payload.data, {degraded});
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
        };
    }

    private start() {
        if (this.routeIds.length === 0) {
            this.setState(EMPTY_STATE);
            return;
        }
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
    }
}

const busLocationStores = new Map<string, BusLocationStore>();

function getBusLocationStore(routeIdsKey: string): BusLocationStore {
    const existing = busLocationStores.get(routeIdsKey);
    if (existing) return existing;
    const routeIds = routeIdsKey.split(",").filter(Boolean);
    const store = new BusLocationStore(routeIds);
    busLocationStores.set(routeIdsKey, store);
    return store;
}

/**
 * Fetch bus locations for multiple routeIds.
 * Primary transport: SSE stream (/api/bus/stream).
 * Fallback: periodic polling via /api/bus/[routeId].
 */
export function useBusLocationData(routeIds: string[]): BusLocationState {
    const routeIdsKey = useMemo(() => buildRouteIdsKey(routeIds), [routeIds]);
    const store = useMemo(() => (routeIdsKey ? getBusLocationStore(routeIdsKey) : null), [routeIdsKey]);
    const subscribe = useMemo(() => {
        if (!store) return () => () => undefined;
        return store.subscribe;
    }, [store]);
    const getSnapshot = useMemo(() => {
        if (!store) return () => EMPTY_STATE;
        return store.getSnapshot;
    }, [store]);

    return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_STATE);
}
