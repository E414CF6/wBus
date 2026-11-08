import {describe, expect, it} from "vitest";
import {buildModalUrl, isModalQueryMatching, removeModalUrlQuery, useModalHistory,} from "./useModalHistory";

describe("useModalHistory URL Helpers", () => {
    describe("buildModalUrl", () => {
        it("adds modal query parameter to root URL", () => {
            const result = buildModalUrl("https://wbus.kr/", "city");
            expect(result).toBe("/?modal=city");
        });

        it("preserves existing query parameters when adding modal query", () => {
            const result = buildModalUrl("https://wbus.kr/?cityCode=32020&route=30", "city");
            expect(result).toBe("/?cityCode=32020&route=30&modal=city");
        });

        it("replaces existing modal query parameter with new modalId", () => {
            const result = buildModalUrl("https://wbus.kr/?cityCode=32020&modal=schedule", "notice");
            expect(result).toBe("/?cityCode=32020&modal=notice");
        });

        it("preserves hash fragment in URL", () => {
            const result = buildModalUrl("https://wbus.kr/#timetable", "route");
            expect(result).toBe("/?modal=route#timetable");
        });

        it("supports custom queryKey", () => {
            const result = buildModalUrl("https://wbus.kr/", "custom-id", "popup");
            expect(result).toBe("/?popup=custom-id");
        });
    });

    describe("removeModalUrlQuery", () => {
        it("removes modal query parameter when present", () => {
            const result = removeModalUrlQuery("https://wbus.kr/?modal=city");
            expect(result).toBe("/");
        });

        it("preserves other query parameters when removing modal parameter", () => {
            const result = removeModalUrlQuery("https://wbus.kr/?cityCode=32020&modal=city&route=30");
            expect(result).toBe("/?cityCode=32020&route=30");
        });

        it("leaves URL unchanged if modal query parameter is not present", () => {
            const result = removeModalUrlQuery("https://wbus.kr/?cityCode=32020");
            expect(result).toBe("/?cityCode=32020");
        });

        it("preserves hash fragment when removing modal query", () => {
            const result = removeModalUrlQuery("https://wbus.kr/?modal=city#top");
            expect(result).toBe("/#top");
        });
    });

    describe("isModalQueryMatching", () => {
        it("returns true when modal query parameter matches", () => {
            expect(isModalQueryMatching("https://wbus.kr/?modal=city", "city")).toBe(true);
        });

        it("returns false when modal query parameter does not match", () => {
            expect(isModalQueryMatching("https://wbus.kr/?modal=route", "city")).toBe(false);
        });

        it("returns false when modal query parameter is absent", () => {
            expect(isModalQueryMatching("https://wbus.kr/?cityCode=32020", "city")).toBe(false);
        });
    });
});

describe("useModalHistory exports", () => {
    it("exports useModalHistory as a function", () => {
        expect(typeof useModalHistory).toBe("function");
    });
});

describe("useModalHistory URL state decision logic", () => {
    it("correctly identifies when URL still matches the active modal", () => {
        const urlBeforeClosing = "https://wbus.kr/?cityCode=32020&route=30&modal=route";
        expect(isModalQueryMatching(urlBeforeClosing, "route")).toBe(true);
    });

    it("correctly identifies when user selected a route and URL was replaced with a new route without modal param", () => {
        // User selected route 34, so handleRouteChange called replaceState to /?cityCode=32020&route=34
        const urlAfterSelection = "https://wbus.kr/?cityCode=32020&route=34";
        expect(isModalQueryMatching(urlAfterSelection, "route")).toBe(false);
    });

    it("correctly identifies when user selected a different city and URL was replaced without modal param", () => {
        // User selected Chuncheon (32010), so setCity called replaceState to /?cityCode=32010
        const urlAfterCitySelection = "https://wbus.kr/?cityCode=32010";
        expect(isModalQueryMatching(urlAfterCitySelection, "city")).toBe(false);
    });

    it("removes modal query correctly while preserving other queries on direct cleanup", () => {
        const cleaned = removeModalUrlQuery("https://wbus.kr/?cityCode=32020&route=34&modal=route");
        expect(cleaned).toBe("/?cityCode=32020&route=34");
    });

    it("detects navigation when city changes from Wonju (32020) to Chuncheon (32010)", () => {
        const initialBeforeOpen = removeModalUrlQuery("https://wbus.kr/?cityCode=32020&route=30", "modal");
        const currentAfterCityChange = removeModalUrlQuery("https://wbus.kr/?cityCode=32010", "modal");
        expect(initialBeforeOpen !== currentAfterCityChange).toBe(true);
    });

    it("detects navigation when route changes from 30 to 34", () => {
        const initialBeforeOpen = removeModalUrlQuery("https://wbus.kr/?cityCode=32020&route=30", "modal");
        const currentAfterRouteChange = removeModalUrlQuery("https://wbus.kr/?cityCode=32020&route=34", "modal");
        expect(initialBeforeOpen !== currentAfterRouteChange).toBe(true);
    });

    it("does not detect navigation when modal is simply closed via X button without state change", () => {
        const initialBeforeOpen = removeModalUrlQuery("https://wbus.kr/?cityCode=32020&route=30", "modal");
        const currentOnDismiss = removeModalUrlQuery("https://wbus.kr/?cityCode=32020&route=30&modal=city", "modal");
        expect(initialBeforeOpen !== currentOnDismiss).toBe(false);
    });
});
