/**
 * Concurrency, Priority Queue, and Token Bucket Rate Limiting Utilities
 *
 * Prevents API throttling (429 Too Many Requests), upstream overload, socket exhaustion,
 * and tail latency when communicating with public data portals (e.g. apis.data.go.kr).
 */

export interface ConcurrencyOptions {
    /** Maximum number of parallel executions (default: 3) */
    concurrency?: number;
    /** Delay in milliseconds between launching consecutive tasks (default: 30) */
    staggerMs?: number;
    /** Maximum requests allowed per second (Token Bucket limit, default: 8) */
    maxRps?: number;
}

interface QueueItem {
    run: () => void;
    priority: number;
    enqueuedAt: number;
}

export interface TaskEnqueueOptions {
    /** Higher numerical priority executes first (default: 0) */
    priority?: number;
}

/** Standard priority levels across transit API calls */
export const API_PRIORITY = {
    USER_INTERACTIVE: 100, // User directly viewing/switching a route on live map
    STREAM_ACTIVE: 50,      // Periodic snapshot for routes with running buses
    STREAM_IDLE: 10,        // Periodic snapshot for idle routes (0 buses)
    BACKGROUND_PROBE: 1,    // Nighttime probes & cache prefetching
} as const;

/**
 * Advanced Priority Task Queue with Token Bucket Rate Limiting & Staggering.
 */
export class TaskQueue {
    private readonly concurrency: number;
    private readonly staggerMs: number;
    private readonly maxTokens: number;
    private readonly refillRatePerMs: number;

    private activeCount = 0;
    private queue: QueueItem[] = [];
    private lastLaunchTime = 0;

    // Token bucket state
    private tokens: number;
    private lastRefillTime: number;

    constructor(options?: ConcurrencyOptions) {
        this.concurrency = Math.max(1, options?.concurrency ?? 3);
        this.staggerMs = Math.max(0, options?.staggerMs ?? 30);

        const maxRps = Math.max(1, options?.maxRps ?? 8);
        this.maxTokens = maxRps;
        this.tokens = maxRps;
        this.refillRatePerMs = maxRps / 1000;
        this.lastRefillTime = Date.now();
    }

    /**
     * Enqueues an async task with priority scheduling and rate-limiting.
     */
    async enqueue<T>(task: () => Promise<T>, options?: TaskEnqueueOptions): Promise<T> {
        const priority = options?.priority ?? 0;

        if (this.activeCount >= this.concurrency) {
            await new Promise<void>((resolve) => {
                const item: QueueItem = {run: resolve, priority, enqueuedAt: Date.now()};
                if (this.queue.length === 0 || priority <= this.queue[this.queue.length - 1].priority) {
                    this.queue.push(item);
                } else {
                    const insertIdx = this.queue.findIndex((q) => q.priority < priority);
                    if (insertIdx === -1) {
                        this.queue.push(item);
                    } else {
                        this.queue.splice(insertIdx, 0, item);
                    }
                }
            });
        }

        this.activeCount++;

        // 1. Enforce Token Bucket RPS limit
        await this.acquireToken();

        // 2. Enforce minimum micro-stagger between consecutive dispatches
        if (this.staggerMs > 0) {
            const now = Date.now();
            const timeSinceLast = now - this.lastLaunchTime;
            if (timeSinceLast < this.staggerMs) {
                await new Promise((r) => setTimeout(r, this.staggerMs - timeSinceLast));
            }
            this.lastLaunchTime = Date.now();
        }

        try {
            return await task();
        } finally {
            this.activeCount--;
            if (this.queue.length > 0) {
                const next = this.queue.shift();
                next?.run();
            }
        }
    }

    /** Returns live queue telemetry */
    getMetrics() {
        this.refillTokens();
        return {
            activeCount: this.activeCount,
            queuedCount: this.queue.length,
            availableTokens: Math.round(this.tokens * 10) / 10,
            concurrencyLimit: this.concurrency,
        };
    }

    /**
     * Refills available tokens based on elapsed time.
     */
    private refillTokens(): void {
        const now = Date.now();
        const elapsed = now - this.lastRefillTime;
        if (elapsed > 0) {
            this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRatePerMs);
            this.lastRefillTime = now;
        }
    }

    /**
     * Waits until at least 1 token is available, then consumes 1 token.
     */
    private async acquireToken(): Promise<void> {
        while (true) {
            this.refillTokens();
            if (this.tokens >= 1) {
                this.tokens -= 1;
                return;
            }
            // Wait for time required to generate 1 full token
            const tokensNeeded = 1 - this.tokens;
            const waitMs = Math.ceil(tokensNeeded / this.refillRatePerMs);
            await new Promise((r) => setTimeout(r, Math.max(10, waitMs)));
        }
    }
}

/**
 * Maps an array asynchronously with concurrency limit and micro-staggering.
 * Equivalent to Promise.allSettled but execution is rate-limited and staggered.
 */
export async function mapWithConcurrencyLimit<T, R>(items: T[], fn: (item: T, index: number) => Promise<R>, options?: ConcurrencyOptions): Promise<PromiseSettledResult<R>[]> {
    const queue = new TaskQueue(options);
    return Promise.allSettled(items.map((item, index) => queue.enqueue(() => fn(item, index))));
}
