import {describe, expect, it} from "vitest";
import {
    isValidWikiSlug,
    normalizeWikiSlug,
    WikiCreatePayloadSchema,
    WikiEditPayloadSchema,
} from "./schemas";

describe("wiki schemas and slug helpers", () => {
    it("normalizes and validates Korean + alphanumeric slugs while blocking reserved words", () => {
        expect(normalizeWikiSlug("  Wonju Station 1! ")).toBe("wonju-station-1");
        expect(normalizeWikiSlug("연세대 미래캠퍼스 셔틀")).toBe("연세대-미래캠퍼스-셔틀");
        expect(isValidWikiSlug("yonsei-mirae")).toBe(true);
        expect(isValidWikiSlug("원주역")).toBe(true);
        expect(isValidWikiSlug("new")).toBe(false);
        expect(isValidWikiSlug("edit")).toBe(false);
        expect(isValidWikiSlug("-bad-")).toBe(false);
        expect(isValidWikiSlug("a")).toBe(false);
    });

    it("validates shuttle HH:MM format in edit payloads", () => {
        const valid = WikiEditPayloadSchema.safeParse({
            baseVersion: 1,
            title: "테스트 문서",
            subtitle: "",
            category: "guide",
            tags: ["원주"],
            linkedRoutes: [],
            shuttle: {
                enabled: true,
                title: "셔틀",
                stop_locations: [],
                inbound_to_campus: [],
                outbound_from_campus: [
                    {
                        operation_type: "평일",
                        departure_point: "정문",
                        departure_time: "09:30",
                        destination: "원주역",
                        via: [{name: "터미널", time: "09:50", is_fixed_time: true}],
                        note: null,
                    },
                ],
                guidelines: [],
            },
            boardingStops: [],
            markdownBody: "본문",
        });
        expect(valid.success).toBe(true);

        const invalidTime = WikiCreatePayloadSchema.safeParse({
            slug: "bad-time-test",
            title: "테스트 문서",
            category: "guide",
            shuttle: {
                enabled: true,
                title: "셔틀",
                stop_locations: [],
                inbound_to_campus: [],
                outbound_from_campus: [
                    {
                        operation_type: "평일",
                        departure_point: "정문",
                        departure_time: "25:99",
                        destination: "원주역",
                        via: [],
                        note: null,
                    },
                ],
                guidelines: [],
            },
        });
        expect(invalidTime.success).toBe(false);
    });
});
