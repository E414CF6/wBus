import {fetchWithRetry, SharedCircuitBreaker} from "@shared/api/upstreamClient";

export const SEOUL_CITY_CODE = "11";
export const WS_BUS_API_BASE = "http://ws.bus.go.kr/api/rest";
export const SBUS_WEB_BASE = "https://bus.go.kr/sbus/bus";

export const seoulWsBreaker = new SharedCircuitBreaker("SeoulWS", 5, 15_000);
export const seoulTopisBreaker = new SharedCircuitBreaker("SeoulTOPIS", 5, 15_000);

export function getSeoulApiHealth() {
    return {
        ws: seoulWsBreaker.getState(),
        topis: seoulTopisBreaker.getState(),
    };
}

export interface SbusResponseEnvelope<T> {
    ResponseVO?: {
        code?: number;
        message?: string;
        errmessage?: string | null;
        data?: T;
    };
}

/**
 * Shared fetch helper for Seoul TOPIS Web JSON API (`bus.go.kr/sbus/bus/*`).
 */
export async function fetchTopisJson<T>(
    url: string,
    endpointLabel: string,
    options?: { timeoutMs?: number; cache?: RequestCache }
): Promise<T> {
    const res = await fetchWithRetry(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; wBus/2.0)",
            Accept: "application/json",
        },
        timeoutMs: options?.timeoutMs ?? 4500,
        maxAttempts: 2,
        ...(options?.cache ? {cache: options.cache} : {}),
        circuitBreaker: seoulTopisBreaker,
    });

    if (!res.ok) {
        throw new Error(`[SeoulAPI] ${endpointLabel} HTTP ${res.status}`);
    }

    const json = (await res.json()) as SbusResponseEnvelope<T>;
    return (json.ResponseVO?.data ?? {}) as T;
}
