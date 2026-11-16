import {describe, expect, it} from "vitest";
import {computeLineDiff, computeStructuredChanges, hasWikiContentChanged} from "./wikiDiff";
import {createYonseiMiraeSeed} from "../seeds/yonseiMiraeSeed";

describe("wikiDiff utilities", () => {
    it("computes accurate line-level additions and removals", () => {
        const diff = computeLineDiff("line 1\nline 2\nline 3", "line 1\nline 2 edited\nline 3\nline 4");
        const added = diff.filter((d) => d.type === "add");
        const removed = diff.filter((d) => d.type === "remove");

        expect(removed.map((r) => r.line)).toEqual(["line 2"]);
        expect(added.map((a) => a.line)).toEqual(["line 2 edited", "line 4"]);
    });

    it("detects structured field modifications across shuttle, routes, and stops", () => {
        const base = createYonseiMiraeSeed();
        const next = {
            ...base,
            title: "연세대 미래캠퍼스 (수정)",
            lat: 37.28,
            lng: 127.905,
            tags: [...base.tags, "통학"],
            linkedRoutes: base.linkedRoutes.slice(0, 2),
            shuttle: base.shuttle
                ? {
                    ...base.shuttle,
                    outbound_from_campus: base.shuttle.outbound_from_campus.slice(1),
                }
                : null,
        };

        const changes = computeStructuredChanges(base, next);
        expect(changes).toContain("문서 제목·분류 수정");
        expect(changes).toContain("지도 핀 위치 수정");
        expect(changes).toContain("태그 수정");
        expect(changes.some((c) => c.startsWith("연결 노선 변경"))).toBe(true);
        expect(changes.some((c) => c.startsWith("셔틀 시간표 변경"))).toBe(true);
        expect(hasWikiContentChanged(base, next)).toBe(true);
        expect(hasWikiContentChanged(base, {...base})).toBe(false);
    });
});
