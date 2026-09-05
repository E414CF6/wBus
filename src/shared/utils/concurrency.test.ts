import {describe, expect, it} from "vitest";
import {mapWithConcurrencyLimit, TaskQueue} from "./concurrency";

describe("concurrency & TaskQueue", () => {
    it("respects concurrency limits", async () => {
        const queue = new TaskQueue({concurrency: 2, staggerMs: 0, maxRps: 50});
        let active = 0;
        let maxObservedActive = 0;

        const task = async () => {
            active++;
            maxObservedActive = Math.max(maxObservedActive, active);
            await new Promise((resolve) => setTimeout(resolve, 25));
            active--;
            return true;
        };

        await Promise.all([
            queue.enqueue(task),
            queue.enqueue(task),
            queue.enqueue(task),
            queue.enqueue(task),
            queue.enqueue(task),
        ]);

        expect(maxObservedActive).toBeLessThanOrEqual(2);
    });

    it("executes tasks in priority order", async () => {
        const queue = new TaskQueue({concurrency: 1, staggerMs: 0, maxRps: 100});
        const order: number[] = [];

        // Fill active slot
        const blocker = queue.enqueue(async () => {
            await new Promise((resolve) => setTimeout(resolve, 30));
            order.push(0);
        });

        // Enqueue with varying priorities while blocked
        const p1 = queue.enqueue(async () => order.push(10), {priority: 10});
        const p2 = queue.enqueue(async () => order.push(99), {priority: 99}); // highest
        const p3 = queue.enqueue(async () => order.push(50), {priority: 50});

        await Promise.all([blocker, p1, p2, p3]);

        // Blocker runs first, then priority 99, 50, 10
        expect(order).toEqual([0, 99, 50, 10]);
    });

    it("settles all tasks via mapWithConcurrencyLimit", async () => {
        const items = [1, 2, 3, 4, 5];
        const results = await mapWithConcurrencyLimit(
            items,
            async (item) => item * 2,
            {concurrency: 2, staggerMs: 5}
        );

        expect(results).toHaveLength(5);
        expect(results.every((r) => r.status === "fulfilled")).toBe(true);

        const values = results.map((r) => (r.status === "fulfilled" ? r.value : null));
        expect(values).toEqual([2, 4, 6, 8, 10]);
    });
});
