import {after} from "next/server";

/**
 * Registers a fire-and-forget background promise with Next.js `after()` when executing
 * inside a request lifecycle so Vercel Serverless Functions do not freeze or abort
 * in-flight L2 Redis writes, Blob uploads, or SWR revalidations after returning the response.
 * Safely degrades to standard async execution outside request scopes (tests, scripts).
 */
export function trackBackgroundPromise(promise: Promise<unknown>): void {
    const guarded = promise.catch((err) => {
        console.warn("[BackgroundTask] Unhandled background error:", err);
    });

    try {
        after(() => guarded);
    } catch {
        // Outside Next.js request scope (Vitest, CLI scripts, build time): promise already runs normally.
    }
}

export function runInBackground(task: () => Promise<unknown>): void {
    trackBackgroundPromise(Promise.resolve().then(task));
}
