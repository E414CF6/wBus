/**
 * Concurrency & Staggering Utilities for Outbound API Requests
 *
 * Prevents API throttling (429), socket timeouts, and tail latency
 * caused by sending too many simultaneous requests to public data portals.
 */

export interface ConcurrencyOptions {
    /** Maximum number of parallel executions (default: 3) */
    concurrency?: number;
    /** Delay in milliseconds between launching consecutive tasks (default: 40) */
    staggerMs?: number;
}

/**
 * Task Queue to throttle and stagger asynchronous tasks.
 */
export class TaskQueue {
    private readonly concurrency: number;
    private readonly staggerMs: number;
    private activeCount = 0;
    private queue: (() => void)[] = [];
    private lastLaunchTime = 0;

    constructor(options?: ConcurrencyOptions) {
        this.concurrency = Math.max(1, options?.concurrency ?? 3);
        this.staggerMs = Math.max(0, options?.staggerMs ?? 40);
    }

    async enqueue<T>(task: () => Promise<T>): Promise<T> {
        if (this.activeCount >= this.concurrency) {
            await new Promise<void>((resolve) => {
                this.queue.push(resolve);
            });
        }

        this.activeCount++;

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
                next?.();
            }
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
