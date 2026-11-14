import {afterEach, describe, expect, it, vi} from "vitest";
import {
    getCoarsePointerSnapshot,
    getDesktopSnapshot,
    getServerCoarsePointerSnapshot,
    getServerDesktopSnapshot,
    subscribeDesktop,
} from "./useIsDesktop";

describe("useIsDesktop helpers in SSR / Node environment", () => {
    it("getServerDesktopSnapshot returns false for SSR consistency", () => {
        expect(getServerDesktopSnapshot()).toBe(false);
        expect(getServerCoarsePointerSnapshot()).toBe(false);
    });

    it("getDesktopSnapshot returns false when window is undefined", () => {
        expect(getDesktopSnapshot()).toBe(false);
        expect(getCoarsePointerSnapshot()).toBe(false);
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

    it("getDesktopSnapshot falls back to a 1024px desktop breakpoint", () => {
        vi.stubGlobal("window", {
            innerWidth: 1024, addEventListener: vi.fn(), removeEventListener: vi.fn(),
        });
        expect(getDesktopSnapshot()).toBe(true);

        vi.stubGlobal("window", {
            innerWidth: 768, addEventListener: vi.fn(), removeEventListener: vi.fn(),
        });
        expect(getDesktopSnapshot()).toBe(false);
    });

    it("getDesktopSnapshot stays true for wide touch laptops (>= 1024px) to match Tailwind lg:", () => {
        vi.stubGlobal("window", {
            innerWidth: 1092,
            matchMedia: vi.fn((query: string) => ({
                matches: query === "(min-width: 1024px)" || query === "(hover: none) and (pointer: coarse)",
            })),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        });
        expect(getDesktopSnapshot()).toBe(true);
        expect(getCoarsePointerSnapshot()).toBe(true);
    });

    it("getDesktopSnapshot returns false when innerWidth < 1024", () => {
        vi.stubGlobal("window", {
            innerWidth: 767, addEventListener: vi.fn(), removeEventListener: vi.fn(),
        });
        expect(getDesktopSnapshot()).toBe(false);

        vi.stubGlobal("window", {
            innerWidth: 375, addEventListener: vi.fn(), removeEventListener: vi.fn(),
        });
        expect(getDesktopSnapshot()).toBe(false);
    });

    it("subscribeDesktop adds and removes window resize and matchMedia change listeners", () => {
        const addListenerSpy = vi.fn();
        const removeListenerSpy = vi.fn();
        const addMqlSpy = vi.fn();
        const removeMqlSpy = vi.fn();
        vi.stubGlobal("window", {
            innerWidth: 1024,
            matchMedia: vi.fn(() => ({
                matches: true,
                addEventListener: addMqlSpy,
                removeEventListener: removeMqlSpy,
            })),
            addEventListener: addListenerSpy,
            removeEventListener: removeListenerSpy,
        });

        const callback = vi.fn();
        const unsubscribe = subscribeDesktop(callback);

        expect(addListenerSpy).toHaveBeenCalledWith("resize", callback);
        expect(addMqlSpy).toHaveBeenCalledWith("change", callback);

        unsubscribe();
        expect(removeListenerSpy).toHaveBeenCalledWith("resize", callback);
        expect(removeMqlSpy).toHaveBeenCalledWith("change", callback);
    });
});
