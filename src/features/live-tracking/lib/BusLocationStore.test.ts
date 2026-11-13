import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {BusLocationStore, getBusLocationStore} from "./BusLocationStore";

describe("BusLocationStore", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            json: async () => ({
                data: [],
                timestamp: Date.now(),
            }),
        } as Response);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("initializes with default empty state", () => {
        const store = new BusLocationStore(["1001"], "1001");
        const snapshot = store.getSnapshot();

        expect(snapshot.data).toEqual([]);
        expect(snapshot.connectionStatus).toBe("connecting");
        expect(snapshot.hasFetched).toBe(false);
        expect(snapshot.error).toBeNull();
        expect(typeof snapshot.reconnect).toBe("function");
    });

    it("manages subscriptions and triggers listener on state change", () => {
        const store = new BusLocationStore(["1001"], "1001");
        const listener = vi.fn();

        const unsubscribe = store.subscribe(listener);
        expect(typeof unsubscribe).toBe("function");

        // Manually trigger reconnect which updates state
        store.manualReconnect();
        expect(listener).toHaveBeenCalled();

        unsubscribe();
    });

    it("calls batched endpoint when multiple routeIds are provided", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true, json: async () => ({
                data: [{
                    routeid: "1001", vehicleno: "1234", nodenm: "Stop A", gpslati: 37.34, gpslong: 127.92
                }, {routeid: "1002", vehicleno: "5678", nodenm: "Stop B", gpslati: 37.35, gpslong: 127.93},],
                timestamp: Date.now(),
            }),
        } as Response);

        const store = new BusLocationStore(["1001", "1002"], "1001,1002");
        store.manualReconnect();
        await vi.advanceTimersByTimeAsync(50);

        expect(fetchSpy).toHaveBeenCalledWith(
            "/api/bus?routeIds=1001%2C1002&cityCode=32020",
            expect.objectContaining({headers: {Accept: "application/json"}})
        );

        const snapshot = store.getSnapshot();
        expect(snapshot.data.length).toBe(2);
        expect(snapshot.connectionStatus).toBe("connected");
    });

    it("returns cached store instance for identical route key and isolates by cityCode", () => {
        const store1 = getBusLocationStore("route-30", "32020");
        const store2 = getBusLocationStore("route-30", "32020");
        const storeOtherCity = getBusLocationStore("route-30", "32010");

        expect(store1).toBe(store2);
        expect(store1).not.toBe(storeOtherCity);
    });

    it("falls back to individual route requests when batch fetch fails", async () => {
        vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
            const url = String(input);
            if (url.startsWith("/api/bus?routeIds=")) {
                return {ok: false, status: 502} as Response;
            }
            return {
                ok: true,
                json: async () => ({
                    data: [{
                        routeid: "1001",
                        vehicleno: "9999",
                        nodenm: "Stop Fallback",
                        gpslati: 37.34,
                        gpslong: 127.92
                    }],
                    timestamp: Date.now(),
                }),
            } as Response;
        });

        const store = new BusLocationStore(["1001", "1002"], "1001,1002", "32020");
        store.manualReconnect();
        await vi.advanceTimersByTimeAsync(150);

        const snapshot = store.getSnapshot();
        expect(snapshot.hasFetched).toBe(true);
        expect(snapshot.data.length).toBeGreaterThan(0);
    });

    it("removes both online and offline event listeners on final unsubscribe", () => {
        const addSpy = vi.fn();
        const removeSpy = vi.fn();
        const docAddSpy = vi.fn();
        const docRemoveSpy = vi.fn();

        vi.stubGlobal("window", {
            addEventListener: addSpy,
            removeEventListener: removeSpy,
        });
        vi.stubGlobal("document", {
            hidden: false,
            addEventListener: docAddSpy,
            removeEventListener: docRemoveSpy,
        });

        try {
            const store = new BusLocationStore(["1001"], "unsub-test", "32020");
            const unsubscribe = store.subscribe(() => undefined);

            expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function));
            expect(addSpy).toHaveBeenCalledWith("offline", expect.any(Function));
            expect(docAddSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));

            unsubscribe();

            expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));
            expect(removeSpy).toHaveBeenCalledWith("offline", expect.any(Function));
            expect(docRemoveSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it("chunks routeIds into batches of 15 when more than 15 routes are subscribed", async () => {
        const requestedUrls: string[] = [];
        vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
            requestedUrls.push(String(input));
            return {
                ok: true,
                json: async () => ({
                    data: [{
                        routeid: "R01", vehicleno: "1111", nodenm: "Stop 1", gpslati: 37.34, gpslong: 127.92,
                    }],
                    timestamp: Date.now(),
                    meta: {status: "hit", layer: "memory", ageMs: 1250},
                }),
            } as Response;
        });

        const twentyIds = Array.from({length: 20}, (_, i) => `R${String(i + 1).padStart(2, "0")}`);
        const store = new BusLocationStore(twentyIds, twentyIds.join(","), "32020");
        store.manualReconnect();
        await vi.advanceTimersByTimeAsync(50);

        const batchCalls = requestedUrls.filter((u) => u.startsWith("/api/bus?routeIds="));
        expect(batchCalls).toHaveLength(2);
        expect(decodeURIComponent(batchCalls[0])).toContain("R15");
        expect(decodeURIComponent(batchCalls[0])).not.toContain("R16");
        expect(decodeURIComponent(batchCalls[1])).toContain("R16");
        expect(decodeURIComponent(batchCalls[1])).toContain("R20");
        expect(store.getSnapshot().serverAgeMs).toBe(1250);
    });
});
