"use client";

import {getNoticeDetail, getNoticeList} from "./api";
import type {NoticeDetail, NoticeListResponse} from "./types";
import {APP_CONFIG} from "@shared/config/env";
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

export function useNoticeList(page = 1, searchText = "", searchGb = "title") {
    const key = ["noticeList", page, searchText, searchGb];

    const {data, error, isLoading, mutate} = useSWR<NoticeListResponse>(
        key,
        () => getNoticeList(page, searchText, searchGb),
        NOTICE_LIST_SWR_OPTIONS
    );

    if (error && APP_CONFIG.IS_DEV) {
        console.error("[useNoticeList] Error fetching notice list", error);
    }

    return {
        data: data ? ("data" in data ? (data as unknown as { data: NoticeListResponse }).data : data) : null,
        loading: isLoading,
        error,
        refresh: mutate,
    };
}

export function useNoticeDetail(id: string | null) {
    const key = id ? ["noticeDetail", id] : null;

    const {data, error, isLoading} = useSWR<NoticeDetail>(
        key,
        () => (id ? getNoticeDetail(id) : Promise.reject("No ID")),
        NOTICE_DETAIL_SWR_OPTIONS
    );

    if (error && APP_CONFIG.IS_DEV) {
        console.error(`[useNoticeDetail] Error fetching notice detail for ${id}`, error);
    }

    return {
        notice: data ? ("data" in data ? (data as unknown as { data: NoticeDetail }).data : data) : null,
        loading: isLoading,
        error,
    };
}
