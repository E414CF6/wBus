"use client";

import type {RouteInfo, RouteVariation} from "@entities/route/types";
import {filterRouteIdsByCity, filterRouteNumbersMapByCity, filterRoutesByCity} from "@entities/city/routeBoundary";
import {
    type CityRoutesPayload,
    fetchCityRoutesData,
    getCachedCityRoutesSync,
    getCachedRouteInfoSync,
    getRouteInfo,
    getRouteVariations,
} from "@entities/route/api";
import type {RawCityRoute} from "@entities/bus";

import {APP_CONFIG} from "@shared/config/env";

import {useMemo, useSyncExternalStore} from "react";
import useSWR from "swr";

const emptySubscribe = () => () => {
};

function useIsHydrated(): boolean {
    return useSyncExternalStore(
        emptySubscribe,
        () => true,
        () => false
    );
}

const ROUTE_INFO_SWR_OPTIONS = {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    dedupingInterval: 60000,
    errorRetryCount: 2,
} as const;

const CITY_ROUTES_SWR_OPTIONS = {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    dedupingInterval: 60000,
    errorRetryCount: 3,
} as const;

export function useRouteInfo(routeName: string, enabled: boolean = true, cityCode: string = "32020"): RouteInfo | null {
    const isHydrated = useIsHydrated();
    // 1. Subscribe to the unified city route map so if city routes are loaded, we get routeIds with 0 extra network requests
    const routeMap = useBusRouteMap(enabled, cityCode);

    const resolvedFromMap = useMemo<RouteInfo | null>(() => {
        if (!isHydrated || !enabled || !routeName) return null;
        const mapIds = filterRouteIdsByCity(cityCode, routeMap?.[routeName] || []);
        if (mapIds.length > 0) {
            return {routeName, vehicleRouteIds: mapIds};
        }
        return getCachedRouteInfoSync(routeName, cityCode);
    }, [isHydrated, enabled, routeName, routeMap, cityCode]);

    // 2. Only fetch individual routeInfo if not already resolved from the city-wide route map
    const shouldFetchSingle = enabled && Boolean(routeName) && !resolvedFromMap;
    const {
        data, error
    } = useSWR<RouteInfo | null>(
        shouldFetchSingle ? ["routeInfo", cityCode, routeName] : null,
        async ([, cCode, name]: [string, string, string]) => {
            const info = await getRouteInfo(name, cCode);
            if (info && info.vehicleRouteIds.length > 0) {
                const vIds = filterRouteIdsByCity(cCode, info.vehicleRouteIds);
                return {routeName: name, vehicleRouteIds: vIds};
            }
            return {routeName: name, vehicleRouteIds: [name]};
        },
        ROUTE_INFO_SWR_OPTIONS
    );

    if (error && APP_CONFIG.IS_DEV) {
        console.error(`[useRouteInfo] Failed to fetch route info: ${routeName}`, error);
    }

    return resolvedFromMap ?? data ?? null;
}

export function useRouteIds(routeName: string, enabled: boolean = true, cityCode: string = "32020"): string[] {
    const routeInfo = useRouteInfo(routeName, enabled, cityCode);
    return useMemo(() => {
        const ids = routeInfo?.vehicleRouteIds ?? (routeName ? [routeName] : []);
        return filterRouteIdsByCity(cityCode, ids);
    }, [routeInfo, routeName, cityCode]);
}

/**
 * Get (routeName) -> routeIds[] mapping for bus routes.
 * Example: { "30": ["30100123", "30100124"] }
 *
 * Shares the unified `cityRoutes:${cityCode}` SWR cache & L1/L2 persistent cache with `useCityRoutes`.
 */
export function useBusRouteMap(enabled: boolean = true, cityCode: string = "32020"): Record<string, string[]> | null {
    const isHydrated = useIsHydrated();
    const fallback = useMemo(
        () => (isHydrated && enabled ? getCachedCityRoutesSync(cityCode) ?? undefined : undefined),
        [isHydrated, enabled, cityCode]
    );
    const key = enabled ? `cityRoutes:${cityCode}` : null;

    const {data, error} = useSWR<CityRoutesPayload>(
        key,
        () => fetchCityRoutesData(cityCode),
        {
            ...CITY_ROUTES_SWR_OPTIONS,
            fallbackData: fallback,
        }
    );

    if (error && APP_CONFIG.IS_DEV) {
        console.error("[useBusRouteMap] Error fetching route map", error);
    }

    const routeNumbers = data?.route_numbers;
    return useMemo(() => {
        if (!isHydrated || !routeNumbers) return null;
        return filterRouteNumbersMapByCity(cityCode, routeNumbers).cleaned;
    }, [isHydrated, routeNumbers, cityCode]);
}

/**
 * Hook to retrieve full city route list with metadata (start/end nodes, hours, route types).
 * Shares the unified `cityRoutes:${cityCode}` SWR cache & L1/L2 persistent cache with `useBusRouteMap`.
 */
export function useCityRoutes(cityCode: string = "32020", enabled: boolean = true) {
    const isHydrated = useIsHydrated();
    const fallback = useMemo(
        () => (isHydrated && enabled ? getCachedCityRoutesSync(cityCode) ?? undefined : undefined),
        [isHydrated, enabled, cityCode]
    );
    const key = enabled ? `cityRoutes:${cityCode}` : null;

    const {data, error, isLoading, mutate} = useSWR<CityRoutesPayload>(
        key,
        () => fetchCityRoutesData(cityCode),
        {
            ...CITY_ROUTES_SWR_OPTIONS,
            fallbackData: fallback,
        }
    );

    const hydratedData = isHydrated ? data : undefined;

    const {filteredRoutes, filteredMap} = useMemo(() => {
        const rawRoutes = (hydratedData?.routes || []) as RawCityRoute[];
        const rawMap = (hydratedData?.route_numbers || {}) as Record<string, string[]>;
        return {
            filteredRoutes: filterRoutesByCity(cityCode, rawRoutes),
            filteredMap: filterRouteNumbersMapByCity(cityCode, rawMap).cleaned,
        };
    }, [hydratedData?.routes, hydratedData?.route_numbers, cityCode]);

    return {
        routes: filteredRoutes,
        routeMap: filteredMap,
        isLoading: isLoading && !hydratedData,
        error,
        refresh: mutate,
    };
}

/**
 * Hook to retrieve all variations of a route, with ordered stops,
 * user-friendly variation labels, and turning point detection.
 */
export function useRouteVariations(routeName: string, enabled: boolean = true, cityCode: string = "32020") {
    const {data, error, isLoading} = useSWR<RouteVariation[]>(
        enabled && routeName ? ["routeVariations", cityCode, routeName] : null,
        ([, cCode, name]: [string, string, string]) => getRouteVariations(name, cCode),
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

