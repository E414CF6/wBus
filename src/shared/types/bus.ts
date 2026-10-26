export type LiveConnectionStatus = "connecting" | "connected" | "fallback" | "suspended";

export interface ApiResponse<T = unknown, M = unknown> {
    success: boolean;
    refreshed?: boolean;
    message?: string;
    data?: T;
    meta?: M;
    error?: string;
    elapsedMs?: number;
}

export type {DayMode} from "./navigation";

