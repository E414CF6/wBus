import type {BusItem} from "@entities/bus/types";
import {useRouteIds} from "@entities/route/hooks";
import {useMemo} from "react";
import {useBusDirection} from "./useBusDirection";
import {useBusLocationData} from "./useBusLocation";

const EMPTY_BUS_LIST: BusItem[] = [];

/**
 * Custom hook to fetch and sort live bus telemetry data.
 * @param routeName - Target route name (e.g. "30")
 * @param enabled - Pass false to suspend live SSE/polling fetches when not on real-time map view
 */
export const useBusSortedList = (routeName: string, enabled: boolean = true) => {
    const routeIds = useRouteIds(routeName);
    const activeRouteIds = useMemo(() => (enabled ? routeIds : []), [enabled, routeIds]);

    const {
        data: mapList,
        error: mapError,
        hasFetched: locationFetched,
        connectionStatus,
        lastUpdated,
        isDegraded,
        reconnect,
    } = useBusLocationData(activeRouteIds);

    const getDirection = useBusDirection(routeName);
    const error = mapError;
    const hasFetched = locationFetched;

    // Maintain static order directly from the API response
    const sortedList = mapList || EMPTY_BUS_LIST;

    return useMemo(() => ({
        sortedList, getDirection, error, hasFetched, connectionStatus, lastUpdated, isDegraded, reconnect
    }), [sortedList, getDirection, error, hasFetched, connectionStatus, lastUpdated, isDegraded, reconnect]);
};
