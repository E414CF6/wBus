import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {BusLocationStore, getBusLocationStore} from "./BusLocationStore";

describe("BusLocationStore", () => {
    beforeEach(() => {
        vi.useFakeTimers();
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

        expect(fetchSpy).toHaveBeenCalledWith("/api/bus?routeIds=1001%2C1002", expect.objectContaining({headers: {Accept: "application/json"}}));

        const snapshot = store.getSnapshot();
        expect(snapshot.data.length).toBe(2);
        expect(snapshot.connectionStatus).toBe("connected");
    });

    it("returns cached store instance for identical route key", () => {
        const store1 = getBusLocationStore("route-30");
        const store2 = getBusLocationStore("route-30");

        expect(store1).toBe(store2);
    });
});
