import type { BusItem } from "@entities/bus/types";
import { getRouteInfo } from "@entities/route/api";
import type { RouteInfo } from "@entities/route/types";
import { useEffect, useMemo, useState } from "react";
import { useBusDirection } from "./useBusDirection";
import { useBusLocationData } from "./useBusLocation";

import { type BusPolylineSet, getFallbackPolylines, useBusPolylineMap } from "./usePolyline";

export interface UseBusData {
    routeInfo: RouteInfo | null;
    busList: BusItem[];
    getDirection: ReturnType<typeof useBusDirection>;
    polylineMap: Map<string, BusPolylineSet>;
    fallbackPolylines: BusPolylineSet;
    activeRouteId: string | null;
}

/**
 * Custom hook that aggregates all bus-related data for a given route.
 * Combines route information, bus locations, polylines, and direction data.
 * @param routeName - The name of the route (e.g., "30", "34")
 * @returns An object containing all bus data for the route
 */
export function useBusData(routeName: string): UseBusData {
    const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
    const {data: busList} = useBusLocationData(routeName);
    const directionFn = useBusDirection(routeName);

    useEffect(() => {
        getRouteInfo(routeName).then(setRouteInfo);
    }, [routeName]);

    const activeRouteId = useMemo(() => {
        const liveRouteId = busList.find((bus) => bus.routeid)?.routeid;
        return liveRouteId ?? routeInfo?.vehicleRouteIds[0] ?? null;
    }, [busList, routeInfo]);

    const routeIds = useMemo(
        () => routeInfo?.vehicleRouteIds ?? [],
        [routeInfo]
    );

    const polylineMap = useBusPolylineMap(routeIds);

    const fallbackPolylines = useMemo(() =>
            getFallbackPolylines(polylineMap, activeRouteId),
        [polylineMap, activeRouteId]
    );

    return {
        routeInfo,
        busList,
        getDirection: directionFn,
        polylineMap,
        fallbackPolylines,
        activeRouteId,
    };
}
