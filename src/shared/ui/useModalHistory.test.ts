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
