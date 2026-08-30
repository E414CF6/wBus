import type {BusDataError, BusItem} from "@entities/bus/types";
import {useRouteInfo} from "@entities/route/hooks";
import type {RouteInfo} from "@entities/route/types";

import {useBusDirection} from "./useBusDirection";
import {type SSEConnectionStatus, useBusLocationData} from "./useBusLocation";

import {type BusPolylineSet, getFallbackPolylines, useBusPolylineMap} from "./usePolyline";

import {useMemo} from "react";

interface UseBusData {
    routeInfo: RouteInfo | null;
    busList: BusItem[];
    getDirection: ReturnType<typeof useBusDirection>;
    polylineMap: Map<string, BusPolylineSet>;
    fallbackPolylines: BusPolylineSet;
    activeRouteId: string | null;
    connectionStatus: SSEConnectionStatus;
    hasFetched: boolean;
    error: BusDataError;
    lastUpdated: number | null;
    isDegraded: boolean;
    reconnect: () => void;
}

/**
 * Custom hook that aggregates all bus-related data for a given route.
 * Now uses routeId-based API for more efficient data fetching.
 * @param routeName - The name of the route (e.g., "30", "34")
 * @returns An object containing all bus data for the route
 */
export function useBusData(routeName: string): UseBusData {
    const routeInfo = useRouteInfo(routeName);
    const routeIds = useMemo(() => routeInfo?.vehicleRouteIds ?? [], [routeInfo]);
    const {
        data: busList, connectionStatus, hasFetched, error, lastUpdated, isDegraded, reconnect
    } = useBusLocationData(routeIds);
    const directionFn = useBusDirection(routeName);

    const activeRouteId = useMemo(() => {
        const liveRouteId = busList.find((bus) => bus.routeid)?.routeid;
        return liveRouteId ?? routeIds[0] ?? null;
    }, [busList, routeIds]);

    const polylineMap = useBusPolylineMap(routeIds);

    const fallbackPolylines = useMemo(() => getFallbackPolylines(polylineMap, activeRouteId), [polylineMap, activeRouteId]);

    return {
        routeInfo: routeInfo ?? null,
        busList,
        getDirection: directionFn,
        polylineMap,
        fallbackPolylines,
        activeRouteId,
        connectionStatus,
        hasFetched,
        error,
        lastUpdated,
        isDegraded,
        reconnect,
    };
}
