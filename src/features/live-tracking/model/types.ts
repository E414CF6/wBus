import type {BusDataError, BusItem, LiveConnectionStatus, SSEConnectionStatus} from "@entities/bus/types";

export type {LiveConnectionStatus, SSEConnectionStatus};

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

