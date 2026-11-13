import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {getHapticEnabled, setHapticEnabled, triggerHaptic} from "./haptics";

describe("triggerHaptic", () => {
    let mockVibrate: ReturnType<typeof vi.fn>;
    let mockMatchMedia: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockVibrate = vi.fn().mockReturnValue(true);
        mockMatchMedia = vi.fn().mockReturnValue({
            matches: false,
            addListener: vi.fn(),
            removeListener: vi.fn(),
        });

        vi.stubGlobal("window", {
            matchMedia: mockMatchMedia,
        });

        vi.stubGlobal("navigator", {
            vibrate: mockVibrate,
        });
    });

    afterEach(() => {
        setHapticEnabled(true);
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("returns false if navigator.vibrate is undefined", () => {
        vi.stubGlobal("navigator", {});
        const result = triggerHaptic("light");
        expect(result).toBe(false);
    });

    it("triggers vibrate with correct duration for light haptic", () => {
        const result = triggerHaptic("light");
        expect(result).toBe(true);
        expect(mockVibrate).toHaveBeenCalledWith(8);
    });

    it("triggers vibrate with correct pattern for success haptic", () => {
        const result = triggerHaptic("success");
        expect(result).toBe(true);
        expect(mockVibrate).toHaveBeenCalledWith([10, 30, 12]);
    });

    it("returns false and does not vibrate if prefers-reduced-motion is true", () => {
        mockMatchMedia.mockReturnValue({
            matches: true,
            addListener: vi.fn(),
            removeListener: vi.fn(),
        });

        const result = triggerHaptic("medium");
        expect(result).toBe(false);
        expect(mockVibrate).not.toHaveBeenCalled();
    });

    it("catches errors silently and returns false when vibrate throws an exception", () => {
        mockVibrate.mockImplementation(() => {
            throw new Error("SecurityError: vibrate not allowed");
        });

        expect(() => triggerHaptic("heavy")).not.toThrow();
        expect(triggerHaptic("heavy")).toBe(false);
    });

    it("returns false and does not vibrate when haptic feedback is disabled", () => {
        setHapticEnabled(false);
        expect(getHapticEnabled()).toBe(false);
        expect(triggerHaptic("light")).toBe(false);
        expect(mockVibrate).not.toHaveBeenCalled();
    });
});
