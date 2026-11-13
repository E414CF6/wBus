import {describe, expect, it, vi} from "vitest";
import {applyThemePreference} from "./themeUtils";

describe("applyThemePreference", () => {
    it("calls setTheme with the requested theme preference", () => {
        const setTheme = vi.fn();
        applyThemePreference("dark", setTheme);
        expect(setTheme).toHaveBeenCalledWith("dark");

        applyThemePreference("light", setTheme);
        expect(setTheme).toHaveBeenCalledWith("light");

        applyThemePreference("system", setTheme);
        expect(setTheme).toHaveBeenCalledWith("system");
    });
});
