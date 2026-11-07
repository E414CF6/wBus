import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {STORAGE_KEYS} from "@shared/config/env";
import {
    getFavoriteCityCodesFromStorage,
    saveFavoriteCityCodesToStorage,
    toggleCityCodeInList,
} from "./hooks";

describe("Favorite cities storage helpers", () => {
    let store: Record<string, string> = {};

    beforeEach(() => {
        store = {};
        const mockStorage: Storage = {
            getItem: vi.fn((k: string) => store[k] ?? null),
            setItem: vi.fn((k: string, v: string) => {
                store[k] = v;
            }),
            removeItem: vi.fn((k: string) => {
                delete store[k];
            }),
            clear: vi.fn(() => {
                store = {};
            }),
            key: vi.fn((idx: number) => Object.keys(store)[idx] ?? null),
            get length() {
                return Object.keys(store).length;
            },
        };
        vi.stubGlobal("window", {localStorage: mockStorage});
        vi.stubGlobal("localStorage", mockStorage);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("starts with empty list when localStorage is empty", () => {
        expect(getFavoriteCityCodesFromStorage()).toEqual([]);
    });

    it("restores previously stored favorite cities from localStorage", () => {
        localStorage.setItem(STORAGE_KEYS.FAVORITE_CITIES, JSON.stringify(["11", "21"]));
        expect(getFavoriteCityCodesFromStorage()).toEqual(["11", "21"]);
    });

    it("handles invalid JSON gracefully", () => {
        localStorage.setItem(STORAGE_KEYS.FAVORITE_CITIES, "invalid json");
        expect(getFavoriteCityCodesFromStorage()).toEqual([]);
    });

    it("saves favorite city codes to localStorage", () => {
        saveFavoriteCityCodesToStorage(["11", "32020"]);
        expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITE_CITIES) || "[]")).toEqual(["11", "32020"]);
    });

    it("toggles city code in array correctly", () => {
        const initial = ["11", "21"];
        // Toggle remove
        const without11 = toggleCityCodeInList(initial, "11");
        expect(without11).toEqual(["21"]);

        // Toggle add
        const with32020 = toggleCityCodeInList(without11, "32020");
        expect(with32020).toEqual(["21", "32020"]);
    });
});
