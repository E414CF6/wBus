"use client";

import {ApiResponse, BusCacheData, CacheMetadata} from "@shared/types/bus";
import {STORAGE_KEYS} from "@shared/config/env";
import useSWR from "swr";
import {useCallback, useState} from "react";

const SCHEDULE_SWR_OPTIONS = {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    revalidateIfStale: false,
    dedupingInterval: 60000,
    errorRetryCount: 2,
} as const;

function getLocalScheduleFallback(): { data: BusCacheData; meta: CacheMetadata | null } | undefined {
    if (typeof window === "undefined") return undefined;
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.SCHEDULE_CACHE);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.data?.routes?.length) {
                return {
                    data: parsed.data,
                    meta: parsed.meta || null,
                };
            }
        }
    } catch {
        // Ignore
    }
    return undefined;
}

async function fetchScheduleApi(): Promise<{ data: BusCacheData; meta: CacheMetadata | null }> {
    const res = await fetch("/api/schedule");
    if (res.status === 304) {
        const local = getLocalScheduleFallback();
        if (local) return local;
    }
    const json: ApiResponse<BusCacheData> = await res.json();
    if (!json.success || !json.data) {
        throw new Error(json.error || "시간표 데이터를 불러올 수 없습니다.");
    }
    const result = {
        data: json.data,
        meta: json.meta || null,
    };
    try {
        localStorage.setItem(STORAGE_KEYS.SCHEDULE_CACHE, JSON.stringify(result));
    } catch {
        // Storage limit
    }
    return result;
}

export function useSchedule() {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshToast, setRefreshToast] = useState<{
        type: "success" | "info" | "error";
        message: string;
    } | null>(null);

    const {data, error, isLoading, mutate} = useSWR(
        "scheduleData",
        fetchScheduleApi,
        {
            ...SCHEDULE_SWR_OPTIONS,
            fallbackData: getLocalScheduleFallback(),
        }
    );

    const refresh = useCallback(async (force = true) => {
        setIsRefreshing(true);
        try {
            const endpoint = force ? "/api/schedule/refresh?force=true" : "/api/schedule";
            const method = force ? "POST" : "GET";
            const res = await fetch(endpoint, {
                method,
                ...(force ? {cache: "no-store", headers: {"Cache-Control": "no-cache"}} : {}),
            });
            const json: ApiResponse<BusCacheData> = await res.json();
            if (!json.success || !json.data) {
                throw new Error(json.error || "시간표 갱신에 실패했습니다.");
            }
            const updated = {
                data: json.data,
                meta: json.meta || null,
            };
            try {
                localStorage.setItem(STORAGE_KEYS.SCHEDULE_CACHE, JSON.stringify(updated));
            } catch {
                // Storage limit
            }
            await mutate(updated, false);
            if (force) {
                setRefreshToast({
                    type: json.refreshed ? "success" : "info",
                    message: json.message || (json.refreshed ? "원주시 ITS 실시간 최신 시간표로 갱신되었습니다." : "최신 시간표가 이미 유지되고 있습니다."),
                });
            }
        } catch (err) {
            setRefreshToast({
                type: "error",
                message: err instanceof Error ? err.message : "시간표 갱신 중 오류가 발생했습니다.",
            });
        } finally {
            setIsRefreshing(false);
        }
    }, [mutate]);

    return {
        data: data?.data ?? null,
        routes: data?.data?.routes ?? [],
        meta: data?.meta ?? null,
        isLoading: isLoading && !data?.data,
        error: error ? (error instanceof Error ? error.message : "시간표 데이터를 불러오는데 실패했습니다.") : null,
        refresh,
        isRefreshing,
        refreshToast,
        clearRefreshToast: () => setRefreshToast(null),
    };
}
