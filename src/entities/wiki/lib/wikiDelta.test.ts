import {describe, expect, it} from "vitest";
import {
    applyMarkdownPatch,
    applyWikiDelta,
    computeWikiDelta,
    createMarkdownPatch,
    shouldStoreCheckpoint,
} from "./wikiDelta";
import {createYonseiMiraeSeed} from "../seeds/yonseiMiraeSeed";
import type {WikiPageDocument} from "../types";

describe("wikiDelta checkpoint & patch engine", () => {
    it("identifies checkpoints on v1, every 10th version, and reverts", () => {
        expect(shouldStoreCheckpoint(1)).toBe(true);
        expect(shouldStoreCheckpoint(2)).toBe(false);
        expect(shouldStoreCheckpoint(9)).toBe(false);
        expect(shouldStoreCheckpoint(10)).toBe(true);
        expect(shouldStoreCheckpoint(11)).toBe(false);
        expect(shouldStoreCheckpoint(20)).toBe(true);
        expect(shouldStoreCheckpoint(4, {isRevert: true})).toBe(true);
    });

    it("performs lossless round-trip markdown patch and reconstruction", () => {
        const before = `# 연세대학교 미래캠퍼스\n\n> [!TIP]\n> 정문 정류장에서 탑승하세요.\n\n- 30번\n- 34번\n- 34-1번`;
        const after = `# 연세대학교 미래캠퍼스\n\n> [!TIP]\n> 정문 승강장(시내방면)에서 탑승하세요.\n> 막차 주의!\n\n- 30번 (15분 간격)\n- 34번\n- 34-1번\n- 심야 셔틀 안내`;

        const patch = createMarkdownPatch(before, after);
        expect(applyMarkdownPatch(before, patch)).toBe(after);

        // Edge case: deleting everything down to single line
        const emptyPatch = createMarkdownPatch(after, "초기화됨");
        expect(applyMarkdownPatch(after, emptyPatch)).toBe("초기화됨");
    });

    it("losslessly reconstructs 15 sequential edits using v1 and v10 checkpoints", () => {
        const docs: WikiPageDocument[] = [];
        const v1 = createYonseiMiraeSeed();
        docs.push(v1);

        for (let v = 2; v <= 15; v++) {
            const prev = docs[docs.length - 1];
            const next: WikiPageDocument = {
                ...prev,
                version: v,
                title: v === 4 ? "연세대 미래캠퍼스 (수정)" : prev.title,
                tags: v === 7 ? [...prev.tags, "KTX환승"] : prev.tags,
                linkedRoutes:
                    v === 12 ? prev.linkedRoutes.slice(0, 2) : prev.linkedRoutes,
                markdownBody: `${prev.markdownBody}\n- v${v} 편집 추가 팁`,
                updatedAt: `2026-03-01T00:${String(v).padStart(2, "0")}:00.000Z`,
                lastEditor: {nickname: `학우${v}`, editorId: `ed-${v}`},
            };
            docs.push(next);
        }

        const stored = docs.map((doc, idx) => {
            const isCp = shouldStoreCheckpoint(doc.version);
            return {
                version: doc.version,
                isCheckpoint: isCp,
                snapshot: isCp ? doc : null,
                delta: !isCp ? computeWikiDelta(docs[idx - 1], doc) : null,
                meta: {
                    version: doc.version,
                    editor: doc.lastEditor,
                    createdAt: doc.updatedAt,
                },
            };
        });

        // Verify v1 and v10 are checkpoints and intermediate edits store compact deltas
        expect(stored[0].isCheckpoint).toBe(true);
        expect(stored[9].isCheckpoint).toBe(true);
        expect(stored[4].isCheckpoint).toBe(false);
        expect(stored[4].snapshot).toBeNull();
        // Structured shuttle block wasn't mutated on v5, so fieldsPatch must omit shuttle
        expect(stored[4].delta?.fieldsPatch).toBeUndefined();

        // Reconstruct every single version v1..v15 from nearest prior checkpoint
        for (const expected of docs) {
            const startIdx = expected.version >= 10 ? 9 : 0; // v10 or v1
            let reconstructed = stored[startIdx].snapshot!;
            for (let i = startIdx + 1; i < expected.version; i++) {
                reconstructed = applyWikiDelta(
                    reconstructed,
                    stored[i].delta!,
                    stored[i].meta
                );
            }
            expect(reconstructed).toEqual(expected);
        }
    });
});
