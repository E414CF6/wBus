import {UI_TEXT} from "@shared/config/locale";
import type {WikiDiffStats, WikiPageDocument} from "../types";

export interface WikiLineDiffEntry {
    type: "equal" | "add" | "remove";
    line: string;
    oldLineNumber: number | null;
    newLineNumber: number | null;
}

/**
 * Computes a line-by-line LCS diff between two markdown strings.
 * Caps DP table dimensions for very large documents by falling back cleanly.
 */
export function computeLineDiff(beforeText: string, afterText: string): WikiLineDiffEntry[] {
    const a = (beforeText || "").replace(/\r\n/g, "\n").split("\n");
    const b = (afterText || "").replace(/\r\n/g, "\n").split("\n");

    const m = a.length;
    const n = b.length;

    // Guard against huge quadratic DP matrices
    if (m * n > 250_000) {
        const result: WikiLineDiffEntry[] = [];
        const maxLen = Math.max(m, n);
        for (let idx = 0; idx < maxLen; idx++) {
            const oldL = idx < m ? a[idx] : undefined;
            const newL = idx < n ? b[idx] : undefined;
            if (oldL === newL && oldL !== undefined) {
                result.push({type: "equal", line: oldL, oldLineNumber: idx + 1, newLineNumber: idx + 1});
            } else {
                if (oldL !== undefined) {
                    result.push({type: "remove", line: oldL, oldLineNumber: idx + 1, newLineNumber: null});
                }
                if (newL !== undefined) {
                    result.push({type: "add", line: newL, oldLineNumber: null, newLineNumber: idx + 1});
                }
            }
        }
        return result;
    }

    const dp: number[][] = Array.from({length: m + 1}, () => new Array<number>(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
        for (let j = n - 1; j >= 0; j--) {
            if (a[i] === b[j]) {
                dp[i][j] = dp[i + 1][j + 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }
    }

    const entries: WikiLineDiffEntry[] = [];
    let i = 0;
    let j = 0;
    while (i < m && j < n) {
        if (a[i] === b[j]) {
            entries.push({
                type: "equal",
                line: a[i],
                oldLineNumber: i + 1,
                newLineNumber: j + 1,
            });
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            entries.push({
                type: "remove",
                line: a[i],
                oldLineNumber: i + 1,
                newLineNumber: null,
            });
            i++;
        } else {
            entries.push({
                type: "add",
                line: b[j],
                oldLineNumber: null,
                newLineNumber: j + 1,
            });
            j++;
        }
    }

    while (i < m) {
        entries.push({type: "remove", line: a[i], oldLineNumber: i + 1, newLineNumber: null});
        i++;
    }
    while (j < n) {
        entries.push({type: "add", line: b[j], oldLineNumber: null, newLineNumber: j + 1});
        j++;
    }

    return entries;
}

export function computeStructuredChanges(
    before: WikiPageDocument | null,
    after: WikiPageDocument
): string[] {
    if (!before) {
        return [UI_TEXT.WIKI.DIFF.INITIAL_CREATE];
    }

    const changes: string[] = [];

    if (before.title !== after.title || before.subtitle !== after.subtitle) {
        changes.push(UI_TEXT.WIKI.DIFF.TITLE_SUBTITLE_CHANGED);
    }

    if (before.pinColor !== after.pinColor) {
        changes.push(UI_TEXT.WIKI.DIFF.PIN_COLOR_CHANGED);
    }

    if ((before.lat ?? null) !== (after.lat ?? null) || (before.lng ?? null) !== (after.lng ?? null)) {
        changes.push(UI_TEXT.WIKI.DIFF.PIN_LOCATION_CHANGED);
    }

    if (JSON.stringify(before.tags) !== JSON.stringify(after.tags)) {
        changes.push(UI_TEXT.WIKI.DIFF.TAGS_CHANGED);
    }

    if (before.markdownBody !== after.markdownBody) {
        changes.push(UI_TEXT.WIKI.DIFF.BODY_CHANGED);
    }

    return changes;
}

export function computeWikiDiffStats(
    before: WikiPageDocument | null,
    after: WikiPageDocument
): WikiDiffStats {
    const lineDiff = computeLineDiff(before?.markdownBody ?? "", after.markdownBody);
    let added = 0;
    let removed = 0;
    for (const entry of lineDiff) {
        if (entry.type === "add") added++;
        else if (entry.type === "remove") removed++;
    }

    return {
        added,
        removed,
        structuredChanges: computeStructuredChanges(before, after),
    };
}

export function hasWikiContentChanged(
    before: WikiPageDocument,
    after: WikiPageDocument
): boolean {
    return (
        before.title !== after.title ||
        before.subtitle !== after.subtitle ||
        before.pinColor !== after.pinColor ||
        (before.lat ?? null) !== (after.lat ?? null) ||
        (before.lng ?? null) !== (after.lng ?? null) ||
        JSON.stringify(before.tags) !== JSON.stringify(after.tags) ||
        before.markdownBody !== after.markdownBody
    );
}
