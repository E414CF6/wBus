import type {BusDataError, BusItem} from "@entities/bus/types";
import {useRouteInfo} from "@entities/route/hooks";
import type {RouteInfo} from "@entities/route/types";

import {useBusDirection} from "./useBusDirection";
import {type LiveConnectionStatus, useBusLocationData} from "./useBusLocation";

import {type BusPolylineSet, getFallbackPolylines, useBusPolylineMap} from "./usePolyline";

import {useMemo} from "react";

interface UseBusData {
    routeInfo: RouteInfo | null;
    busList: BusItem[];
    getDirection: ReturnType<typeof useBusDirection>;
    polylineMap: Map<string, BusPolylineSet>;
    fallbackPolylines: BusPolylineSet;
    activeRouteId: string | null;
    connectionStatus: LiveConnectionStatus;
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
 * @param enabled - Whether to enable fetching data for this route
 * @param cityCode - The city code (default: "32020" for Wonju)
 * @returns An object containing all bus data for the route
 */
export function useBusData(routeName: string, enabled: boolean = true, cityCode: string = "32020"): UseBusData {
    const routeInfo = useRouteInfo(routeName, enabled, cityCode);
    const routeIds = useMemo(() => {
        const ids = routeInfo?.vehicleRouteIds ?? [];
        if (cityCode === "32020") return ids.filter((id) => !id.startsWith("WJB258"));
        if (cityCode === "32320") return ids.filter((id) => id.startsWith("WJB258"));
        return ids;
    }, [routeInfo?.vehicleRouteIds, cityCode]);
    const activeRouteIds = useMemo(() => (enabled ? routeIds : []), [enabled, routeIds]);
    const {
        data: busList, connectionStatus, hasFetched, error, lastUpdated, isDegraded, reconnect
    } = useBusLocationData(activeRouteIds, cityCode);
    const directionFn = useBusDirection(routeName, cityCode);

    const activeRouteId = useMemo(() => {
        const liveRouteId = busList.find((bus) => bus.routeid)?.routeid;
        return liveRouteId ?? routeIds[0] ?? null;
    }, [busList, routeIds]);

    const polylineMap = useBusPolylineMap(routeIds, cityCode);

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
