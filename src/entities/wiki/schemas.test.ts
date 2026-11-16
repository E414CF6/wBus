import {describe, expect, it} from "vitest";
import {isValidWikiSlug, normalizeWikiSlug, WikiCreatePayloadSchema, WikiEditPayloadSchema,} from "./schemas";

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
            category: "guide",
        });
        expect(created.title).toBe("연세대 미래캠퍼스 정문");
        expect(created.slug).toBe("연세대 미래캠퍼스 정문");
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

    it("validates paired map pin lat/lng coordinates and Korean bounds", () => {
        const withCoords = WikiCreatePayloadSchema.safeParse({
            title: "원주 중앙시장 정류장",
            category: "stop",
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
            category: "stop",
            lat: 37.3489,
        });
        expect(missingLng.success).toBe(false);

        const outOfBounds = WikiEditPayloadSchema.safeParse({
            baseVersion: 1,
            title: "범위 초과 테스트",
            category: "stop",
            lat: 10,
            lng: 127.9,
        });
        expect(outOfBounds.success).toBe(false);
    });
});
