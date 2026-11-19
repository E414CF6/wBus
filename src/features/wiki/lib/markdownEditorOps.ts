import {UI_TEXT} from "@shared/config/locale";

export type EditorHistorySource = "init" | "typing" | "toolbar" | "shortcut" | "external";

export interface EditorSnapshot {
    value: string;
    selectionStart: number;
    selectionEnd: number;
    scrollTop?: number;
    timestamp: number;
    source: EditorHistorySource;
}

export interface EditorHistoryState {
    entries: EditorSnapshot[];
    index: number;
}

export interface TextEditResult {
    value: string;
    selectionStart: number;
    selectionEnd: number;
}

export interface MarkdownHeadingItem {
    lineNumber: number;
    offset: number;
    level: 1 | 2 | 3;
    text: string;
}

export const MAX_EDITOR_HISTORY_ENTRIES = 120;
export const TYPING_COALESCE_WINDOW_MS = 500;

function clampRange(value: string, start: number, end: number): [number, number] {
    const safeStart = Math.max(0, Math.min(value.length, start));
    const safeEnd = Math.max(0, Math.min(value.length, end));
    return safeStart <= safeEnd ? [safeStart, safeEnd] : [safeEnd, safeStart];
}

export function createEditorHistory(
    initialValue: string,
    timestamp = Date.now(),
): EditorHistoryState {
    return {
        entries: [
            {
                value: initialValue,
                selectionStart: 0,
                selectionEnd: 0,
                scrollTop: 0,
                timestamp,
                source: "init",
            },
        ],
        index: 0,
    };
}

function shouldCoalesceTyping(prev: EditorSnapshot, next: EditorSnapshot): boolean {
    if (prev.source !== "typing" || next.source !== "typing") {
        return false;
    }
    if (next.timestamp - prev.timestamp > TYPING_COALESCE_WINDOW_MS) {
        return false;
    }
    const lenDelta = Math.abs(next.value.length - prev.value.length);
    if (lenDelta === 0 || lenDelta > 4) {
        return false;
    }
    // Start a fresh undo step at newlines so line-level edits undo cleanly
    const prevNewlines = (prev.value.match(/\n/g) ?? []).length;
    const nextNewlines = (next.value.match(/\n/g) ?? []).length;
    return prevNewlines === nextNewlines;
}

export function pushEditorSnapshot(
    state: EditorHistoryState,
    next: EditorSnapshot,
    maxEntries = MAX_EDITOR_HISTORY_ENTRIES,
): EditorHistoryState {
    const current = state.entries[state.index];
    if (!current) {
        return createEditorHistory(next.value, next.timestamp);
    }

    if (next.value === current.value) {
        return state;
    }

    const head = state.entries.slice(0, state.index + 1);

    if (shouldCoalesceTyping(current, next)) {
        const updated = head.slice();
        updated[updated.length - 1] = next;
        return {
            entries: updated,
            index: updated.length - 1,
        };
    }

    const appended = [...head, next];
    const trimmed =
        appended.length > maxEntries
            ? appended.slice(appended.length - maxEntries)
            : appended;

    return {
        entries: trimmed,
        index: trimmed.length - 1,
    };
}

export function canUndoEditorHistory(state: EditorHistoryState): boolean {
    return state.index > 0;
}

export function canRedoEditorHistory(state: EditorHistoryState): boolean {
    return state.index < state.entries.length - 1;
}

export function undoEditorHistory(state: EditorHistoryState): EditorHistoryState {
    if (!canUndoEditorHistory(state)) {
        return state;
    }
    return {
        ...state,
        index: state.index - 1,
    };
}

export function redoEditorHistory(state: EditorHistoryState): EditorHistoryState {
    if (!canRedoEditorHistory(state)) {
        return state;
    }
    return {
        ...state,
        index: state.index + 1,
    };
}

export function applySnippetAtSelection(
    value: string,
    start: number,
    end: number,
    snippet: string,
): TextEditResult {
    const [s, e] = clampRange(value, start, end);
    const next = value.slice(0, s) + snippet + value.slice(e);
    const cursor = s + snippet.length;
    return {
        value: next,
        selectionStart: cursor,
        selectionEnd: cursor,
    };
}

function isWrappedStrictlyBy(
    value: string,
    start: number,
    end: number,
    marker: string,
): boolean {
    const mLen = marker.length;
    if (start < mLen || end + mLen > value.length) {
        return false;
    }
    const left = value.slice(start - mLen, start);
    const right = value.slice(end, end + mLen);
    if (left !== marker || right !== marker) {
        return false;
    }
    // Avoid treating `**bold**` as `*` italic when checking single-asterisk markers
    if (marker === "*") {
        const beforeLeft = start >= 2 ? value[start - 2] : "";
        const afterRight = end + 1 < value.length ? value[end + 1] : "";
        if (beforeLeft === "*" || afterRight === "*") {
            return false;
        }
    }
    return true;
}

export function toggleInlineWrap(
    value: string,
    start: number,
    end: number,
    marker: string,
    placeholder: string,
): TextEditResult {
    const [s, e] = clampRange(value, start, end);
    const mLen = marker.length;
    const selected = value.slice(s, e);

    // Case 1: Selection itself includes the markers (e.g., "**text**")
    if (
        selected.length >= mLen * 2 &&
        selected.startsWith(marker) &&
        selected.endsWith(marker) &&
        !(marker === "*" && selected.startsWith("**") && selected.endsWith("**"))
    ) {
        const unwrapped = selected.slice(mLen, selected.length - mLen);
        return {
            value: value.slice(0, s) + unwrapped + value.slice(e),
            selectionStart: s,
            selectionEnd: s + unwrapped.length,
        };
    }

    // Case 2: Markers sit immediately outside the selection
    if (isWrappedStrictlyBy(value, s, e, marker)) {
        return {
            value: value.slice(0, s - mLen) + selected + value.slice(e + mLen),
            selectionStart: s - mLen,
            selectionEnd: e - mLen,
        };
    }

    // Case 3: Empty selection -> insert placeholder and highlight it
    if (s === e) {
        const inserted = `${marker}${placeholder}${marker}`;
        return {
            value: value.slice(0, s) + inserted + value.slice(e),
            selectionStart: s + mLen,
            selectionEnd: s + mLen + placeholder.length,
        };
    }

    // Case 4: Wrap current selection
    return {
        value: value.slice(0, s) + marker + selected + marker + value.slice(e),
        selectionStart: s + mLen,
        selectionEnd: e + mLen,
    };
}

