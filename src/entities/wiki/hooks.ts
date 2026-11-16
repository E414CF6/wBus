"use client";

import {useCallback, useSyncExternalStore} from "react";
import useSWR, {mutate as globalMutate} from "swr";
import type {WikiIndexData, WikiPageDocument, WikiRevision, WikiRevisionMeta,} from "./types";

const WIKI_NICKNAME_KEY = "wbus_wiki_nickname_v1";

async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, {cache: "no-store"});
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = body?.error || `요청 실패 (${res.status})`;
        const err = new Error(msg) as Error & { status?: number; payload?: unknown };
        err.status = res.status;
        err.payload = body;
        throw err;
    }
    return (await res.json()) as T;
}

export function useWikiIndex(options?: {
    cityCode?: string;
    pinsOnly?: boolean;
    query?: string;
    limit?: number;
    offset?: number;
    enabled?: boolean;
    fallbackData?: WikiIndexData;
}) {
    const params = new URLSearchParams();
    if (options?.cityCode) {
        params.set("cityCode", options.cityCode);
    }
    if (options?.pinsOnly) {
        params.set("pinsOnly", "true");
    }
    if (options?.query && options.query.trim()) {
        params.set("q", options.query.trim());
    }
    if (options?.limit && options.limit > 0) {
        params.set("limit", String(options.limit));
    }
    if (options?.offset && options.offset > 0) {
        params.set("offset", String(options.offset));
    }
    const qs = params.toString();
    const enabled = options?.enabled ?? true;
    const key = enabled ? (qs ? `/api/wiki?${qs}` : "/api/wiki") : null;

    return useSWR<WikiIndexData>(key, fetchJson, {
        fallbackData: options?.fallbackData,
        revalidateOnFocus: false,
        dedupingInterval: 10_000,
    });
}

export function useWikiPins(options?: { cityCode?: string; enabled?: boolean }) {
    return useWikiIndex({
        pinsOnly: true,
        cityCode: options?.cityCode,
        limit: 100,
        enabled: options?.enabled ?? true,
    });
}

export function mutateAllWikiQueries(): Promise<unknown[]> {
    return globalMutate(
        (key) => typeof key === "string" && key.startsWith("/api/wiki"),
        undefined,
        {revalidate: true}
    );
}

export function useWikiPage(slug: string | null | undefined, fallbackData?: WikiPageDocument) {
    const key = slug ? `/api/wiki/${encodeURIComponent(slug)}` : null;

    return useSWR<WikiPageDocument>(key, fetchJson, {
        fallbackData,
        revalidateOnFocus: false,
        dedupingInterval: 5_000,
    });
}

export interface WikiRevisionsResponse {
    slug: string;
    revisions: WikiRevisionMeta[];
    selectedRevision?: WikiRevision | null;
    compareRevision?: WikiRevision | null;
}

export function useWikiRevisions(
    slug: string | null | undefined,
    enabled: boolean,
    version?: number | null,
    compareTo?: number | null
) {
    const params = new URLSearchParams();
    if (version && version > 0) params.set("version", String(version));
    if (compareTo && compareTo > 0) params.set("compareTo", String(compareTo));
    const qs = params.toString();
    const key =
        enabled && slug
            ? `/api/wiki/${encodeURIComponent(slug)}/revisions${qs ? `?${qs}` : ""}`
            : null;

    return useSWR<WikiRevisionsResponse>(key, fetchJson, {
        revalidateOnFocus: false,
        dedupingInterval: 2_000,
    });
}

const emptySubscribe = () => () => {
};

function readNicknameFromStorage(): string {
    if (typeof window === "undefined") return "";
    try {
        return window.localStorage.getItem(WIKI_NICKNAME_KEY) || "";
    } catch {
        return "";
    }
}

export function useWikiNickname() {
    const stored = useSyncExternalStore(
        emptySubscribe,
        readNicknameFromStorage,
        () => ""
    );

    const saveNickname = useCallback((nickname: string) => {
        if (typeof window === "undefined") return;
        try {
            const trimmed = nickname.trim().slice(0, 24);
            if (trimmed) {
                window.localStorage.setItem(WIKI_NICKNAME_KEY, trimmed);
            } else {
                window.localStorage.removeItem(WIKI_NICKNAME_KEY);
            }
        } catch {
            // Ignore localStorage failure
        }
    }, []);

    return {storedNickname: stored, saveNickname};
}
