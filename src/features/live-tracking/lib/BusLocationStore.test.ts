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

    it("returns cached store instance for identical route key", () => {
        const store1 = getBusLocationStore("route-30");
        const store2 = getBusLocationStore("route-30");

        expect(store1).toBe(store2);
    });
});