export function insertMarkdownLink(
    value: string,
    start: number,
    end: number,
): TextEditResult {
    const [s, e] = clampRange(value, start, end);
    const selected = value.slice(s, e);
    if (s === e) {
        const label = UI_TEXT.WIKI.MARKDOWN_EDITOR.LINK_TEXT_DEFAULT;
        const snippet = `[${label}](https://)`;
        return {
            value: value.slice(0, s) + snippet + value.slice(e),
            selectionStart: s + 1,
            selectionEnd: s + 1 + label.length,
        };
    }
    const snippet = `[${selected}](https://)`;
    const urlStart = s + selected.length + 3;
    return {
        value: value.slice(0, s) + snippet + value.slice(e),
        selectionStart: urlStart,
        selectionEnd: urlStart + "https://".length,
    };
}

export function toggleLinePrefix(
    value: string,
    start: number,
    end: number,
    prefix: string,
): TextEditResult {
    const [s, e] = clampRange(value, start, end);
    const blockStart = value.lastIndexOf("\n", Math.max(0, s - 1)) + 1;
    const rawLineEnd = value.indexOf("\n", e);
    const blockEnd = rawLineEnd === -1 ? value.length : rawLineEnd;

    const block = value.slice(blockStart, blockEnd);
    const lines = block.split("\n");
    const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
    const allPrefixed =
        nonEmptyLines.length > 0 && nonEmptyLines.every((line) => line.startsWith(prefix));

    let firstLineDelta = 0;
    let totalDelta = 0;
    const nextLines = lines.map((line, idx) => {
        if (allPrefixed) {
            if (line.startsWith(prefix)) {
                if (idx === 0) firstLineDelta -= prefix.length;
                totalDelta -= prefix.length;
                return line.slice(prefix.length);
            }
            return line;
        }
        if (lines.length === 1 || line.trim().length > 0) {
            if (idx === 0) firstLineDelta += prefix.length;
            totalDelta += prefix.length;
            return `${prefix}${line}`;
        }
        return line;
    });

    const nextBlock = nextLines.join("\n");
    const nextValue = value.slice(0, blockStart) + nextBlock + value.slice(blockEnd);

    if (s === e && lines.length === 1) {
        const nextCursor = Math.max(blockStart, s + totalDelta);
        return {
            value: nextValue,
            selectionStart: nextCursor,
            selectionEnd: nextCursor,
        };
    }

    return {
        value: nextValue,
        selectionStart: Math.max(blockStart, s + firstLineDelta),
        selectionEnd: Math.max(blockStart, e + totalDelta),
    };
}

export function indentSelectedLines(
    value: string,
    start: number,
    end: number,
    outdent = false,
    indentUnit = "  ",
): TextEditResult {
    const [s, e] = clampRange(value, start, end);

    if (!outdent && s === e) {
        return {
            value: value.slice(0, s) + indentUnit + value.slice(e),
            selectionStart: s + indentUnit.length,
            selectionEnd: s + indentUnit.length,
        };
    }

    const blockStart = value.lastIndexOf("\n", Math.max(0, s - 1)) + 1;
    const rawLineEnd = value.indexOf("\n", e);
    const blockEnd = rawLineEnd === -1 ? value.length : rawLineEnd;
    const block = value.slice(blockStart, blockEnd);
    const lines = block.split("\n");

    let firstLineDelta = 0;
    let totalDelta = 0;

    const nextLines = lines.map((line, idx) => {
        if (outdent) {
            let removed = 0;
            if (line.startsWith(indentUnit)) {
                removed = indentUnit.length;
            } else if (line.startsWith("\t") || line.startsWith(" ")) {
                removed = 1;
            }
            if (idx === 0) firstLineDelta -= removed;
            totalDelta -= removed;
            return line.slice(removed);
        }
        if (idx === 0) firstLineDelta += indentUnit.length;
        totalDelta += indentUnit.length;
        return `${indentUnit}${line}`;
    });

    const nextBlock = nextLines.join("\n");
    const nextValue = value.slice(0, blockStart) + nextBlock + value.slice(blockEnd);

    return {
        value: nextValue,
        selectionStart: Math.max(blockStart, s + firstLineDelta),
        selectionEnd: Math.max(blockStart, e + totalDelta),
    };
}

export function extractMarkdownHeadings(value: string): MarkdownHeadingItem[] {
    const lines = (value || "").replace(/\r\n/g, "\n").split("\n");
    const headings: MarkdownHeadingItem[] = [];
    let inFence = false;
    let offset = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith("```")) {
            inFence = !inFence;
        } else if (!inFence) {
            const match = /^(#{1,3})\s+(.+)$/.exec(trimmed);
            if (match) {
                headings.push({
                    lineNumber: i + 1,
                    offset,
                    level: match[1].length as 1 | 2 | 3,
                    text: match[2].trim(),
                });
            }
        }
        offset += line.length + 1;
    }

    return headings;
}
