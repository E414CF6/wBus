import {describe, expect, it} from "vitest";
import {
    getWikiCreateDraftKey,
    getWikiEditDraftKey,
    isWikiFormDirty,
    parseWikiLocalDraft,
} from "./wikiLocalDraft";

describe("wikiLocalDraft", () => {
    it("builds deterministic storage keys", () => {
        expect(getWikiEditDraftKey("원주역")).toBe("wbus_wiki_draft_v1:edit:원주역");
        expect(getWikiCreateDraftKey()).toBe("wbus_wiki_draft_v1:create:__new__");
        expect(getWikiCreateDraftKey("신규 문서")).toBe("wbus_wiki_draft_v1:create:신규 문서");
    });

    it("parses valid draft payloads and rejects invalid ones", () => {
        expect(parseWikiLocalDraft(null)).toBeNull();
        expect(parseWikiLocalDraft("not json")).toBeNull();
        expect(parseWikiLocalDraft(JSON.stringify({version: 2}))).toBeNull();

        const valid = parseWikiLocalDraft(
            JSON.stringify({
                version: 1,
                key: "wbus_wiki_draft_v1:edit:원주역",
                baseVersion: 3,
                title: "원주역",
                subtitle: "KTX 환승",
                pinColor: "emerald",
                tagsText: "기차, 환승",
                markdownBody: "## 안내",
                lat: 37.31,
                lng: 127.92,
                summary: "수정 중",
                savedAt: "2026-11-19T02:00:00.000Z",
            }),
        );

        expect(valid).toEqual({
            version: 1,
            key: "wbus_wiki_draft_v1:edit:원주역",
            baseVersion: 3,
            title: "원주역",
            subtitle: "KTX 환승",
            pinColor: "emerald",
            tagsText: "기차, 환승",
            markdownBody: "## 안내",
            lat: 37.31,
            lng: 127.92,
            summary: "수정 중",
            savedAt: "2026-11-19T02:00:00.000Z",
        });
    });

    it("detects dirty state accurately across fields and tags", () => {
        const baseline = {
            title: "원주역",
            subtitle: "안내",
            pinColor: "navy" as const,
            tagsText: "환승, 정류장",
            markdownBody: "본문",
            lat: 37.31,
            lng: 127.92,
            summary: "",
        };

        expect(
            isWikiFormDirty(
                {...baseline, tagsText: " #환승 , 정류장 ", summary: "편집 요약만 입력"},
                baseline,
            ),
        ).toBe(false);

        expect(isWikiFormDirty({...baseline, markdownBody: "본문 수정"}, baseline)).toBe(true);
        expect(isWikiFormDirty({...baseline, pinColor: "rose"}, baseline)).toBe(true);
        expect(isWikiFormDirty({...baseline, lat: undefined, lng: undefined}, baseline)).toBe(true);
    });
});
