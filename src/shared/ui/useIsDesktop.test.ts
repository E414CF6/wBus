import {afterEach, describe, expect, it, vi} from "vitest";
import {getDesktopSnapshot, getServerDesktopSnapshot, subscribeDesktop} from "./useIsDesktop";

describe("useIsDesktop helpers in SSR / Node environment", () => {
    it("getServerDesktopSnapshot returns false for SSR consistency", () => {
        expect(getServerDesktopSnapshot()).toBe(false);
    });

    it("getDesktopSnapshot returns false when window is undefined", () => {
        expect(getDesktopSnapshot()).toBe(false);
    });

    it("subscribeDesktop returns a no-op function when window is undefined", () => {
        const unsubscribe = subscribeDesktop(() => {
        });
        expect(typeof unsubscribe).toBe("function");
        expect(() => unsubscribe()).not.toThrow();
    });
});

describe("useIsDesktop helpers in browser environment", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("getDesktopSnapshot returns true when innerWidth >= 768", () => {
        vi.stubGlobal("window", {
            innerWidth: 1024, addEventListener: vi.fn(), removeEventListener: vi.fn(),
        });
        expect(getDesktopSnapshot()).toBe(true);

        vi.stubGlobal("window", {
            innerWidth: 768, addEventListener: vi.fn(), removeEventListener: vi.fn(),
        });
        expect(getDesktopSnapshot()).toBe(true);
    });

    it("getDesktopSnapshot returns false when innerWidth < 768", () => {
        vi.stubGlobal("window", {
            innerWidth: 767, addEventListener: vi.fn(), removeEventListener: vi.fn(),
        });
        expect(getDesktopSnapshot()).toBe(false);

        vi.stubGlobal("window", {
            innerWidth: 375, addEventListener: vi.fn(), removeEventListener: vi.fn(),
        });
        expect(getDesktopSnapshot()).toBe(false);
    });

    it("subscribeDesktop adds and removes window resize listener", () => {
        const addListenerSpy = vi.fn();
        const removeListenerSpy = vi.fn();
        vi.stubGlobal("window", {
            innerWidth: 1024, addEventListener: addListenerSpy, removeEventListener: removeListenerSpy,
        });

        const callback = vi.fn();
        const unsubscribe = subscribeDesktop(callback);

        expect(addListenerSpy).toHaveBeenCalledWith("resize", callback);

        unsubscribe();
        expect(removeListenerSpy).toHaveBeenCalledWith("resize", callback);
    });
});
