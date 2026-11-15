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
        return ["문서 최초 생성"];
    }

    const changes: string[] = [];

    if (before.title !== after.title || before.subtitle !== after.subtitle || before.category !== after.category) {
        changes.push("문서 제목·분류 수정");
    }

    if (JSON.stringify(before.tags) !== JSON.stringify(after.tags)) {
        changes.push("태그 수정");
    }

    if (JSON.stringify(before.linkedRoutes) !== JSON.stringify(after.linkedRoutes)) {
        changes.push(`연결 노선 변경 (${before.linkedRoutes.length} → ${after.linkedRoutes.length})`);
    }

    if (JSON.stringify(before.shuttle) !== JSON.stringify(after.shuttle)) {
        const beforeCount = (before.shuttle?.inbound_to_campus.length ?? 0) + (before.shuttle?.outbound_from_campus.length ?? 0);
        const afterCount = (after.shuttle?.inbound_to_campus.length ?? 0) + (after.shuttle?.outbound_from_campus.length ?? 0);
        changes.push(`셔틀 시간표 변경 (${beforeCount}회 → ${afterCount}회)`);
    }

    if (JSON.stringify(before.boardingStops) !== JSON.stringify(after.boardingStops)) {
        changes.push(`탑승 장소 변경 (${before.boardingStops.length}곳 → ${after.boardingStops.length}곳)`);
    }

    if (before.markdownBody !== after.markdownBody) {
        changes.push("본문 문서 수정");
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
        before.category !== after.category ||
        (before.cityCode ?? "") !== (after.cityCode ?? "") ||
        JSON.stringify(before.tags) !== JSON.stringify(after.tags) ||
        JSON.stringify(before.linkedRoutes) !== JSON.stringify(after.linkedRoutes) ||
        JSON.stringify(before.shuttle) !== JSON.stringify(after.shuttle) ||
        JSON.stringify(before.boardingStops) !== JSON.stringify(after.boardingStops) ||
        before.markdownBody !== after.markdownBody
    );
}
