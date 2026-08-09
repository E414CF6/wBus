"use client";

import {getNoticeDetail, getNoticeList} from "./api";
import type {NoticeDetail, NoticeListResponse} from "./types";
import {APP_CONFIG} from "@shared/config/env";
import useSWR from "swr";

const NOTICE_SWR_OPTIONS = {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    revalidateIfStale: true,
    refreshInterval: 60000,
    dedupingInterval: 10000,
    errorRetryCount: 2,
} as const;

export function useNoticeList(page = 1, searchText = "", searchGb = "title") {
    const key = ["noticeList", page, searchText, searchGb];

    const {data, error, isLoading, mutate} = useSWR<NoticeListResponse>(
        key,
        () => getNoticeList(page, searchText, searchGb),
        NOTICE_SWR_OPTIONS
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
        NOTICE_SWR_OPTIONS
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
