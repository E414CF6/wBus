import {API_PRIORITY, TaskQueue} from "@shared/utils/concurrency";
import {isRouteInServiceWindow, recordRouteBusActivity} from "@shared/lib/routeWindow";

/**
 * Advanced Client for Korea's Public Data Portal (apis.data.go.kr)
 * Features:
 * - Operating Service Window Engine (Prevents late-night/dawn futile API calls)
 * - Priority-Based Task Queue & Token Bucket Rate Limiting (8 req/sec)
 * - Multi-Service-Key Load Balancing & Rotation with Automatic Failover on 429/Limit
 * - Circuit Breaker Pattern (CLOSED / OPEN / HALF_OPEN)
 * - In-flight Request Deduplication (Coalescing)
 * - Response Envelope Validation & Error Inspection
 */

const PUBLIC_API_BASE = "https://apis.data.go.kr/1613000";
const CITY_CODE = "32020"; // Wonju
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 300;
const KEY_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes cooldown for rate-limited / quota-exhausted keys
const CIRCUIT_COOLDOWN_MS = 30 * 1000; // 30 seconds circuit breaker open time
const DEFAULT_PARAMS = {
    numOfRows: "1024", pageNo: "1", _type: "json", cityCode: CITY_CODE,
};

export class PublicApiError extends Error {
    status: number;
    url: string;

    constructor(message: string, status: number, url: string) {
        super(message);
        this.name = "PublicApiError";
        this.status = status;
        this.url = url;
    }
}

// ----------------------------------------------------------------------
// 1. Service Key Manager (Rotation + Cooldown Failover)
// ----------------------------------------------------------------------

interface KeyState {
    key: string;
    cooldownUntil: number;
}

class ServiceKeyManager {
    private keys: KeyState[] = [];
    private currentIndex = 0;

    constructor() {
        this.reloadKeys();
    }

    getKey(): { key: string; index: number } {
        if (this.keys.length === 0) {
            this.reloadKeys();
        }

        if (this.keys.length === 0) {
            throw new Error("[PublicAPI] DATA_GO_KR_SERVICE_KEY / DATA_GO_KR_SERVICE_KEYS is not set.");
        }

        const now = Date.now();
        // Try finding a key not in cooldown starting from current index
        for (let i = 0; i < this.keys.length; i++) {
            const idx = (this.currentIndex + i) % this.keys.length;
            const entry = this.keys[idx];
            if (now >= entry.cooldownUntil) {
                this.currentIndex = (idx + 1) % this.keys.length;
                return {key: entry.key, index: idx};
            }
        }

        // If all keys are in cooldown, use the one that expires earliest
        let earliestIdx = 0;
        let minTime = Infinity;
        this.keys.forEach((entry, idx) => {
            if (entry.cooldownUntil < minTime) {
                minTime = entry.cooldownUntil;
                earliestIdx = idx;
            }
        });

        return {key: this.keys[earliestIdx].key, index: earliestIdx};
    }

    markCooldown(keyIndex: number) {
        if (this.keys[keyIndex]) {
            this.keys[keyIndex].cooldownUntil = Date.now() + KEY_COOLDOWN_MS;
            console.warn(`[PublicAPI KeyManager] Service key #${keyIndex + 1} rate-limited or quota exceeded. Cooldown until ${new Date(this.keys[keyIndex].cooldownUntil).toISOString()}`);
        }
    }

    getMetrics() {
        const now = Date.now();
        return {
            totalKeys: this.keys.length,
            activeKeys: this.keys.filter((k) => now >= k.cooldownUntil).length,
            cooldownKeys: this.keys.filter((k) => now < k.cooldownUntil).length,
        };
    }

    private reloadKeys() {
        const rawKeys = process.env.DATA_GO_KR_SERVICE_KEYS || process.env.DATA_GO_KR_SERVICE_KEY || "";
        const parsed = rawKeys.split(",").map((k) => k.trim()).filter(Boolean);
        this.keys = parsed.map((key) => ({key, cooldownUntil: 0}));
    }
}

const keyManager = new ServiceKeyManager();

// ----------------------------------------------------------------------
// 2. Circuit Breaker
// ----------------------------------------------------------------------

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

class CircuitBreaker {
    private state: CircuitState = "CLOSED";
    private consecutiveFailures = 0;
    private nextAttemptAt = 0;
    private totalRequests = 0;
    private successfulRequests = 0;
    private failedRequests = 0;
    private lastSuccessTime: number | null = null;
    private lastFailureTime: number | null = null;

