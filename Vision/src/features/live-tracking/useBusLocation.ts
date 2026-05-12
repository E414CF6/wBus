import type {BusDataError, BusItem} from "@entities/bus/types";
import {API_CONFIG} from "@shared/config/env";
import type {CachedData} from "@shared/redis/types";
import {useEffect, useMemo, useRef, useState} from "react";

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

function normalizeRouteIds(routeIds: string[]): string[] {
    return Array.from(new Set(routeIds.filter((id) => id.trim() !== ""))).sort();
}

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

/**
 * Fetch bus locations for multiple routeIds.
 * Primary transport: SSE stream (/api/bus/stream).
 * Fallback: periodic polling via /api/bus/[routeId].
 */
export function useBusLocationData(routeIds: string[]): {
    data: BusItem[]; error: BusDataError; hasFetched: boolean;
} {
    const routeIdsKey = useMemo(() => normalizeRouteIds(routeIds).join(","), [routeIds]);
    const [data, setData] = useState<BusItem[]>(EMPTY_BUS_LIST);
    const [error, setError] = useState<BusDataError>(null);
    const [hasFetched, setHasFetched] = useState(false);
    const dataLengthRef = useRef(0);

    useEffect(() => {
        const activeRouteIds = routeIdsKey ? routeIdsKey.split(",") : [];

        if (activeRouteIds.length === 0) {
            setData(EMPTY_BUS_LIST);
            setError(null);
            setHasFetched(false);
            return;
        }

        let disposed = false;
        let eventSource: EventSource | null = null;
        let fallbackInterval: ReturnType<typeof setInterval> | null = null;
        let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
        let proactiveReconnectTimeout: ReturnType<typeof setTimeout> | null = null;
        let staleTimeout: ReturnType<typeof setTimeout> | null = null;
        let connectTimeout: ReturnType<typeof setTimeout> | null = null;
        let isConnecting = false;
        let reconnectAttempt = 0;
        let preferredRetryDelayMs = STREAM_RECONNECT_BASE_DELAY_MS;

        const applyData = (nextData: BusItem[]) => {
            if (disposed) return;
            dataLengthRef.current = nextData.length;
            setData(nextData);
            setHasFetched(true);
            setError(nextData.length === 0 ? "ERR:NONE_RUNNING" : null);
        };

        const clearFallbackPolling = () => {
            if (fallbackInterval) {
                clearInterval(fallbackInterval);
                fallbackInterval = null;
            }
        };

        const clearReconnectTimer = () => {
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
        };

        const clearProactiveReconnectTimer = () => {
            if (proactiveReconnectTimeout) {
                clearTimeout(proactiveReconnectTimeout);
                proactiveReconnectTimeout = null;
            }
        };

        const clearStaleTimer = () => {
            if (staleTimeout) {
                clearTimeout(staleTimeout);
                staleTimeout = null;
            }
        };

        const clearConnectTimer = () => {
            if (connectTimeout) {
                clearTimeout(connectTimeout);
                connectTimeout = null;
            }
        };

        const closeStream = () => {
            clearProactiveReconnectTimer();
            clearStaleTimer();
            clearConnectTimer();
            if (!eventSource) return;
            eventSource.close();
            eventSource = null;
        };

        const fetchFallback = async () => {
            try {
                const results = await Promise.all(activeRouteIds.map((routeId) => fetchRouteData(`/api/bus/${routeId}`)));
                applyData(mergeRouteEntries(results));
            } catch (err) {
                console.error("[useBusLocationData] Polling fallback failed", err);
                if (disposed) return;

                // Only set error if we don't have existing data or SSE isn't active
                if (dataLengthRef.current === 0 && !eventSource) {
                    setData(EMPTY_BUS_LIST);
                    setError("ERR:NETWORK");
                    setHasFetched(true);
                }
            }
        };

        const startFallbackPolling = () => {
            if (fallbackInterval) return;
            void fetchFallback();
            fallbackInterval = setInterval(() => {
                void fetchFallback();
            }, API_CONFIG.LIVE.POLLING_INTERVAL_MS);
        };

        const scheduleReconnect = (delayOverrideMs?: number) => {
            if (reconnectTimeout || disposed) return;

            const expBackoffMs = Math.min(STREAM_RECONNECT_MAX_DELAY_MS, preferredRetryDelayMs * (2 ** reconnectAttempt));
            const delayMs = Math.max(STREAM_IMMEDIATE_RECONNECT_DELAY_MS, delayOverrideMs ?? expBackoffMs);

            reconnectTimeout = setTimeout(() => {
                reconnectTimeout = null;
                if (disposed) return;
                reconnectAttempt = Math.min(reconnectAttempt + 1, 6);
                startStream();
            }, delayMs);
        };

        const scheduleProactiveReconnect = (runtimeHintMs?: number) => {
            if (disposed || !eventSource) return;
            clearProactiveReconnectTimer();

            const maxRuntimeMs = getPositiveNumber(runtimeHintMs) ?? SSE_MAX_RUNTIME_MS;
            const remainingMs = Math.max(STREAM_IMMEDIATE_RECONNECT_DELAY_MS, maxRuntimeMs - SSE_RECONNECT_BUFFER_MS);

            proactiveReconnectTimeout = setTimeout(() => {
                proactiveReconnectTimeout = null;
                if (disposed || isConnecting) return;
                closeStream();
                isConnecting = false;
                startFallbackPolling();
                scheduleReconnect(STREAM_IMMEDIATE_RECONNECT_DELAY_MS);
            }, remainingMs);
        };

        const refreshStaleTimer = () => {
            clearStaleTimer();
            staleTimeout = setTimeout(() => {
                staleTimeout = null;
                if (disposed || !eventSource || isConnecting) return;
                console.warn("[useBusLocationData] SSE stream became stale");
                closeStream();
                isConnecting = false;
                startFallbackPolling();
                scheduleReconnect(STREAM_IMMEDIATE_RECONNECT_DELAY_MS);
            }, SSE_STALE_TIMEOUT_MS);
        };

        const handleSnapshot = (rawPayload: string) => {
            try {
                const payload = JSON.parse(rawPayload) as BusStreamSnapshot;
                if (!Array.isArray(payload.data)) {
                    console.error("[useBusLocationData] Invalid snapshot payload", payload);
                    return;
                }
                clearFallbackPolling(); // SSE works, stop fallback
                setError(null);
                applyData(payload.data);
            } catch (err) {
                console.error("[useBusLocationData] Failed to parse SSE snapshot", err);
            }
        };

        const handleReady = (rawPayload: string) => {
            try {
                const payload = JSON.parse(rawPayload) as BusStreamReady;
                const retryMs = getPositiveNumber(payload.retryMs);
                if (retryMs) {
                    preferredRetryDelayMs = Math.min(STREAM_RECONNECT_MAX_DELAY_MS, retryMs);
                }
                const runtimeHintMs = getPositiveNumber(payload.reconnectHintMs);
                scheduleProactiveReconnect(runtimeHintMs ?? undefined);
            } catch (err) {
                console.error("[useBusLocationData] Failed to parse SSE ready payload", err);
            }
        };

        const handleHandoff = (rawPayload: string) => {
            let reconnectAfterMs: number | null = null;
            try {
                const payload = JSON.parse(rawPayload) as BusStreamHandoff;
                reconnectAfterMs = getPositiveNumber(payload.reconnectAfterMs);
            } catch (err) {
                console.error("[useBusLocationData] Failed to parse SSE handoff payload", err);
            }

            closeStream();
            isConnecting = false;
            startFallbackPolling();
            scheduleReconnect(reconnectAfterMs ?? STREAM_IMMEDIATE_RECONNECT_DELAY_MS);
        };

        const startStream = () => {
            if (disposed || eventSource || isConnecting || typeof window === "undefined") return;

            isConnecting = true;
            clearReconnectTimer();

            if (typeof window.EventSource === "undefined") {
                isConnecting = false;
                startFallbackPolling();
                return;
            }

            const streamUrl = buildStreamUrl(activeRouteIds);
            const source = new window.EventSource(streamUrl);
            eventSource = source;
            connectTimeout = setTimeout(() => {
                connectTimeout = null;
                if (disposed || !eventSource) return;
                console.warn("[useBusLocationData] SSE connection timeout");
                closeStream();
                isConnecting = false;
                startFallbackPolling();
                scheduleReconnect();
            }, STREAM_CONNECT_TIMEOUT_MS);

            source.addEventListener("snapshot", (event: MessageEvent<string>) => {
                refreshStaleTimer();
                handleSnapshot(event.data);
            });

            source.addEventListener("ready", (event: MessageEvent<string>) => {
                refreshStaleTimer();
                handleReady(event.data);
            });

            source.addEventListener("ping", () => {
                refreshStaleTimer();
            });

            source.addEventListener("handoff", (event: MessageEvent<string>) => {
                handleHandoff(event.data);
            });

            source.onerror = (err) => {
                console.warn("[useBusLocationData] SSE error", err);

                // EventSource auto reconnects, but it might be too slow. We want to close
                // and start a fast fallback while waiting to reconnect manually.
                closeStream();
                isConnecting = false;
                startFallbackPolling();
                scheduleReconnect();
            };

            source.onopen = () => {
                // Connected successfully, we can stop fallback
                isConnecting = false;
                reconnectAttempt = 0;
                clearConnectTimer();
                clearFallbackPolling();
                refreshStaleTimer();
                scheduleProactiveReconnect();
            };
        };

        setData(EMPTY_BUS_LIST);
        setError(null);
        setHasFetched(false);
        startStream();

        return () => {
            disposed = true;
            closeStream();
            clearFallbackPolling();
            clearReconnectTimer();
            clearProactiveReconnectTimer();
            clearStaleTimer();
            clearConnectTimer();
        };
    }, [routeIdsKey]);

    return {data, error, hasFetched};
}
