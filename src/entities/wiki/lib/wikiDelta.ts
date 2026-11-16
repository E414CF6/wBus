import type {
    WikiFieldsPatch,
    WikiMarkdownPatch,
    WikiMarkdownPatchOp,
    WikiPageDocument,
    WikiRevisionDelta,
    WikiRevisionMeta,
} from "../types";
import {computeLineDiff} from "./wikiDiff";

export const WIKI_CHECKPOINT_INTERVAL = 10;

/**
 * Stores full snapshots on v1, every Nth version, and explicit reverts so
 * delta chains remain bounded (max WIKI_CHECKPOINT_INTERVAL - 1 hops).
 */
export function shouldStoreCheckpoint(
    version: number,
    options?: { isRevert?: boolean }
): boolean {
    if (options?.isRevert) return true;
    if (version <= 1) return true;
    return version % WIKI_CHECKPOINT_INTERVAL === 0;
}

function splitNormalizedLines(text: string): string[] {
    return (text || "").replace(/\r\n/g, "\n").split("\n");
}

/**
 * Computes a lossless run-length-encoded line patch using computeLineDiff.
 */
export function createMarkdownPatch(beforeText: string, afterText: string): WikiMarkdownPatch {
    const diff = computeLineDiff(beforeText, afterText);
    const ops: WikiMarkdownPatchOp[] = [];

    for (const entry of diff) {
        const prevOp = ops[ops.length - 1];
        if (entry.type === "equal") {
            if (prevOp && prevOp.op === "keep") {
                prevOp.count += 1;
            } else {
                ops.push({op: "keep", count: 1});
            }
        } else if (entry.type === "remove") {
            if (prevOp && prevOp.op === "del") {
                prevOp.count += 1;
            } else {
                ops.push({op: "del", count: 1});
            }
        } else {
            if (prevOp && prevOp.op === "ins") {
                prevOp.lines.push(entry.line);
            } else {
                ops.push({op: "ins", lines: [entry.line]});
            }
        }
    }

    return {ops};
}

/**
 * Reconstructs markdown string losslessly from a base string and WikiMarkdownPatch.
 */
export function applyMarkdownPatch(beforeText: string, patch: WikiMarkdownPatch): string {
    const sourceLines = splitNormalizedLines(beforeText);
    const outLines: string[] = [];
    let cursor = 0;

    for (const op of patch.ops) {
        if (op.op === "keep") {
            const end = cursor + op.count;
            if (end > sourceLines.length) {
                throw new Error(`Wiki delta keep range out of bounds (${end} > ${sourceLines.length})`);
            }
            for (let i = cursor; i < end; i++) {
                outLines.push(sourceLines[i]);
            }
            cursor = end;
        } else if (op.op === "del") {
            const end = cursor + op.count;
            if (end > sourceLines.length) {
                throw new Error(`Wiki delta del range out of bounds (${end} > ${sourceLines.length})`);
            }
            cursor = end;
        } else {
            for (const line of op.lines) {
                outLines.push(line);
            }
        }
    }

    while (cursor < sourceLines.length) {
        outLines.push(sourceLines[cursor]);
        cursor++;
    }

    return outLines.join("\n");
}

/**
 * Computes minimal sparse delta between two sequential WikiPageDocument states.
 */
export function computeWikiDelta(
    before: WikiPageDocument,
    after: WikiPageDocument
): WikiRevisionDelta {
    const fieldsPatch: WikiFieldsPatch = {};

    if (before.title !== after.title) fieldsPatch.title = after.title;
    if (before.subtitle !== after.subtitle) fieldsPatch.subtitle = after.subtitle;
    if (before.pinColor !== after.pinColor) fieldsPatch.pinColor = after.pinColor;
    if ((before.lat ?? null) !== (after.lat ?? null)) {
        fieldsPatch.lat = after.lat ?? null;
    }
    if ((before.lng ?? null) !== (after.lng ?? null)) {
        fieldsPatch.lng = after.lng ?? null;
    }
    if (JSON.stringify(before.tags) !== JSON.stringify(after.tags)) {
        fieldsPatch.tags = after.tags;
    }

    const delta: WikiRevisionDelta = {};
    if (Object.keys(fieldsPatch).length > 0) {
        delta.fieldsPatch = fieldsPatch;
    }

    const beforeNorm = (before.markdownBody || "").replace(/\r\n/g, "\n");
    const afterNorm = (after.markdownBody || "").replace(/\r\n/g, "\n");
    if (beforeNorm !== afterNorm) {
        delta.markdownPatch = createMarkdownPatch(before.markdownBody, after.markdownBody);
    }

    return delta;
}

/**
 * Applies a single revision delta onto a prior WikiPageDocument snapshot.
 */
export function applyWikiDelta(
    base: WikiPageDocument,
    delta: WikiRevisionDelta,
    revisionMeta: Pick<WikiRevisionMeta, "version" | "editor" | "createdAt"> & {
        isProtected?: boolean;
    }
): WikiPageDocument {
    const fp = delta.fieldsPatch;
    const nextLat =
        fp && "lat" in fp ? (fp.lat ?? undefined) : base.lat;
    const nextLng =
        fp && "lng" in fp ? (fp.lng ?? undefined) : base.lng;

    return {
        ...base,
        title: fp?.title ?? base.title,
        subtitle: fp?.subtitle ?? base.subtitle,
        pinColor: fp?.pinColor ?? base.pinColor,
        lat: nextLat,
        lng: nextLng,
        tags: fp?.tags ?? base.tags,
        markdownBody: delta.markdownPatch
            ? applyMarkdownPatch(base.markdownBody, delta.markdownPatch)
            : base.markdownBody,
        version: revisionMeta.version,
        updatedAt: revisionMeta.createdAt,
        lastEditor: revisionMeta.editor,
        ...(revisionMeta.isProtected !== undefined
            ? {isProtected: revisionMeta.isProtected}
            : {}),
    };
}
