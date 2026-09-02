import type {BusDataError, BusItem} from "@entities/bus/types";
import {API_CONFIG} from "@shared/config/env";
import type {CacheMeta} from "@shared/redis/types";

export type SSEConnectionStatus = "connecting" | "connected" | "fallback" | "suspended";

export interface BusLocationState {
    data: BusItem[];
    error: BusDataError;
    hasFetched: boolean;
    connectionStatus: SSEConnectionStatus;
    lastUpdated: number | null;
    isDegraded: boolean;
    reconnect: () => void;
}

export interface BusStreamSnapshot {
    routeIds: string[];
    data: BusItem[];
    timestamp: number;
    meta?: CacheMeta;
    partial?: {
        failed: number;
        total: number;
    };
}

export interface BusStreamReady {
    routeIds: string[];
    intervalMs: number;
    reconnectHintMs?: number;
    retryMs?: number;
}

export interface BusStreamHandoff {
    reason?: string;
    reconnectAfterMs?: number;
}

export type Listener = () => void;

export const EMPTY_BUS_LIST: BusItem[] = [];
export const STREAM_RECONNECT_BASE_DELAY_MS = 1000;
export const STREAM_RECONNECT_MAX_DELAY_MS = 10000;
export const STREAM_IMMEDIATE_RECONNECT_DELAY_MS = 150;
export const STREAM_CONNECT_TIMEOUT_MS = 8000;
export const SSE_MAX_RUNTIME_MS = 60000;
export const SSE_RECONNECT_BUFFER_MS = 5000;
export const SSE_STALE_TIMEOUT_MS = Math.max(15000, API_CONFIG.LIVE.POLLING_INTERVAL_MS * 4);

export const EMPTY_STATE: BusLocationState = {
    data: EMPTY_BUS_LIST,
    error: null,
    hasFetched: false,
    connectionStatus: "connecting",
    lastUpdated: null,
    isDegraded: false,
    reconnect: () => undefined,
};
