"use client";

import useSWR from "swr";
import {useEffect} from "react";

import {getNoticeDetail, getNoticeList} from "./api";
import type {NoticeDetail, NoticeListResponse} from "./types";

import {CacheManager} from "@shared/cache/CacheManager";
import {APP_CONFIG, STORAGE_KEYS} from "@shared/config/env";

const TEN_MIN_MS = 10 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const noticeListCache = new CacheManager<NoticeListResponse>({
    maxSize: 20,
    ttlMs: TEN_MIN_MS,
    storagePrefix: `${STORAGE_KEYS.NOTICE_LIST_CACHE}_`,
    maxStorageEntries: 3,
});

const noticeDetailCache = new CacheManager<NoticeDetail>({
    maxSize: 50,
    ttlMs: ONE_DAY_MS,
    storagePrefix: STORAGE_KEYS.NOTICE_DETAIL_PREFIX,
    maxStorageEntries: 20,
});

let legacyNoticeCleaned = false;

function cleanupLegacyNoticeStorage(): void {
    if (legacyNoticeCleaned || typeof window === "undefined") return;
    legacyNoticeCleaned = true;
    try {
        localStorage.removeItem(STORAGE_KEYS.NOTICE_LIST_CACHE);
    } catch {
        // Ignore storage errors
    }
}

const NOTICE_LIST_SWR_OPTIONS = {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    revalidateIfStale: true,
    refreshInterval: 300000, // 5 min interval for notice list
    dedupingInterval: 30000,
    errorRetryCount: 2,
} as const;

const NOTICE_DETAIL_SWR_OPTIONS = {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    dedupingInterval: 60000,
    errorRetryCount: 2,
} as const;

function getLocalNoticeListFallback(page: number, searchText: string): NoticeListResponse | undefined {
    if (typeof window === "undefined" || page !== 1 || searchText !== "") return undefined;
    cleanupLegacyNoticeStorage();
    return noticeListCache.get("p1") ?? undefined;
}

function getLocalNoticeDetailFallback(id: string | null): NoticeDetail | undefined {
    if (typeof window === "undefined" || !id) return undefined;
    return noticeDetailCache.get(id) ?? undefined;
}

export function useNoticeList(page = 1, searchText = "", searchGb = "title") {
    const key = ["noticeList", page, searchText, searchGb];

    const {data, error, isLoading, mutate} = useSWR<NoticeListResponse>(
        key,
        async () => {
            const res = await getNoticeList(page, searchText, searchGb);
            if (typeof window !== "undefined" && page === 1 && !searchText) {
                noticeListCache.set("p1", res);
            }
            return res;
        },
        NOTICE_LIST_SWR_OPTIONS
    );

    useEffect(() => {
        if (!data && page === 1 && !searchText) {
            const local = getLocalNoticeListFallback(page, searchText);
            if (local) {
                mutate(local, false);
            }
        }
    }, [data, page, searchText, searchGb, mutate]);

    if (error && APP_CONFIG.IS_DEV) {
        console.error("[useNoticeList] Error fetching notice list", error);
    }

    const unwrappedData = data
        ? "data" in data
            ? (data as unknown as { data: NoticeListResponse }).data
            : data
        : null;

    return {
        data: unwrappedData,
        loading: isLoading && !unwrappedData,
        error,
        refresh: mutate,
    };
}

export function useNoticeDetail(id: string | null) {
    const key = id ? ["noticeDetail", id] : null;

    const {data, error, isLoading, mutate} = useSWR<NoticeDetail>(
        key,
        async () => {
            if (!id) throw new Error("No ID");
            const res = await getNoticeDetail(id);
            if (typeof window !== "undefined" && res && res.id) {
                noticeDetailCache.set(id, res);
            }
            return res;
        },
        NOTICE_DETAIL_SWR_OPTIONS
    );

    useEffect(() => {
        if (!data && id) {
            const local = getLocalNoticeDetailFallback(id);
            if (local) {
                mutate(local, false);
            }
        }
    }, [data, id, mutate]);

    if (error && APP_CONFIG.IS_DEV) {
        console.error(`[useNoticeDetail] Error fetching notice detail for ${id}`, error);
    }

    const unwrappedNotice = data
        ? "data" in data
            ? (data as unknown as { data: NoticeDetail }).data
            : data
        : null;

    return {
        notice: unwrappedNotice,
        loading: isLoading && !unwrappedNotice,
        error,
    };
}
