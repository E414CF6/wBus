import {describe, expect, it} from "vitest";
import type {WikiPageDocument} from "../types";
import {computeLineDiff, computeStructuredChanges, hasWikiContentChanged} from "./wikiDiff";

function createTestWikiDoc(): WikiPageDocument {
    return {
        slug: "연세대학교 미래캠퍼스",
        title: "연세대학교 미래캠퍼스",
        subtitle: "셔틀·시내버스 안내",
        pinColor: "navy",
        cityCode: "32020",
        lat: 37.2779,
        lng: 127.9026,
        tags: ["연세대", "원주", "셔틀버스"],
        version: 1,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
        lastEditor: {nickname: "wBus", editorId: "ed-1"},
        linkedRoutes: [
            {routeNo: "30", cityCode: "32020", label: "30번"},
            {routeNo: "34", cityCode: "32020", label: "34번"},
            {routeNo: "34-1", cityCode: "32020", label: "34-1번"},
        ],
        shuttle: {
            enabled: true,
            title: "무료 셔틀버스 시간표",
            stop_locations: [],
            inbound_to_campus: [],
            outbound_from_campus: [
                {
                    operation_type: "평일 운행",
                    departure_point: "미래관",
                    departure_time: "14:00",
                    destination: "원주고속터미널",
                    via: [],
                    note: null,
                },
                {
                    operation_type: "평일 운행",
                    departure_point: "미래관",
                    departure_time: "15:00",
                    destination: "원주고속터미널",
                    via: [],
                    note: null,
                },
            ],
            guidelines: [],
        },
        boardingStops: [],
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

    it("detects structured field modifications across shuttle, routes, pin color, and stops", () => {
        const base = createTestWikiDoc();
        const next: WikiPageDocument = {
            ...base,
            title: "연세대 미래캠퍼스 (수정)",
            pinColor: "emerald",
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
        expect(changes).toContain("문서 제목·부제목 수정");
        expect(changes).toContain("핀 색상 변경");
        expect(changes).toContain("지도 핀 위치 수정");
        expect(changes).toContain("태그 수정");
        expect(changes.some((c) => c.startsWith("연결 노선 변경"))).toBe(true);
        expect(changes.some((c) => c.startsWith("셔틀 시간표 변경"))).toBe(true);
        expect(hasWikiContentChanged(base, next)).toBe(true);
        expect(hasWikiContentChanged(base, {...base})).toBe(false);
    });
});
