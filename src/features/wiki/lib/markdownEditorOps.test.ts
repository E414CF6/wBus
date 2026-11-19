import {describe, expect, it} from "vitest";
import {
    applySnippetAtSelection,
    canRedoEditorHistory,
    canUndoEditorHistory,
    createEditorHistory,
    extractMarkdownHeadings,
    indentSelectedLines,
    insertMarkdownLink,
    pushEditorSnapshot,
    redoEditorHistory,
    toggleInlineWrap,
    toggleLinePrefix,
    TYPING_COALESCE_WINDOW_MS,
    undoEditorHistory,
} from "./markdownEditorOps";

describe("markdownEditorOps", () => {
    it("coalesces rapid single-line typing and splits on pause, newline, or toolbar actions", () => {
        let state = createEditorHistory("", 1000);
        expect(canUndoEditorHistory(state)).toBe(false);

        state = pushEditorSnapshot(state, {
            value: "가",
            selectionStart: 1,
            selectionEnd: 1,
            timestamp: 1100,
            source: "typing",
        });
        state = pushEditorSnapshot(state, {
            value: "가나",
            selectionStart: 2,
            selectionEnd: 2,
            timestamp: 1250,
            source: "typing",
        });
        // Coalesced into 1 typing entry + init entry
        expect(state.entries).toHaveLength(2);

        // Pause beyond coalesce window creates a new step
        state = pushEditorSnapshot(state, {
            value: "가나다",
            selectionStart: 3,
            selectionEnd: 3,
            timestamp: 1250 + TYPING_COALESCE_WINDOW_MS + 10,
            source: "typing",
        });
        expect(state.entries).toHaveLength(3);

        // Newline creates a new step even within window
        state = pushEditorSnapshot(state, {
            value: "가나다\n",
            selectionStart: 4,
            selectionEnd: 4,
            timestamp: 1900,
            source: "typing",
        });
        expect(state.entries).toHaveLength(4);

        // Toolbar action always creates a new step and clears redo branch
        state = pushEditorSnapshot(state, {
            value: "가나다\n**굵게**",
            selectionStart: 10,
            selectionEnd: 10,
            timestamp: 1950,
            source: "toolbar",
        });
        expect(state.entries).toHaveLength(5);

        state = undoEditorHistory(state);
        expect(state.entries[state.index].value).toBe("가나다\n");
        expect(canRedoEditorHistory(state)).toBe(true);

        state = undoEditorHistory(state);
        expect(state.entries[state.index].value).toBe("가나다");

        state = redoEditorHistory(state);
        expect(state.entries[state.index].value).toBe("가나다\n");
    });

    it("caps history length at maxEntries", () => {
        let state = createEditorHistory("0", 0);
        for (let i = 1; i <= 10; i++) {
            state = pushEditorSnapshot(
                state,
                {
                    value: String(i),
                    selectionStart: 1,
                    selectionEnd: 1,
                    timestamp: i * 1000,
                    source: "toolbar",
                },
                5,
            );
        }
        expect(state.entries).toHaveLength(5);
        expect(state.entries[0].value).toBe("6");
        expect(state.entries[4].value).toBe("10");
    });

    it("applies snippet and updates cursor position", () => {
        const res = applySnippetAtSelection("hello world", 6, 11, "wBus");
        expect(res.value).toBe("hello wBus");
        expect(res.selectionStart).toBe(10);
        expect(res.selectionEnd).toBe(10);
    });

    it("toggles inline markers on selection and inserts placeholder when empty", () => {
        const empty = toggleInlineWrap("안녕 ", 3, 3, "**", "굵은 텍스트");
        expect(empty.value).toBe("안녕 **굵은 텍스트**");
        expect(empty.value.slice(empty.selectionStart, empty.selectionEnd)).toBe("굵은 텍스트");

        const wrapped = toggleInlineWrap("원주역 정류장", 0, 3, "**", "굵은 텍스트");
        expect(wrapped.value).toBe("**원주역** 정류장");
        expect(wrapped.value.slice(wrapped.selectionStart, wrapped.selectionEnd)).toBe("원주역");

        // Unwraps when markers sit right outside selection
        const unwrapped = toggleInlineWrap(
            wrapped.value,
            wrapped.selectionStart,
            wrapped.selectionEnd,
            "**",
            "굵은 텍스트",
        );
        expect(unwrapped.value).toBe("원주역 정류장");
        expect(unwrapped.selectionStart).toBe(0);
        expect(unwrapped.selectionEnd).toBe(3);

        // Does not confuse bold ** with italic *
        const italicOnBold = toggleInlineWrap("**원주역**", 2, 5, "*", "기울임");
        expect(italicOnBold.value).toBe("***원주역***");
    });

    it("inserts markdown link cleanly", () => {
        const empty = insertMarkdownLink("참고: ", 4, 4);
        expect(empty.value).toBe("참고: [링크 텍스트](https://)");
        expect(empty.value.slice(empty.selectionStart, empty.selectionEnd)).toBe("링크 텍스트");

        const withSelection = insertMarkdownLink("공식 안내 보기", 0, 5);
        expect(withSelection.value).toBe("[공식 안내](https://) 보기");
        expect(withSelection.value.slice(withSelection.selectionStart, withSelection.selectionEnd)).toBe(
            "https://",
        );
    });

    it("toggles line prefix and indents/outdents lines", () => {
        const bulleted = toggleLinePrefix("첫째\n둘째", 0, 5, "- ");
        expect(bulleted.value).toBe("- 첫째\n- 둘째");

        const unbulleted = toggleLinePrefix(bulleted.value, bulleted.selectionStart, bulleted.selectionEnd, "- ");
        expect(unbulleted.value).toBe("첫째\n둘째");

        const indented = indentSelectedLines("첫째\n둘째", 0, 5, false);
        expect(indented.value).toBe("  첫째\n  둘째");

        const outdented = indentSelectedLines(indented.value, indented.selectionStart, indented.selectionEnd, true);
        expect(outdented.value).toBe("첫째\n둘째");
    });

    it("extracts headings while ignoring fenced code blocks", () => {
        const md = [
            "# 문서 제목",
            "본문",
            "```shuttle",
            "## 코드 블록 안 주석",
            "```",
            "## 연결 노선",
            "### 30번 상세",
        ].join("\n");

        const headings = extractMarkdownHeadings(md);
        expect(headings).toEqual([
            {lineNumber: 1, offset: 0, level: 1, text: "문서 제목"},
            {lineNumber: 6, offset: expect.any(Number), level: 2, text: "연결 노선"},
            {lineNumber: 7, offset: expect.any(Number), level: 3, text: "30번 상세"},
        ]);
        expect(md.slice(headings[1].offset, headings[1].offset + 8)).toBe("## 연결 노선");
    });
});
