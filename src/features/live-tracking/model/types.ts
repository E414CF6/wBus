import type {BusDataError, BusItem} from "@entities/bus/types";

export type LiveConnectionStatus = "connecting" | "connected" | "fallback" | "suspended";
export type SSEConnectionStatus = LiveConnectionStatus; // Backward-compatibility alias for UI components

export interface BusLocationState {
    data: BusItem[];
    error: BusDataError;
    hasFetched: boolean;
    connectionStatus: LiveConnectionStatus;
    lastUpdated: number | null;
    isDegraded: boolean;
    reconnect: () => void;
}

export type Listener = () => void;

export const EMPTY_BUS_LIST: BusItem[] = [];

export const EMPTY_STATE: BusLocationState = {
    data: EMPTY_BUS_LIST,
    error: null,
    hasFetched: false,
    connectionStatus: "connecting",
    lastUpdated: null,
    isDegraded: false,
    reconnect: () => undefined,
};

