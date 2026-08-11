"use client";

import type {RouteInfo} from "@entities/route/types";
import {getRouteInfo, getRouteMap} from "@entities/route/api";

import {APP_CONFIG} from "@shared/config/env";

import {useMemo} from "react";
import useSWR from "swr";

const ROUTE_INFO_SWR_OPTIONS = {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
    errorRetryCount: 2,
} as const;

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
 * Get (routeName) -> routeIds[] mapping for bus routes.
 * Example: { "30": ["30100123", "30100124"] }
 *
 * Uses SWR for caching and revalidation.
 */
export function useBusRouteMap(): Record<string, string[]> | null {
    const {data, error} = useSWR("busRouteMap",
        getRouteMap, {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            dedupingInterval: 60000,
            errorRetryCount: 3,
        });

    if (error && APP_CONFIG.IS_DEV) {
        console.error("[useBusRouteMap] Error fetching route map", error);
    }

    return data ?? null;
}
