/**
 * Shared Upstream HTTP Client
 *
 * Unifies timeout, retry-with-backoff (+ jitter), and Circuit Breaker state tracking
 * across MOLIT TAGO, Seoul TOPIS/ws.bus.go.kr, and OSRM routing engines.
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class SharedCircuitBreaker {
    private state: CircuitState = "CLOSED";
    private failureCount = 0;
    private lastFailureTime = 0;
    private lastSuccessTime = 0;
    private nextAttemptTime = 0;
    private totalRequests = 0;
    private successfulRequests = 0;
    private failedRequests = 0;

    constructor(
        private readonly name: string,
        private readonly threshold = 5,
        private readonly cooldownMs = 15_000
    ) {
    }

    canRequest(): boolean {
        if (this.state === "CLOSED") return true;
        if (this.state === "OPEN" && Date.now() >= this.nextAttemptTime) {
            this.state = "HALF_OPEN";
            console.warn(`[CircuitBreaker:${this.name}] HALF_OPEN: Testing upstream recovery...`);
            return true;
        }
        return false;
    }

    recordSuccess(): void {
        this.totalRequests += 1;
        this.successfulRequests += 1;
        this.lastSuccessTime = Date.now();
        if (this.state !== "CLOSED") {
            console.log(`[CircuitBreaker:${this.name}] CLOSED: Upstream recovered.`);
        }
        this.state = "CLOSED";
        this.failureCount = 0;
    }

    recordFailure(): void {
        this.totalRequests += 1;
        this.failedRequests += 1;
        this.failureCount += 1;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= this.threshold || this.state === "HALF_OPEN") {
            this.state = "OPEN";
            this.nextAttemptTime = Date.now() + this.cooldownMs;
            console.error(
                `[CircuitBreaker:${this.name}] OPENED for ${this.cooldownMs}ms after ${this.failureCount} failures.`
            );
        }
    }

    getState() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            consecutiveFailures: this.failureCount,
            totalRequests: this.totalRequests,
            successfulRequests: this.successfulRequests,
            failedRequests: this.failedRequests,
            lastSuccessTime: this.lastSuccessTime > 0 ? new Date(this.lastSuccessTime).toISOString() : null,
            lastFailureTime: this.lastFailureTime > 0 ? new Date(this.lastFailureTime).toISOString() : null,
            cooldownRemainingMs: this.state === "OPEN" ? Math.max(0, this.nextAttemptTime - Date.now()) : 0,
        };
    }
}

export function computeBackoffDelayMs(attempt: number, baseDelayMs = 300, maxJitterMs = 120): number {
    const jitter = maxJitterMs > 0 ? Math.floor(Math.random() * maxJitterMs) : 0;
    return baseDelayMs * 2 ** Math.max(0, attempt - 1) + jitter;
}

export interface UpstreamRetryOptions {
    maxAttempts?: number;
    baseDelayMs?: number;
    timeoutMs?: number;
    method?: string;
    body?: BodyInit | null;
    headers?: Record<string, string>;
    cache?: RequestCache;
    circuitBreaker?: SharedCircuitBreaker;
    isRetryableStatus?: (status: number) => boolean;
}

const DEFAULT_RETRYABLE_STATUS = (status: number) => status === 429 || status === 408 || status >= 500;

export async function fetchWithRetry(
    url: string,
    options: UpstreamRetryOptions = {}
): Promise<Response> {
    const maxAttempts = options.maxAttempts ?? 3;
    const baseDelayMs = options.baseDelayMs ?? 300;
    const timeoutMs = options.timeoutMs ?? 5000;
    const isRetryable = options.isRetryableStatus ?? DEFAULT_RETRYABLE_STATUS;
    const breaker = options.circuitBreaker;

    if (breaker && !breaker.canRequest()) {
        throw new Error(`Upstream circuit breaker open for ${url}`);
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const res = await fetch(url, {
                method: options.method,
                body: options.body,
                headers: options.headers,
                signal: AbortSignal.timeout(timeoutMs),
                cache: options.cache ?? "no-store",
            });

            if (res.ok) {
                breaker?.recordSuccess();
                return res;
            }

            if (isRetryable(res.status) && attempt < maxAttempts) {
                const jitter = Math.floor(Math.random() * 120);
                const delayMs = baseDelayMs * 2 ** (attempt - 1) + jitter;
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                continue;
            }

            if (res.status >= 500 || res.status === 429) {
                breaker?.recordFailure();
            }
            return res;
        } catch (err) {
            lastError = err;
            const isAbort = err instanceof DOMException && err.name === "AbortError";
            if (isAbort && attempt >= maxAttempts) {
                breaker?.recordFailure();
                throw err;
            }
            if (attempt < maxAttempts) {
                const jitter = Math.floor(Math.random() * 120);
                const delayMs = baseDelayMs * 2 ** (attempt - 1) + jitter;
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                continue;
            }
            breaker?.recordFailure();
            throw err;
        }
    }

    breaker?.recordFailure();
    throw lastError instanceof Error ? lastError : new Error(`Upstream fetch failed for ${url}`);
}
