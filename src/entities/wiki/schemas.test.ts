import {describe, expect, it} from "vitest";
import {
    isValidWikiSlug,
    normalizeWikiSlug,
    WikiCreatePayloadSchema,
    WikiEditPayloadSchema,
    WikiPinPatchPayloadSchema,
} from "./schemas";

describe("wiki schemas and slug helpers", () => {
    it("normalizes and validates title-matching Korean + alphanumeric slugs while blocking reserved words", () => {
        expect(normalizeWikiSlug("  Wonju Station 1!  ")).toBe("Wonju Station 1!");
        expect(normalizeWikiSlug("연세대 미래캠퍼스 셔틀")).toBe("연세대 미래캠퍼스 셔틀");
        expect(normalizeWikiSlug("원주역 (무실동 KTX)")).toBe("원주역 (무실동 KTX)");
        expect(normalizeWikiSlug("노선/30번?안내#테스트")).toBe("노선30번안내테스트");
        expect(isValidWikiSlug("연세대학교 미래캠퍼스")).toBe(true);
        expect(isValidWikiSlug("원주역 (무실동 KTX)")).toBe(true);
        expect(isValidWikiSlug("원주역")).toBe(true);
        expect(isValidWikiSlug("new")).toBe(false);
        expect(isValidWikiSlug("edit")).toBe(false);
        expect(isValidWikiSlug("NEW")).toBe(false);
        expect(isValidWikiSlug("..")).toBe(false);
        expect(isValidWikiSlug("a")).toBe(false);

        const created = WikiCreatePayloadSchema.parse({
            title: "연세대   미래캠퍼스 정문",
            pinColor: "blue",
        });
        expect(created.title).toBe("연세대 미래캠퍼스 정문");
        expect(created.slug).toBe("연세대 미래캠퍼스 정문");
        expect(created.pinColor).toBe("blue");

        const defaulted = WikiCreatePayloadSchema.parse({
            title: "기본 색상 테스트",
        });
        expect(defaulted.pinColor).toBe("navy");
    });

    it("accepts unified markdownBody containing routes, shuttle, and stops directives", () => {
        const valid = WikiEditPayloadSchema.safeParse({
            baseVersion: 1,
            title: "테스트 문서",
            subtitle: "",
            pinColor: "emerald",
            tags: ["원주"],
            markdownBody: "## 본문\n```routes\n32020 | 30 | 30번\n```",
        });
        expect(valid.success).toBe(true);
    });

    it("validates paired map pin lat/lng coordinates and Korean bounds", () => {
        const withCoords = WikiCreatePayloadSchema.safeParse({
            title: "원주 중앙시장 정류장",
            pinColor: "teal",
            lat: 37.3489,
            lng: 127.9512,
        });
        expect(withCoords.success).toBe(true);
        if (withCoords.success) {
            expect(withCoords.data.lat).toBe(37.3489);
            expect(withCoords.data.lng).toBe(127.9512);
        }

        const missingLng = WikiCreatePayloadSchema.safeParse({
            title: "좌표 한쪽 누락",
            lat: 37.3489,
        });
        expect(missingLng.success).toBe(false);

        const outOfBounds = WikiEditPayloadSchema.safeParse({
            baseVersion: 1,
            title: "범위 초과 테스트",
            lat: 10,
            lng: 127.9,
        });
        expect(outOfBounds.success).toBe(false);
    });

    it("validates WikiPinPatchPayloadSchema for move and color edits", () => {
        expect(
            WikiPinPatchPayloadSchema.safeParse({
                baseVersion: 2,
                pinColor: "rose",
            }).success,
        ).toBe(true);

        expect(
            WikiPinPatchPayloadSchema.safeParse({
                baseVersion: 2,
                lat: 37.3489,
                lng: 127.9512,
            }).success,
        ).toBe(true);

        expect(
            WikiPinPatchPayloadSchema.safeParse({
                baseVersion: 2,
            }).success,
        ).toBe(false);

        expect(
            WikiPinPatchPayloadSchema.safeParse({
                baseVersion: 2,
                lat: 37.3489,
            }).success,
        ).toBe(false);
    });
});
