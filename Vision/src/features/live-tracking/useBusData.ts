import type { BusItem } from "@entities/bus/types";
import { getRouteInfo } from "@entities/route/api";
import type { RouteInfo } from "@entities/route/types";
import { useMemo } from "react";
import useSWR from "swr";
import { useBusDirection } from "./useBusDirection";
import { useBusLocationData } from "./useBusLocation";

import { type BusPolylineSet, getFallbackPolylines, useBusPolylineMap } from "./usePolyline";

interface UseBusData {
    routeInfo: RouteInfo | null;
    busList: BusItem[];
    getDirection: ReturnType<typeof useBusDirection>;
    polylineMap: Map<string, BusPolylineSet>;
    fallbackPolylines: BusPolylineSet;
    activeRouteId: string | null;
}

/**
 * Custom hook that aggregates all bus-related data for a given route.
 * Now uses routeId-based API for more efficient data fetching.
 * @param routeName - The name of the route (e.g., "30", "34")
 * @returns An object containing all bus data for the route
 */
export function useBusData(routeName: string): UseBusData {
    // Use SWR for route info to gain caching and deduplication
    const {data: routeInfo} = useSWR(
        routeName ? ["routeInfo", routeName] : null,
        ([, name]) => getRouteInfo(name),
        {
            revalidateOnFocus: false, // Route info is static
            dedupingInterval: 60000,
        }
    );

    const routeIds = useMemo(
        () => routeInfo?.vehicleRouteIds ?? [],
        [routeInfo]
    );
    const {data: busList} = useBusLocationData(routeIds);
    const directionFn = useBusDirection(routeName);

    const activeRouteId = useMemo(() => {
        const liveRouteId = busList.find((bus) => bus.routeid)?.routeid;
        return liveRouteId ?? routeIds[0] ?? null;
    }, [busList, routeIds]);

    const polylineMap = useBusPolylineMap(routeIds);

    const fallbackPolylines = useMemo(() =>
            getFallbackPolylines(polylineMap, activeRouteId),
        [polylineMap, activeRouteId]
    );

    return {
        routeInfo: routeInfo ?? null,
        busList,
        getDirection: directionFn,
        polylineMap,
        fallbackPolylines,
        activeRouteId,
    };
}
