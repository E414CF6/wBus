import {describe, expect, it} from "vitest";
import type {WikiPageDocument} from "../types";
import {computeLineDiff, computeStructuredChanges, hasWikiContentChanged} from "./wikiDiff";

function createTestWikiDoc(): WikiPageDocument {
    return {
        slug: "연세대학교 미래캠퍼스",
        title: "연세대학교 미래캠퍼스",
        subtitle: "셔틀·시내버스 안내",
        pinColor: "navy",
        lat: 37.2779,
        lng: 127.9026,
        tags: ["연세대", "원주", "셔틀버스"],
        version: 1,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
        lastEditor: {nickname: "wBus", editorId: "ed-1"},
        markdownBody: "# 연세대학교 미래캠퍼스\n테스트 본문",
    };
}

describe("wikiDiff utilities", () => {
    it("computes accurate line-level additions and removals", () => {
        const diff = computeLineDiff(
            "line 1\nline 2\nline 3",
            "line 1\nline 2 edited\nline 3\nline 4",
        );
        const added = diff.filter((d) => d.type === "add");
        const removed = diff.filter((d) => d.type === "remove");

        expect(removed.map((r) => r.line)).toEqual(["line 2"]);
        expect(added.map((a) => a.line)).toEqual(["line 2 edited", "line 4"]);
    });

    it("detects structured field and markdown modifications cleanly", () => {
        const base = createTestWikiDoc();
        const next: WikiPageDocument = {
            ...base,
            title: "연세대 미래캠퍼스 (수정)",
            pinColor: "emerald",
            lat: 37.28,
            lng: 127.905,
            tags: [...base.tags, "통학"],
            markdownBody: `${base.markdownBody}\n- 30번 추가`,
        };

        const changes = computeStructuredChanges(base, next);
        expect(changes).toContain("문서 제목·부제목 수정");
        expect(changes).toContain("핀 색상 변경");
        expect(changes).toContain("지도 핀 위치 수정");
        expect(changes).toContain("태그 수정");
        expect(changes).toContain("본문 문서 수정");
        expect(hasWikiContentChanged(base, next)).toBe(true);
        expect(hasWikiContentChanged(base, {...base})).toBe(false);
    });
});
