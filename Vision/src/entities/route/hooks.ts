"use client";

import type {BusSchedule, RouteInfo} from "@entities/route/types";
import {getRouteInfo} from "@entities/route/api";

import {HttpError} from "@shared/api/fetchAPI";
import {API_CONFIG, APP_CONFIG} from "@shared/config/env";
import {UI_TEXT} from "@shared/config/locale";
import {loadStaticData} from "@shared/utils/dataLoader";

import {useMemo} from "react";
import useSWR from "swr";

const ROUTE_INFO_SWR_OPTIONS = {
    revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 60000, errorRetryCount: 2,
} as const;

/**
 * Fetches the schedule data from the network.
 * Returns `null` if the file is not found (404/403), otherwise throws an error.
 */
async function fetchScheduleData(routeId: string): Promise<BusSchedule | null> {
    try {
        return await loadStaticData<BusSchedule>(`${API_CONFIG.STATIC.PATHS.SCHEDULES}/${routeId}.json`);
    } catch (error) {
        // Treat 404 (Not Found) or 403 (Forbidden) as "Data Missing" (null) rather than an error
        if (error instanceof HttpError && (error.status === 404 || error.status === 403)) {
            return null;
        }
        throw error;
    }
}

export function useRouteInfo(routeName: string): RouteInfo | null {
    const {
        data, error
    } = useSWR<RouteInfo | null>(routeName ? ["routeInfo", routeName] : null, ([, name]: [string, string]) => getRouteInfo(name), ROUTE_INFO_SWR_OPTIONS);

    if (error && APP_CONFIG.IS_DEV) {
        console.error(`[useRouteInfo] Failed to fetch route info: ${routeName}`, error);
    }

    return data ?? null;
}

export function useRouteIds(routeName: string): string[] {
    const routeInfo = useRouteInfo(routeName);
    return useMemo(() => routeInfo?.vehicleRouteIds ?? [], [routeInfo]);
}

/**
 * Custom hook to fetch and manage bus schedule data.
 * Uses SWR in-memory cache while preserving missing/error semantics.
 *
 * @param routeId - The ID of the route to fetch (e.g., "34-1"). Pass null to reset.
 */
export function useScheduleData(routeId: string | null) {
    const normalizedRouteId = routeId?.trim() ?? "";
    const shouldFetch = normalizedRouteId !== "";

    const {
        data, error, isLoading
    } = useSWR<BusSchedule | null>(shouldFetch ? ["scheduleData", normalizedRouteId] : null, ([, id]: [string, string]) => fetchScheduleData(id), {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        dedupingInterval: 60000,
        shouldRetryOnError: false,
    });

    if (error && APP_CONFIG.IS_DEV) {
        console.error(UI_TEXT.ERROR.FETCH_FAILED(UI_TEXT.DATA_LABELS.SCHEDULE_DATA, 500), error);
    }

    const loading = shouldFetch && isLoading && data === undefined;
    const missing = shouldFetch && !loading && !error && data === null;
    const errorMessage = error ? UI_TEXT.ERROR.UNKNOWN(error instanceof Error ? error.message : String(error)) : null;

    return {data: data ?? null, loading, error: errorMessage, missing};
}
