import {DEFAULT_WIKI_PIN_COLOR, WIKI_PIN_COLORS, type WikiPinColor} from "@entities/wiki";
import type {WikiFormDraft} from "../WikiCreateForm";

export interface WikiLocalDraft extends WikiFormDraft {
    version: 1;
    key: string;
    baseVersion?: number;
    savedAt: string;
}

const DRAFT_PREFIX = "wbus_wiki_draft_v1:";
const draftSubscribers = new Set<() => void>();

function notifyDraftSubscribers() {
    for (const listener of draftSubscribers) {
        listener();
    }
}

export function subscribeWikiLocalDraft(listener: () => void): () => void {
    draftSubscribers.add(listener);
    if (typeof window !== "undefined") {
        window.addEventListener("storage", listener);
    }
    return () => {
        draftSubscribers.delete(listener);
        if (typeof window !== "undefined") {
            window.removeEventListener("storage", listener);
        }
    };
}

export function readRawWikiLocalDraft(key: string): string | null {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function getWikiEditDraftKey(slug: string): string {
    return `${DRAFT_PREFIX}edit:${slug.trim()}`;
}

export function getWikiCreateDraftKey(initialSlug?: string): string {
    const normalized = (initialSlug ?? "").trim();
    return `${DRAFT_PREFIX}create:${normalized || "__new__"}`;
}

function isValidPinColor(val: unknown): val is WikiPinColor {
    return typeof val === "string" && (WIKI_PIN_COLORS as readonly string[]).includes(val);
}

export function parseWikiLocalDraft(raw: string | null): WikiLocalDraft | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
            return null;
        }
        if (typeof parsed.title !== "string" || typeof parsed.markdownBody !== "string") {
            return null;
        }
        const lat = typeof parsed.lat === "number" && Number.isFinite(parsed.lat) ? parsed.lat : undefined;
        const lng = typeof parsed.lng === "number" && Number.isFinite(parsed.lng) ? parsed.lng : undefined;
        const hasPairedCoords = lat !== undefined && lng !== undefined;

        return {
            version: 1,
            key: typeof parsed.key === "string" ? parsed.key : "",
            baseVersion:
                typeof parsed.baseVersion === "number" && Number.isInteger(parsed.baseVersion)
                    ? parsed.baseVersion
                    : undefined,
            title: parsed.title,
            subtitle: typeof parsed.subtitle === "string" ? parsed.subtitle : "",
            pinColor: isValidPinColor(parsed.pinColor) ? parsed.pinColor : DEFAULT_WIKI_PIN_COLOR,
            tagsText: typeof parsed.tagsText === "string" ? parsed.tagsText : "",
            markdownBody: parsed.markdownBody,
            lat: hasPairedCoords ? lat : undefined,
            lng: hasPairedCoords ? lng : undefined,
            summary: typeof parsed.summary === "string" ? parsed.summary : "",
            savedAt:
                typeof parsed.savedAt === "string" && parsed.savedAt
                    ? parsed.savedAt
                    : new Date().toISOString(),
        };
    } catch {
        return null;
    }
}

export function readWikiLocalDraft(key: string): WikiLocalDraft | null {
    if (typeof window === "undefined") return null;
    try {
        return parseWikiLocalDraft(window.localStorage.getItem(key));
    } catch {
        return null;
    }
}

export function writeWikiLocalDraft(
    key: string,
    draft: Omit<WikiLocalDraft, "version" | "key" | "savedAt"> & { savedAt?: string },
): WikiLocalDraft | null {
    const payload: WikiLocalDraft = {
        version: 1,
        key,
        baseVersion: draft.baseVersion,
        title: draft.title,
        subtitle: draft.subtitle,
        pinColor: draft.pinColor,
        tagsText: draft.tagsText,
        markdownBody: draft.markdownBody,
        lat: draft.lat,
        lng: draft.lng,
        summary: draft.summary ?? "",
        savedAt: draft.savedAt ?? new Date().toISOString(),
    };

    if (typeof window === "undefined") return payload;
    try {
        window.localStorage.setItem(key, JSON.stringify(payload));
        notifyDraftSubscribers();
        return payload;
    } catch {
        return null;
    }
}

export function clearWikiLocalDraft(key: string): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(key);
        notifyDraftSubscribers();
    } catch {
        // Ignore storage errors
    }
}

function normalizeTagsForCompare(tagsText: string): string {
    return tagsText
        .split(",")
        .map((t) => t.trim().replace(/^#+/, ""))
        .filter(Boolean)
        .join(",");
}

export function isWikiFormDirty(
    current: WikiFormDraft,
    baseline: WikiFormDraft,
): boolean {
    return (
        current.title.trim() !== baseline.title.trim() ||
        current.subtitle.trim() !== baseline.subtitle.trim() ||
        current.pinColor !== baseline.pinColor ||
        (current.lat ?? null) !== (baseline.lat ?? null) ||
        (current.lng ?? null) !== (baseline.lng ?? null) ||
        normalizeTagsForCompare(current.tagsText) !== normalizeTagsForCompare(baseline.tagsText) ||
        current.markdownBody !== baseline.markdownBody
    );
}
