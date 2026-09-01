"use client";

import {getNoticeDetail, getNoticeList} from "./api";
import type {NoticeDetail, NoticeListResponse} from "./types";

import {APP_CONFIG, STORAGE_KEYS} from "@shared/config/env";

import useSWR from "swr";

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

// Helper to get cached notice list from localStorage
function getLocalNoticeListFallback(page: number, searchText: string, searchGb: string): NoticeListResponse | undefined {
    if (typeof window === "undefined" || page !== 1 || searchText !== "") return undefined;
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.NOTICE_LIST_CACHE);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.notices) && parsed.notices.length > 0) {
                return parsed;
            }
        }
    } catch {
        // Ignore
    }
    return undefined;
}

// Helper to get cached notice detail from localStorage
function getLocalNoticeDetailFallback(id: string | null): NoticeDetail | undefined {
    if (typeof window === "undefined" || !id) return undefined;
    try {
        const raw = localStorage.getItem(`${STORAGE_KEYS.NOTICE_DETAIL_PREFIX}${id}`);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.id === id) {
                return parsed;
            }
        }
    } catch {
        // Ignore
    }
    return undefined;
}

export function useNoticeList(page = 1, searchText = "", searchGb = "title") {
    const key = ["noticeList", page, searchText, searchGb];

    const {data, error, isLoading, mutate} = useSWR<NoticeListResponse>(
        key,
        async () => {
            const res = await getNoticeList(page, searchText, searchGb);
            // Save page 1 default list to localStorage for instant cache next time
            if (typeof window !== "undefined" && page === 1 && !searchText) {
                try {
                    localStorage.setItem(STORAGE_KEYS.NOTICE_LIST_CACHE, JSON.stringify(res));
                } catch {
                    // Ignore storage quota errors
                }
            }
            return res;
        },
        {
            ...NOTICE_LIST_SWR_OPTIONS,
            fallbackData: getLocalNoticeListFallback(page, searchText, searchGb),
        }
    );

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

    const {data, error, isLoading} = useSWR<NoticeDetail>(
        key,
        async () => {
            if (!id) throw new Error("No ID");
            const res = await getNoticeDetail(id);
            if (typeof window !== "undefined" && res && res.id) {
                try {
                    localStorage.setItem(`${STORAGE_KEYS.NOTICE_DETAIL_PREFIX}${id}`, JSON.stringify(res));
                } catch {
                    // Ignore
                }
            }
            return res;
        },
        {
            ...NOTICE_DETAIL_SWR_OPTIONS,
            fallbackData: getLocalNoticeDetailFallback(id),
        }
    );

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
