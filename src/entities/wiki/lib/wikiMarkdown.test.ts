import {describe, expect, it} from "vitest";
import {isSafeWikiHref, parseInlineMarkdown, parseWikiMarkdown, slugifyHeadingId} from "./wikiMarkdown";

describe("wikiMarkdown parser", () => {
    it("blocks unsafe URL schemes and protocol-relative links", () => {
        expect(isSafeWikiHref("https://wbus.kr/wiki")).toBe(true);
        expect(isSafeWikiHref("http://example.com")).toBe(true);
        expect(isSafeWikiHref("/wiki/yonsei-mirae")).toBe(true);
        expect(isSafeWikiHref("javascript:alert(1)")).toBe(false);
        expect(isSafeWikiHref("data:text/html,<script>alert(1)</script>")).toBe(false);
        expect(isSafeWikiHref("//evil.example.com")).toBe(false);
    });

    it("deduplicates heading anchors cleanly for TOC", () => {
        const usedIds = new Map<string, number>();
        expect(slugifyHeadingId("탑승 위치", usedIds)).toBe("탑승-위치");
        expect(slugifyHeadingId("탑승 위치", usedIds)).toBe("탑승-위치-2");
        expect(slugifyHeadingId("Bus 30!", usedIds)).toBe("bus-30");
    });

    it("parses custom wiki, route, and roadview tokens inline", () => {
        const nodes = parseInlineMarkdown(
            "[[연세대학교 미래캠퍼스|연세대 안내]] 타고 [[원주역 (무실동 KTX)|원주역]] [[route:32020:30]] [[roadview:37.2834,127.9006,미래관]]"
        );
        expect(
            nodes.some(
                (n) => n.type === "wikilink" && n.slug === "연세대학교 미래캠퍼스" && n.label === "연세대 안내"
            )
        ).toBe(true);
        expect(
            nodes.some(
                (n) => n.type === "wikilink" && n.slug === "원주역 (무실동 KTX)" && n.label === "원주역"
            )
        ).toBe(true);
        expect(nodes.some((n) => n.type === "routelink" && n.cityCode === "32020" && n.routeNo === "30")).toBe(true);
        expect(nodes.some((n) => n.type === "roadview" && n.lat === 37.2834 && n.lng === 127.9006 && n.label === "미래관")).toBe(true);
    });

    it("parses headings, callouts, lists, and GFM tables with TOC generation", () => {
        const md = `# 연세대 미래캠퍼스 가이드

> [!TIP]
> 18시 이후에는 정문 승강장이 혼잡합니다.

## 주요 노선

| 노선 | 배차 |
| --- | --- |
| 30번 | 15분 |
| 34번 | 30분 |

- 첫 번째 팁
- [안전 링크](https://wbus.kr) / [악성 링크](javascript:alert(1))
`;
        const parsed = parseWikiMarkdown(md);
        expect(parsed.toc).toEqual([
            {id: "연세대-미래캠퍼스-가이드", level: 1, text: "연세대 미래캠퍼스 가이드"},
            {id: "주요-노선", level: 2, text: "주요 노선"},
        ]);
        expect(parsed.blocks.some((b) => b.type === "callout" && b.tone === "TIP")).toBe(true);
        expect(parsed.blocks.some((b) => b.type === "table" && b.rows.length === 2)).toBe(true);

        const listBlock = parsed.blocks.find((b) => b.type === "list");
        expect(listBlock?.type).toBe("list");
        if (listBlock?.type === "list") {
            const secondItem = listBlock.items[1];
            expect(secondItem.some((n) => n.type === "link" && n.href === "https://wbus.kr")).toBe(true);
            expect(secondItem.some((n) => n.type === "link" && n.href.startsWith("javascript:"))).toBe(false);
        }
    });
});
