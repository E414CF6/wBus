import type {BusItem} from "@entities/bus/types";
import {API_CONFIG} from "@shared/config/env";
import type {CachedData} from "@shared/cache";
import {mapWithConcurrencyLimit} from "@shared/utils/concurrency";
import {type BusLocationState, EMPTY_BUS_LIST, EMPTY_STATE, type Listener,} from "../model/types";

const fetchRouteData = async (url: string, signal?: AbortSignal): Promise<CachedData<BusItem[]>> => {
    const res = await fetch(url, {
        headers: {
            Accept: "application/json",
        },
        ...(signal ? {signal} : {}),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};

/**
 * BusLocationStore
 * High-performance real-time telemetry store backed by CDN micro-caching (s-maxage=10s).
 * Replaces fragile Serverless SSE with deterministic, edge-coalesced polling.
 */
export class BusLocationStore {
    public dataLength = 0;
    private readonly routeIds: string[];
    private readonly routeIdsKey: string;
    private readonly cityCode: string;
    private state: BusLocationState;
    private listeners = new Set<Listener>();
    private pollTimer: ReturnType<typeof setTimeout> | null = null;
    private isPollingActive = false;
    private consecutiveErrors = 0;
    private serverSuggestedDelayMs: number | null = null;
    private abortController: AbortController | null = null;
    private isFetching = false;
    private isSuspended = false;
    private routeDataMap = new Map<string, BusItem[]>();

    constructor(routeIds: string[], routeIdsKey: string, cityCode: string = "32020") {
        this.routeIds = routeIds;
        this.routeIdsKey = routeIdsKey;
        this.cityCode = cityCode;
        this.state = {
            ...EMPTY_STATE,
            reconnect: () => this.manualReconnect(),
        };
    }

    getSnapshot = () => this.state;

    subscribe = (listener: Listener) => {
        this.listeners.add(listener);
        if (this.listeners.size === 1) {
            this.registerEventListeners();
            this.start();
        }
        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size === 0) {
                this.unregisterEventListeners();
                this.stop();
                busLocationStores.delete(this.routeIdsKey);
            }
        };
    };

    public manualReconnect = () => {
        this.abortInflight();
        this.routeDataMap.clear();
        this.stopPolling();
        this.consecutiveErrors = 0;
        this.serverSuggestedDelayMs = null;
        this.isSuspended = false;
        this.updateState({connectionStatus: "connecting"});
        this.isPollingActive = true;
        void this.runPollCycle();
    };

    public restartPollingIfActive() {
        if (!this.isPollingActive || this.isSuspended) return;
        this.clearPollTimer();
        this.scheduleNextPoll();
    }

    public getCurrentPollDelayMs(): number {
        return this.computeNextDelayMs();
    }

    private abortInflight() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.isFetching = false;
    }

    private emit() {
        for (const listener of this.listeners) {
            listener();
        }
    }

    private setState(next: BusLocationState) {
        this.state = next;
        this.emit();
    }

    private updateState(partial: Partial<BusLocationState>) {
        this.setState({
            ...this.state,
            ...partial,
            reconnect: this.state.reconnect,
        });
    }

    private applyData(
        nextData: BusItem[],
        options?: {
            degraded?: boolean;
            timestamp?: number;
            ageMs?: number | null;
            targetRouteIds?: string[];
        }
    ) {
        const degraded = options?.degraded ?? false;
        const timestamp = options?.timestamp ?? Date.now();
        const targetRouteIds = options?.targetRouteIds ?? this.routeIds;

        const incomingByRouteId = new Map<string, BusItem[]>();
        for (const item of nextData) {
            const rid = item.routeid;
            if (rid) {
                const list = incomingByRouteId.get(rid) ?? [];
                list.push(item);
                incomingByRouteId.set(rid, list);
            }
        }

        for (const rid of targetRouteIds) {
            const items = incomingByRouteId.get(rid) ?? [];
            this.routeDataMap.set(rid, items);
        }

        let finalData: BusItem[] = [];
        for (const items of this.routeDataMap.values()) {
            finalData.push(...items);
        }

        if (
            finalData.length === 0 &&
            (degraded || this.state.isDegraded) &&
            this.state.data.length > 0
        ) {
            finalData = this.state.data;
        }

        this.dataLength = finalData.length;
        this.setState({
            ...this.state,
            data: finalData,
            error:
                finalData.length === 0 ? (degraded ? "ERR:NETWORK" : "ERR:NONE_RUNNING") : null,
            hasFetched: true,
            connectionStatus: degraded ? "fallback" : "connected",
            lastUpdated: timestamp,
            serverAgeMs: typeof options?.ageMs === "number" && Number.isFinite(options.ageMs) ? options.ageMs : null,
            isDegraded: degraded,
            reconnect: this.state.reconnect,
        });
    }

    private async fetchLocations() {
        if (this.isFetching || this.routeIds.length === 0) return;
        this.isFetching = true;
        const controller = new AbortController();
        this.abortController = controller;
        const {signal} = controller;

        try {
            const cityParam = `cityCode=${encodeURIComponent(this.cityCode)}`;
            if (this.routeIds.length === 1) {
                // Single route direct call
                const routeId = this.routeIds[0];
                const res = await fetchRouteData(`/api/bus/${routeId}?${cityParam}`, signal);
                if (signal.aborted) return;
                const items = Array.isArray(res.data) ? res.data : [];
                this.consecutiveErrors = 0;
                this.serverSuggestedDelayMs = this.resolvePollHintDelayMs([res.meta]);
                this.applyData(items, {
                    degraded: Boolean(res.meta?.degraded),
                    timestamp: res.timestamp,
                    ageMs: res.meta?.ageMs ?? null,
                    targetRouteIds: [routeId],
                });
            } else {
                // Multi-route batched call: split into chunks of 15 to match /api/bus limit
                const BATCH_CHUNK_SIZE = 15;
                const chunks: string[][] = [];
                for (let i = 0; i < this.routeIds.length; i += BATCH_CHUNK_SIZE) {
                    chunks.push(this.routeIds.slice(i, i + BATCH_CHUNK_SIZE));
                }

                try {
                    const chunkResponses = await Promise.all(
                        chunks.map((chunk) =>
                            fetchRouteData(
                                `/api/bus?routeIds=${encodeURIComponent(chunk.join(","))}&${cityParam}`,
                                signal
                            )
                        )
                    );
                    if (signal.aborted) return;

                    const items: BusItem[] = [];
                    let anyDegraded = false;
                    let latestTimestamp = 0;
                    let maxAgeMs: number | null = null;
                    const metas: Array<CachedData<BusItem[]>["meta"]> = [];

                    for (const res of chunkResponses) {
                        if (Array.isArray(res.data)) {
                            items.push(...res.data);
                        }
                        if (res.meta?.degraded) {
                            anyDegraded = true;
                        }
                        if (typeof res.timestamp === "number" && res.timestamp > latestTimestamp) {
                            latestTimestamp = res.timestamp;
                        }
                        if (typeof res.meta?.ageMs === "number" && Number.isFinite(res.meta.ageMs)) {
                            maxAgeMs = maxAgeMs === null ? res.meta.ageMs : Math.max(maxAgeMs, res.meta.ageMs);
                        }
                        metas.push(res.meta);
                    }

                    this.consecutiveErrors = 0;
                    this.serverSuggestedDelayMs = this.resolvePollHintDelayMs(metas);
                    this.applyData(items, {
                        degraded: anyDegraded,
                        timestamp: latestTimestamp || Date.now(),
                        ageMs: maxAgeMs,
                        targetRouteIds: this.routeIds,
                    });
                } catch (batchErr) {
                    if (signal.aborted) return;
                    console.warn("[BusLocationStore] Batch fetch failed, falling back to concurrent individual requests:", batchErr);
                    // Resilient fallback: Query each route individually
                    const settled = await mapWithConcurrencyLimit(
                        this.routeIds,
                        (routeId) => fetchRouteData(`/api/bus/${routeId}?${cityParam}`, signal),
                        {
                            concurrency: 3,
                            staggerMs: 30,
                        }
                    );
                    if (signal.aborted) return;

                    const fulfilledResults: BusItem[] = [];
                    const fulfilledRouteIds: string[] = [];
                    let hasFailures = false;
                    let maxAgeMs: number | null = null;
                    const metas: Array<CachedData<BusItem[]>["meta"]> = [];

                    settled.forEach((result, idx) => {
                        const routeId = this.routeIds[idx];
                        if (result.status === "fulfilled") {
                            fulfilledRouteIds.push(routeId);
                            const items = result.value.data;
                            if (Array.isArray(items)) {
                                fulfilledResults.push(...items);
                            }
                            const ageMs = result.value.meta?.ageMs;
                            if (typeof ageMs === "number" && Number.isFinite(ageMs)) {
                                maxAgeMs = maxAgeMs === null ? ageMs : Math.max(maxAgeMs, ageMs);
                            }
                            metas.push(result.value.meta);
                        } else {
                            hasFailures = true;
                        }
                    });

                    if (fulfilledRouteIds.length > 0) {
                        this.consecutiveErrors = hasFailures ? this.consecutiveErrors + 1 : 0;
                        this.serverSuggestedDelayMs = this.resolvePollHintDelayMs(metas);
                        this.applyData(fulfilledResults, {
                            degraded: hasFailures,
                            ageMs: maxAgeMs,
                            targetRouteIds: fulfilledRouteIds,
                        });
                    } else if (this.routeIds.length > 0) {
                        throw new Error("All route location requests failed", {cause: batchErr});
                    }
                }
            }
        } catch (err) {
            if (signal.aborted) return;
            this.consecutiveErrors += 1;
            console.error("[useBusLocationData] Micro-cache fetch failed", err);
            if (this.state.data.length === 0) {
                this.setState({
                    ...this.state,
                    data: EMPTY_BUS_LIST,
                    error: "ERR:NETWORK",
                    hasFetched: true,
                    connectionStatus: "fallback",
                    isDegraded: true,
                    reconnect: this.state.reconnect,
                });
            } else {
                this.updateState({
                    isDegraded: true,
                    connectionStatus: "fallback",
                });
            }
        } finally {
            if (this.abortController === controller) {
                this.abortController = null;
                this.isFetching = false;
            }
        }
    }

    private resolvePollHintDelayMs(metas: Array<CachedData<BusItem[]>["meta"]>): number | null {
        const validMetas = metas.filter((m): m is NonNullable<CachedData<BusItem[]>["meta"]> => Boolean(m));
        if (validMetas.length === 0) return null;
        // If any route is actively in service, use normal fast polling
        if (validMetas.some((m) => m.inService === true)) {
            return null;
        }
        const hints = validMetas
            .map((m) => (typeof m.nextPollAfterMs === "number" && Number.isFinite(m.nextPollAfterMs) ? m.nextPollAfterMs : null))
            .filter((n): n is number => n !== null && n > 0);
        if (hints.length > 0) {
            return Math.min(180_000, Math.max(globalPollingIntervalMs, Math.min(...hints)));
        }
        if (validMetas.every((m) => m.inService === false)) {
            return Math.min(180_000, Math.max(globalPollingIntervalMs, 60_000));
        }
        return null;
    }

    private computeNextDelayMs(): number {
        if (this.consecutiveErrors > 0) {
            return Math.min(60_000, globalPollingIntervalMs * 2 ** Math.min(this.consecutiveErrors, 3));
        }
        if (this.serverSuggestedDelayMs !== null && this.serverSuggestedDelayMs > globalPollingIntervalMs) {
            return this.serverSuggestedDelayMs;
        }
        return globalPollingIntervalMs;
    }

    private clearPollTimer() {
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
    }

    private scheduleNextPoll() {
        if (!this.isPollingActive || this.isSuspended) return;
        this.clearPollTimer();
        const delayMs = this.computeNextDelayMs();
        this.pollTimer = setTimeout(() => {
            this.pollTimer = null;
            void this.runPollCycle();
        }, delayMs);
    }

    private async runPollCycle() {
        if (!this.isPollingActive || this.isSuspended) return;
        await this.fetchLocations();
        this.scheduleNextPoll();
    }

    private stopPolling() {
        this.isPollingActive = false;
        this.clearPollTimer();
    }

    private handleActivityChange = () => {
        if (typeof document === "undefined") return;
        const isVisible = document.visibilityState === "visible";
        const isOnline = typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" ? navigator.onLine : true;

        if (isVisible && isOnline) {
            if (this.isSuspended) {
                this.isSuspended = false;
                this.consecutiveErrors = 0;
                this.updateState({connectionStatus: "connected"});
                this.isPollingActive = true;
                void this.runPollCycle();
            }
        } else {
            if (!this.isSuspended) {
                this.isSuspended = true;
                this.abortInflight();
                this.stopPolling();
                this.updateState({connectionStatus: "suspended"});
            }
        }
    };

    private registerEventListeners() {
        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", this.handleActivityChange);
        }
        if (typeof window !== "undefined") {
            window.addEventListener("online", this.handleActivityChange);
            window.addEventListener("offline", this.handleActivityChange);
        }
    }

    private unregisterEventListeners() {
        if (typeof document !== "undefined") {
            document.removeEventListener("visibilitychange", this.handleActivityChange);
        }
        if (typeof window !== "undefined") {
            window.removeEventListener("online", this.handleActivityChange);
            window.removeEventListener("offline", this.handleActivityChange);
        }
    }

    private start() {
        if (this.routeIds.length === 0) {
            this.setState(EMPTY_STATE);
            return;
        }

        const isVisible =
            typeof document !== "undefined" ? document.visibilityState === "visible" : true;
        const isOnline = typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" ? navigator.onLine : true;

        if (!isVisible || !isOnline) {
            this.isSuspended = true;
            this.updateState({connectionStatus: "suspended"});
            return;
        }

        this.isSuspended = false;
        this.consecutiveErrors = 0;
        this.updateState({connectionStatus: "connecting"});
        this.isPollingActive = true;
        void this.runPollCycle();
    }

    private stop() {
        this.abortInflight();
        this.stopPolling();
        this.isSuspended = false;
        this.state = EMPTY_STATE;
    }
}

let globalPollingIntervalMs: number = API_CONFIG.LIVE.POLLING_INTERVAL_MS;

const busLocationStores = new Map<string, BusLocationStore>();

/**
 * Updates the global live-tracking polling interval for all active and future BusLocationStore instances.
 */
export function setGlobalBusPollingIntervalMs(intervalMs: number): void {
    if (!Number.isFinite(intervalMs) || intervalMs < 1000) return;
    if (globalPollingIntervalMs === intervalMs) return;
    globalPollingIntervalMs = intervalMs;
    for (const store of busLocationStores.values()) {
        store.restartPollingIfActive();
    }
}

export function getBusLocationStore(routeIdsKey: string, cityCode: string = "32020"): BusLocationStore {
    const fullKey = `${cityCode}:${routeIdsKey}`;
    const existing = busLocationStores.get(fullKey);
    if (existing) return existing;
    const routeIds = routeIdsKey.split(",").filter(Boolean);
    const store = new BusLocationStore(routeIds, fullKey, cityCode);
    busLocationStores.set(fullKey, store);
    return store;
}
