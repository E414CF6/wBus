import type {BusItem} from "@entities/bus/types";
import {API_CONFIG} from "@shared/config/env";
import type {CachedData} from "@shared/cache";
import {mapWithConcurrencyLimit} from "@shared/utils/concurrency";
import {type BusLocationState, EMPTY_BUS_LIST, EMPTY_STATE, type Listener,} from "../model/types";

const fetchRouteData = async (url: string): Promise<CachedData<BusItem[]>> => {
    const res = await fetch(url, {
        headers: {
            Accept: "application/json",
        },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
};

/**
 * BusLocationStore
 * High-performance real-time telemetry store backed by CDN micro-caching (s-maxage=2s).
 * Replaces fragile Serverless SSE with deterministic, edge-coalesced polling.
 */
export class BusLocationStore {
    public dataLength = 0;
    private readonly routeIds: string[];
    private readonly routeIdsKey: string;
    private state: BusLocationState;
    private listeners = new Set<Listener>();
    private pollInterval: ReturnType<typeof setInterval> | null = null;
    private isFetching = false;
    private isSuspended = false;
    private routeDataMap = new Map<string, BusItem[]>();

    constructor(routeIds: string[], routeIdsKey: string) {
        this.routeIds = routeIds;
        this.routeIdsKey = routeIdsKey;
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
        this.routeDataMap.clear();
        this.stopPolling();
        this.isSuspended = false;
        this.updateState({connectionStatus: "connecting"});
        void this.fetchLocations();
        this.startPolling();
    };

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
            isDegraded: degraded,
            reconnect: this.state.reconnect,
        });
    }

    private async fetchLocations() {
        if (this.isFetching || this.routeIds.length === 0) return;
        this.isFetching = true;

        try {
            const settled = await mapWithConcurrencyLimit(
                this.routeIds,
                (routeId) => fetchRouteData(`/api/bus/${routeId}`),
                {
                    concurrency: 3,
                    staggerMs: 30,
                }
            );

            const fulfilledResults: BusItem[] = [];
            const fulfilledRouteIds: string[] = [];
            let hasFailures = false;

            settled.forEach((result, idx) => {
                const routeId = this.routeIds[idx];
                if (result.status === "fulfilled") {
                    fulfilledRouteIds.push(routeId);
                    const items = result.value.data;
                    if (Array.isArray(items)) {
                        fulfilledResults.push(...items);
                    }
                } else {
                    hasFailures = true;
                }
            });

            if (fulfilledRouteIds.length > 0) {
                this.applyData(fulfilledResults, {
                    degraded: hasFailures,
                    targetRouteIds: fulfilledRouteIds,
                });
            } else if (this.routeIds.length > 0) {
                throw new Error("All route location requests failed");
            }
        } catch (err) {
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
            this.isFetching = false;
        }
    }

    private startPolling() {
        if (this.pollInterval) return;
        this.pollInterval = setInterval(() => {
            void this.fetchLocations();
        }, API_CONFIG.LIVE.POLLING_INTERVAL_MS);
    }

    private stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    private handleActivityChange = () => {
        if (typeof document === "undefined") return;
        const isVisible = document.visibilityState === "visible";
        const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

        if (isVisible && isOnline) {
            if (this.isSuspended) {
                this.isSuspended = false;
                this.updateState({connectionStatus: "connected"});
                void this.fetchLocations();
                this.startPolling();
            }
        } else {
            if (!this.isSuspended) {
                this.isSuspended = true;
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
        const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

        if (!isVisible || !isOnline) {
            this.isSuspended = true;
            this.updateState({connectionStatus: "suspended"});
            return;
        }

        this.isSuspended = false;
        this.updateState({connectionStatus: "connecting"});
        void this.fetchLocations();
        this.startPolling();
    }

    private stop() {
        this.stopPolling();
        this.isFetching = false;
        this.isSuspended = false;
        this.state = EMPTY_STATE;
    }
}

const busLocationStores = new Map<string, BusLocationStore>();

export function getBusLocationStore(routeIdsKey: string): BusLocationStore {
    const existing = busLocationStores.get(routeIdsKey);
    if (existing) return existing;
    const routeIds = routeIdsKey.split(",").filter(Boolean);
    const store = new BusLocationStore(routeIds, routeIdsKey);
    busLocationStores.set(routeIdsKey, store);
    return store;
}
