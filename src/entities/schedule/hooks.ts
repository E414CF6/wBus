"use client";

import useSWR from "swr";
import {useCallback, useEffect, useState} from "react";

import type {BusCacheData, CacheMetadata, ScheduleApiResponse} from "./types";
import {idbGet, idbSet} from "@shared/cache/idbStorage";
import {STORAGE_KEYS} from "@shared/config/env";

const SCHEDULE_IDB_TTL_MS = 24 * 60 * 60 * 1000;
let legacyScheduleCleaned = false;

function cleanupLegacyScheduleStorage(): void {
    if (legacyScheduleCleaned || typeof window === "undefined") return;
    legacyScheduleCleaned = true;
    try {
        localStorage.removeItem(STORAGE_KEYS.SCHEDULE_CACHE);
    } catch {
        // Ignore storage errors
    }
}

const SCHEDULE_SWR_OPTIONS = {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    revalidateIfStale: false,
    dedupingInterval: 60000,
    errorRetryCount: 2,
} as const;

type CachedScheduleSnapshot = { data: BusCacheData; meta: CacheMetadata | null };

async function getIdbScheduleFallback(): Promise<CachedScheduleSnapshot | undefined> {
    if (typeof window === "undefined") return undefined;
    cleanupLegacyScheduleStorage();
    const cached = await idbGet<CachedScheduleSnapshot>(STORAGE_KEYS.SCHEDULE_CACHE);
    if (cached?.data?.routes?.length) {
        return {
            data: cached.data,
            meta: cached.meta || null,
        };
    }
    return undefined;
}

async function fetchScheduleApi(): Promise<CachedScheduleSnapshot> {
    cleanupLegacyScheduleStorage();
    const res = await fetch("/api/schedule");
    if (res.status === 304) {
        const local = await getIdbScheduleFallback();
        if (local) return local;
        // If 304 received without body and local cache is missing, refetch without conditional cache
        const freshRes = await fetch("/api/schedule", {cache: "reload"});
        const freshJson: ScheduleApiResponse = await freshRes.json();
        if (freshJson.success && freshJson.data) {
            const freshResult = {data: freshJson.data, meta: freshJson.meta || null};
            void idbSet(STORAGE_KEYS.SCHEDULE_CACHE, freshResult, SCHEDULE_IDB_TTL_MS);
            return freshResult;
        }
    }
    const json: ScheduleApiResponse = await res.json();
    if (!json.success || !json.data) {
        throw new Error(json.error || "시간표 데이터를 불러올 수 없습니다.");
    }
    const result = {
        data: json.data,
        meta: json.meta || null,
    };
    void idbSet(STORAGE_KEYS.SCHEDULE_CACHE, result, SCHEDULE_IDB_TTL_MS);
    return result;
}

export function useSchedule(enabled: boolean = true) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshToast, setRefreshToast] = useState<{
        type: "success" | "info" | "error";
        message: string;
    } | null>(null);

    const {data, error, isLoading, mutate} = useSWR(
        enabled ? "scheduleData" : null,
        fetchScheduleApi,
        SCHEDULE_SWR_OPTIONS
    );

    useEffect(() => {
        let cancelled = false;
        if (enabled && !data) {
            void getIdbScheduleFallback().then((local) => {
                if (!cancelled && local) {
                    void mutate(local, false);
                }
            });
        }
        return () => {
            cancelled = true;
        };
    }, [enabled, data, mutate]);

    const refresh = useCallback(async (force = true) => {
        setIsRefreshing(true);
        try {
            const endpoint = force ? "/api/schedule/refresh?force=true" : "/api/schedule";
            const method = force ? "POST" : "GET";
            const res = await fetch(endpoint, {
                method,
                ...(force ? {cache: "no-store", headers: {"Cache-Control": "no-cache"}} : {}),
            });
            const json: ScheduleApiResponse = await res.json();
            if (!json.success || !json.data) {
                throw new Error(json.error || "시간표 갱신에 실패했습니다.");
            }
            const updated = {
                data: json.data,
                meta: json.meta || null,
            };
            void idbSet(STORAGE_KEYS.SCHEDULE_CACHE, updated, SCHEDULE_IDB_TTL_MS);
            await mutate(updated, false);
            if (force) {
                setRefreshToast({
                    type: json.refreshed ? "success" : "info",
                    message: json.message || (json.refreshed ? "최신 시간표로 갱신되었습니다." : "최신 시간표가 이미 유지되고 있습니다."),
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
