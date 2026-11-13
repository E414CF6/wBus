import {describe, expect, it} from "vitest";
import {buildPageHref, isValidSpecialPageId, resolveSpecialPageFromSearch, SPECIAL_PAGE_IDS,} from "./pages";

describe("pages registry", () => {
    it("validates registered special page IDs", () => {
        expect(isValidSpecialPageId(SPECIAL_PAGE_IDS.YONSEI_MIRAE)).toBe(true);
        expect(isValidSpecialPageId("yonsei_mirae")).toBe(true);
        expect(isValidSpecialPageId("unknown_page")).toBe(false);
        expect(isValidSpecialPageId("")).toBe(false);
        expect(isValidSpecialPageId(null)).toBe(false);
    });

    it("resolves special page ID from query string or URLSearchParams", () => {
        expect(resolveSpecialPageFromSearch("?page=yonsei_mirae")).toBe("yonsei_mirae");
        expect(resolveSpecialPageFromSearch(new URLSearchParams("page=yonsei_mirae&cityCode=32020"))).toBe(
            "yonsei_mirae"
        );
        expect(resolveSpecialPageFromSearch("?page=invalid")).toBeNull();
        expect(resolveSpecialPageFromSearch("")).toBeNull();
    });

    it("builds extensible ?page=... hrefs", () => {
        expect(buildPageHref(SPECIAL_PAGE_IDS.YONSEI_MIRAE)).toBe("/?page=yonsei_mirae");
        expect(buildPageHref(SPECIAL_PAGE_IDS.YONSEI_MIRAE, {cityCode: "32020"})).toBe(
            "/?page=yonsei_mirae&cityCode=32020"
        );
    });
});