    canExecute(): boolean {
        if (this.state === "CLOSED") return true;

        const now = Date.now();
        if (this.state === "OPEN") {
            if (now >= this.nextAttemptAt) {
                this.state = "HALF_OPEN";
                console.log("[PublicAPI CircuitBreaker] Entering HALF_OPEN state (probe request allowed).");
                return true;
            }
            return false;
        }

        // HALF_OPEN allows probe
        return true;
    }

    recordSuccess() {
        this.totalRequests++;
        this.successfulRequests++;
        this.lastSuccessTime = Date.now();
        this.consecutiveFailures = 0;
        if (this.state !== "CLOSED") {
            console.log("[PublicAPI CircuitBreaker] Upstream recovered. Resetting state to CLOSED.");
            this.state = "CLOSED";
        }
    }

    recordFailure() {
        this.totalRequests++;
        this.failedRequests++;
        this.lastFailureTime = Date.now();
        this.consecutiveFailures++;

        if (this.consecutiveFailures >= 5 || (this.state === "HALF_OPEN")) {
            this.state = "OPEN";
            this.nextAttemptAt = Date.now() + CIRCUIT_COOLDOWN_MS;
            console.warn(`[PublicAPI CircuitBreaker] Tripped to OPEN due to ${this.consecutiveFailures} consecutive failures. Cooldown until ${new Date(this.nextAttemptAt).toISOString()}`);
        }
    }

    getState() {
        return {
            state: this.state,
            consecutiveFailures: this.consecutiveFailures,
            totalRequests: this.totalRequests,
            successfulRequests: this.successfulRequests,
            failedRequests: this.failedRequests,
            lastSuccessTime: this.lastSuccessTime ? new Date(this.lastSuccessTime).toISOString() : null,
            lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
        };
    }
}

const circuitBreaker = new CircuitBreaker();

// ----------------------------------------------------------------------
// 3. Priority Concurrency Queue & Token Bucket Rate Limiter
// ----------------------------------------------------------------------

const publicApiQueue = new TaskQueue({
    concurrency: 3, staggerMs: 30, maxRps: 8, // Strictly limits upstream to maximum 8 req/sec
});

const pendingInflightRequests = new Map<string, Promise<unknown>>();

function buildUrl(path: string, params: Record<string, string>, serviceKey: string): string {
    const url = new URL(`${PUBLIC_API_BASE}${path}`);
    url.searchParams.set("serviceKey", serviceKey);
    for (const [k, v] of Object.entries({...DEFAULT_PARAMS, ...params})) {
        url.searchParams.set(k, v);
    }
    return url.toString();
}

// Route-level active bus count tracker for adaptive polling & priority queuing
interface RouteBusMetrics {
    busCount: number;
    lastFetchedAt: number;
}

const routeBusMetricsMap = new Map<string, RouteBusMetrics>();

export function getRouteBusCount(routeId: string): number | undefined {
    return routeBusMetricsMap.get(routeId)?.busCount;
}

/**
 * Returns dynamic TTL based on route service window and active bus count.
 * - Outside operating window: Long backoff TTL (e.g. 300s ~ 1800s) to eliminate futile calls.
 * - Inside window with active buses: High-frequency activeTtl (e.g. 4s).
 * - Inside window with 0 buses: Backoff idleTtl (e.g. 20s).
 */
export function getAdaptiveTtlSeconds(routeId: string, activeTtl = 4, idleTtl = 20): number {
    const status = isRouteInServiceWindow(routeId);
    if (!status.inService) {
        return status.retryAfterSeconds;
    }

    const metrics = routeBusMetricsMap.get(routeId);
    if (!metrics) return activeTtl;
    return metrics.busCount > 0 ? activeTtl : idleTtl;
}

async function fetchPublicApi<T>(path: string, params: Record<string, string>, options?: {
    priority?: number
}): Promise<T> {
    const dedupeKey = `${path}:${JSON.stringify(params)}`;
    if (pendingInflightRequests.has(dedupeKey)) {
        return pendingInflightRequests.get(dedupeKey) as Promise<T>;
    }

    const priority = options?.priority ?? API_PRIORITY.USER_INTERACTIVE;
    const promise = publicApiQueue.enqueue(() => rawFetchPublicApi<T>(path, params), {priority})
        .finally(() => {
            pendingInflightRequests.delete(dedupeKey);
        });

    pendingInflightRequests.set(dedupeKey, promise);
    return promise;
}

