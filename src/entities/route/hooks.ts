"use client";

import type {RouteInfo, RouteVariation} from "@entities/route/types";
import {getRouteInfo, getRouteMap, getRouteVariations} from "@entities/route/api";

import {APP_CONFIG} from "@shared/config/env";

import {useMemo} from "react";
import useSWR from "swr";

const ROUTE_INFO_SWR_OPTIONS = {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
    errorRetryCount: 2,
} as const;

export function useRouteInfo(routeName: string, enabled: boolean = true, cityCode: string = "32020"): RouteInfo | null {
    const {
        data, error
    } = useSWR<RouteInfo | null>(
        enabled && routeName ? ["routeInfo", cityCode, routeName] : null,
        async ([, cCode, name]: [string, string, string]) => {
            if (cCode === "32020") {
                return getRouteInfo(name);
            }
            try {
                const res = await fetch(`/api/routes?cityCode=${cCode}&routeNo=${encodeURIComponent(name)}`);
                if (!res.ok) return { routeName: name, vehicleRouteIds: [name] };
                const json = await res.json();
                const ids = json.route_numbers?.[name] || (json.routes?.[0]?.routeid ? [json.routes[0].routeid] : [name]);
                return { routeName: name, vehicleRouteIds: ids };
            } catch {
                return { routeName: name, vehicleRouteIds: [name] };
            }
        },
        ROUTE_INFO_SWR_OPTIONS
    );

    if (error && APP_CONFIG.IS_DEV) {
        console.error(`[useRouteInfo] Failed to fetch route info: ${routeName}`, error);
    }

    return data ?? null;
}

export function useRouteIds(routeName: string, enabled: boolean = true, cityCode: string = "32020"): string[] {
    const routeInfo = useRouteInfo(routeName, enabled, cityCode);
    return useMemo(() => routeInfo?.vehicleRouteIds ?? (routeName ? [routeName] : []), [routeInfo, routeName]);
}

/**
 * Get (routeName) -> routeIds[] mapping for bus routes.
 * Example: { "30": ["30100123", "30100124"] }
 *
 * Uses SWR for caching and revalidation.
 */
export function useBusRouteMap(enabled: boolean = true, cityCode: string = "32020"): Record<string, string[]> | null {
    const key = enabled ? (cityCode === "32020" ? "busRouteMap" : `busRouteMap:${cityCode}`) : null;
    const fetcher = async () => {
        if (cityCode === "32020") {
            return getRouteMap();
        }
        const res = await fetch(`/api/routes?cityCode=${cityCode}`);
        if (!res.ok) throw new Error("Failed to fetch city routes");
        const json = await res.json();
        return (json.route_numbers || {}) as Record<string, string[]>;
    };

    const {data, error} = useSWR(key, fetcher, {
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

/**
 * Hook to retrieve all variations of a route, with ordered stops,
 * user-friendly variation labels, and turning point detection.
 */
export function useRouteVariations(routeName: string, enabled: boolean = true) {
    const {data, error, isLoading} = useSWR<RouteVariation[]>(
        enabled && routeName ? ["routeVariations", routeName] : null,
        ([, name]: [string, string]) => getRouteVariations(name),
        ROUTE_INFO_SWR_OPTIONS
    );

    if (error && APP_CONFIG.IS_DEV) {
        console.error(`[useRouteVariations] Failed to fetch variations: ${routeName}`, error);
    }

    return {
        variations: data ?? [],
        isLoading: isLoading && !data,
        error: error ? (error instanceof Error ? error.message : "Failed to load route variations") : null,
    };
}

