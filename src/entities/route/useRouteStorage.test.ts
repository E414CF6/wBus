import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {
    EMPTY_DEFAULT_BOOKMARKS,
    loadBookmarksFromStorage,
    loadRecentRoutesFromStorage,
    toggleBookmarkInList,
    updateRecentRoutesList,
    WONJU_DEFAULT_BOOKMARKS,
} from "./useRouteStorage";

describe("useRouteStorage pure helpers", () => {
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

    describe("loadBookmarksFromStorage", () => {
        it("returns fallback when storage is empty", () => {
            const result = loadBookmarksFromStorage("test_key", WONJU_DEFAULT_BOOKMARKS);
            expect(result).toEqual(["30", "34", "34-1"]);
        });

        it("loads valid json bookmarks from storage", () => {
            localStorage.setItem("test_key", JSON.stringify(["51", "100"]));
            const result = loadBookmarksFromStorage("test_key", EMPTY_DEFAULT_BOOKMARKS);
            expect(result).toEqual(["51", "100"]);
        });

        it("returns fallback when json is malformed", () => {
            localStorage.setItem("test_key", "invalid json");
            const result = loadBookmarksFromStorage("test_key", WONJU_DEFAULT_BOOKMARKS);
            expect(result).toEqual(WONJU_DEFAULT_BOOKMARKS);
        });
    });

    describe("toggleBookmarkInList", () => {
        it("adds route to bookmarks if not present", () => {
            const updated = toggleBookmarkInList(["30", "34"], "34-1");
            expect(updated).toEqual(["30", "34", "34-1"]);
        });

        it("removes route from bookmarks if already present", () => {
            const updated = toggleBookmarkInList(["30", "34", "34-1"], "34");
            expect(updated).toEqual(["30", "34-1"]);
        });
    });

    describe("loadRecentRoutesFromStorage", () => {
        it("returns empty array when storage is empty", () => {
            expect(loadRecentRoutesFromStorage("recent_key")).toEqual([]);
        });

        it("parses stored recent routes properly", () => {
            localStorage.setItem("recent_key", JSON.stringify(["30", "51"]));
            expect(loadRecentRoutesFromStorage("recent_key")).toEqual(["30", "51"]);
        });
    });

    describe("updateRecentRoutesList", () => {
        it("prepends route to front and limits count", () => {
            const initial = ["34", "51", "100", "2", "3", "4"];
            const next = updateRecentRoutesList(initial, "30", 6);
            expect(next[0]).toBe("30");
            expect(next.length).toBe(6);
        });

        it("moves existing route to front without duplicates", () => {
            const initial = ["34", "30", "51"];
            const next = updateRecentRoutesList(initial, "30", 6);
            expect(next).toEqual(["30", "34", "51"]);
        });
    });
});