function inspectResponseForErrors(data: unknown): {
    isError: boolean; isQuotaOrKeyError: boolean; message: string; code: string;
} {
    if (!data || typeof data !== "object") {
        return {isError: false, isQuotaOrKeyError: false, message: "", code: ""};
    }

    const obj = data as Record<string, unknown>;
    const xmlError = (obj.OpenAPI_ServiceResponse as Record<string, unknown> | undefined)?.cmmMsgHeader as Record<string, unknown> | undefined;
    if (xmlError) {
        const code = String(xmlError.returnReasonCode ?? "").trim();
        const msg = String(xmlError.errMsg ?? "OpenAPI Error").trim();
        const upperMsg = msg.toUpperCase();
        const isQuotaOrKeyError = code === "22" || code === "30" || code === "31" || code === "20" || code === "429" || upperMsg.includes("LIMITED") || upperMsg.includes("TRAFFIC") || upperMsg.includes("EXCEED") || upperMsg.includes("KEY");
        return {isError: true, isQuotaOrKeyError, message: msg, code};
    }

    const header = (obj.response as Record<string, unknown> | undefined)?.header as Record<string, unknown> | undefined;
    if (header && header.resultCode !== undefined) {
        const code = String(header.resultCode).trim();
        const msg = String(header.resultMsg ?? "API Error").trim();
        if (code !== "00" && code !== "0" && code !== "0000") {
            const upperMsg = msg.toUpperCase();
            const isQuotaOrKeyError = code === "22" || code === "30" || code === "31" || code === "20" || code === "429" || upperMsg.includes("LIMITED") || upperMsg.includes("TRAFFIC") || upperMsg.includes("EXCEED") || upperMsg.includes("KEY");
            return {isError: true, isQuotaOrKeyError, message: msg, code};
        }
    }

    return {isError: false, isQuotaOrKeyError: false, message: "", code: ""};
}

async function rawFetchPublicApi<T>(path: string, params: Record<string, string>): Promise<T> {
    if (!circuitBreaker.canExecute()) {
        throw new PublicApiError("[PublicAPI] Circuit Breaker is OPEN due to upstream failure.", 503, path);
    }

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        const {key: serviceKey, index: keyIndex} = keyManager.getKey();
        const url = buildUrl(path, params, serviceKey);

        try {
            const res = await fetch(url, {
                headers: {
                    Client: "wBus", Connection: "keep-alive",
                }, signal: AbortSignal.timeout(8000), cache: "no-store",
            });

            if (res.ok) {
                const data = await res.json() as T;
                const errCheck = inspectResponseForErrors(data);

                if (errCheck.isError) {
                    if (errCheck.isQuotaOrKeyError) {
                        keyManager.markCooldown(keyIndex);
                    }

                    console.warn(`[PublicAPI] Key #${keyIndex + 1} returned upstream API error: ${errCheck.message} (Code: ${errCheck.code}, Quota/Key Error: ${errCheck.isQuotaOrKeyError}). Attempt ${attempt}/${MAX_RETRY_ATTEMPTS}`);

                    if (attempt < MAX_RETRY_ATTEMPTS) {
                        await delay(attempt);
                        continue;
                    }

                    const safeUrl = url.replace(/serviceKey=[^&]+/, "serviceKey=***");
                    throw new PublicApiError(`[PublicAPI] ${errCheck.message} (Code: ${errCheck.code})`, errCheck.isQuotaOrKeyError ? 429 : 502, safeUrl);
                }

                circuitBreaker.recordSuccess();
                return data;
            }

            if (res.status === 429) {
                keyManager.markCooldown(keyIndex);
            }

            if (!isRetryableStatus(res.status) || attempt === MAX_RETRY_ATTEMPTS) {
                const safeUrl = url.replace(/serviceKey=[^&]+/, "serviceKey=***");
                throw new PublicApiError(`[PublicAPI] ${res.status} ${res.statusText}`, res.status, safeUrl);
            }
        } catch (err) {
            lastError = err;
            if (err instanceof PublicApiError && err.status === 429) {
                keyManager.markCooldown(keyIndex);
            }

            if (attempt === MAX_RETRY_ATTEMPTS) {
                circuitBreaker.recordFailure();
                if (err instanceof PublicApiError) throw err;
                const message = err instanceof Error ? err.message : String(err);
                const safeUrl = url.replace(/serviceKey=[^&]+/, "serviceKey=***");
                throw new PublicApiError(`[PublicAPI] Network/Timeout error: ${message}`, 502, safeUrl);
            }
        }

        await delay(attempt);
    }

    circuitBreaker.recordFailure();
    throw lastError instanceof Error ? lastError : new PublicApiError("[PublicAPI] Retry failed", 500, path);
}

function isRetryableStatus(status: number): boolean {
    return status === 429 || status >= 500;
}

