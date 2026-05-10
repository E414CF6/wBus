import type {BusDataError, BusItem} from "@entities/bus/types";
import {API_CONFIG} from "@shared/config/env";
import type {CachedData} from "@shared/redis/types";
import {useEffect, useMemo, useState} from "react";

const fetchRouteData = async (url: string): Promise<CachedData<BusItem[]>> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};

const EMPTY_BUS_LIST: BusItem[] = [];
const STREAM_RECONNECT_DELAY_MS = 5000;

interface BusStreamSnapshot {
    routeIds: string[];
    data: BusItem[];
    timestamp: number;
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

/**
 * Fetch bus location data for a single routeId.
 */
export function useBusLocationByRouteId(routeId: string | null): {
    data: BusItem[]; error: BusDataError; hasFetched: boolean;
} {
    const routeIds = useMemo(() => routeId ? [routeId] : [], [routeId]);
    return useBusLocationData(routeIds);
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

        const applyData = (nextData: BusItem[]) => {
            if (disposed) return;
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

        const closeStream = () => {
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
                setData(EMPTY_BUS_LIST);
                setError("ERR:NETWORK");
                setHasFetched(true);
            }
        };

        const startFallbackPolling = () => {
            if (fallbackInterval) return;
            void fetchFallback();
            fallbackInterval = setInterval(() => {
                void fetchFallback();
            }, API_CONFIG.LIVE.POLLING_INTERVAL_MS);
        };

        const scheduleReconnect = () => {
            if (reconnectTimeout || disposed) return;
            reconnectTimeout = setTimeout(() => {
                reconnectTimeout = null;
                if (disposed) return;
                startStream();
            }, STREAM_RECONNECT_DELAY_MS);
        };

        const handleSnapshot = (rawPayload: string) => {
            try {
                const payload = JSON.parse(rawPayload) as BusStreamSnapshot;
                if (!Array.isArray(payload.data)) {
                    throw new Error("Invalid snapshot payload");
                }
                clearFallbackPolling();
                setError(null);
                applyData(payload.data);
            } catch (err) {
                console.error("[useBusLocationData] Failed to parse SSE snapshot", err);
            }
        };

        const startStream = () => {
            if (disposed || eventSource || typeof window === "undefined") return;
            if (typeof window.EventSource === "undefined") {
                startFallbackPolling();
                return;
            }

            const streamUrl = buildStreamUrl(activeRouteIds);
            const source = new window.EventSource(streamUrl);
            eventSource = source;

            source.addEventListener("snapshot", (event: MessageEvent<string>) => {
                handleSnapshot(event.data);
            });

            source.onerror = () => {
                closeStream();
                startFallbackPolling();
                scheduleReconnect();
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
        };
    }, [routeIdsKey]);

    return {data, error, hasFetched};
}