function delay(attempt: number): Promise<void> {
    const jitter = Math.floor(Math.random() * 100);
    return new Promise((resolve) => {
        setTimeout(resolve, RETRY_BASE_DELAY_MS * attempt + jitter);
    });
}

// ----------------------------------------------------------------------
// 4. Response Validation
// ----------------------------------------------------------------------

interface PublicApiResponseEnvelope<T> {
    response?: {
        header?: {
            resultCode?: string | number; resultMsg?: string;
        }; body?: {
            items?: {
                item?: T | T[];
            };
        };
    };
    OpenAPI_ServiceResponse?: {
        cmmMsgHeader?: {
            errMsg?: string; returnReasonCode?: string | number;
        };
    };
}

function extractItems<T>(data: PublicApiResponseEnvelope<T>, urlHint = "apis.data.go.kr"): T[] {
    if (!data) return [];

    const errCheck = inspectResponseForErrors(data);
    if (errCheck.isError) {
        throw new PublicApiError(`[PublicAPI] ${errCheck.message} (Code: ${errCheck.code})`, errCheck.isQuotaOrKeyError ? 429 : 502, urlHint);
    }

    const raw = data.response?.body?.items?.item;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
}

// ----------------------------------------------------------------------
// 5. Telemetry & Metrics Export
// ----------------------------------------------------------------------

export function getPublicApiHealth() {
    return {
        circuit: circuitBreaker.getState(),
        keys: keyManager.getMetrics(),
        queue: publicApiQueue.getMetrics(),
        inflightRequests: pendingInflightRequests.size,
        routeBusCounts: Object.fromEntries(Array.from(routeBusMetricsMap.entries()).map(([id, m]) => [id, m.busCount])),
    };
}

// ----------------------------------------------------------------------
// 6. Public Functions
// ----------------------------------------------------------------------

export interface RawBusLocation {
    routeid?: string;
    routenm: string;
    gpslati: number;
    gpslong: number;
    vehicleno: string;
    nodenm?: string;
    nodeid?: string;
    nodeord?: number;
}

export async function fetchBusLocations(routeId: string, options?: {
    force?: boolean;
    priority?: number
}): Promise<RawBusLocation[]> {
    // 1. Check Operating Service Window (Short-circuit during midnight / non-operating hours)
    const serviceStatus = isRouteInServiceWindow(routeId);
    if (!serviceStatus.inService && !options?.force) {
        // Record 0 bus count for metrics
        routeBusMetricsMap.set(routeId, {
            busCount: 0, lastFetchedAt: Date.now(),
        });
        return [];
    }

    const currentMetrics = routeBusMetricsMap.get(routeId);
    // Priority: Priority argument or calculated level
    const priority = options?.priority ?? (serviceStatus.reason === "activity_override" || (currentMetrics && currentMetrics.busCount > 0) ? API_PRIORITY.USER_INTERACTIVE : API_PRIORITY.STREAM_ACTIVE);

    const data = await fetchPublicApi<PublicApiResponseEnvelope<RawBusLocation>>("/BusLcInfoInqireService/getRouteAcctoBusLcList", {routeId}, {priority});

    const items = extractItems(data, `getRouteAcctoBusLcList:${routeId}`);

    // Update bus count metrics & activity timestamp for dynamic window extension
    routeBusMetricsMap.set(routeId, {
        busCount: items.length, lastFetchedAt: Date.now(),
    });
    recordRouteBusActivity(routeId, items.length);

    return items.map((bus) => ({
        ...bus, routeid: routeId,
    }));
}

export interface RawBusArrival {
    arrprevstationcnt: number;
    arrtime: number;
    routeid: string;
    routeno: string;
    vehicletp: string;
}

export async function fetchBusArrivals(nodeId: string): Promise<RawBusArrival[]> {
    const data = await fetchPublicApi<PublicApiResponseEnvelope<RawBusArrival>>("/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList", {nodeId}, {priority: API_PRIORITY.USER_INTERACTIVE});

    return extractItems(data, `getSttnAcctoArvlPrearngeInfoList:${nodeId}`);
}

export interface RawBusStop {
    nodeid: string;
    nodenm: string;
    nodeno: string | number;
    gpslati: number;
    gpslong: number;
    nodeord?: number;
    updowncd?: number;
}

export async function fetchRouteStops(routeId: string): Promise<RawBusStop[]> {
    const data = await fetchPublicApi<PublicApiResponseEnvelope<RawBusStop>>("/BusRouteInfoInqireService/getRouteAcctoThrghSttnList", {routeId}, {priority: API_PRIORITY.USER_INTERACTIVE});

    return extractItems(data, `getRouteAcctoThrghSttnList:${routeId}`);
}
