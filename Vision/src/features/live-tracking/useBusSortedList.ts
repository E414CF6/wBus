import type {BusItem} from "@entities/bus/types";
import {useRouteIds} from "@entities/route/hooks";
import {useMemo} from "react";
import {useBusDirection} from "./useBusDirection";
import {useBusLocationData} from "./useBusLocation";

const EMPTY_BUS_LIST: BusItem[] = [];

export const useBusSortedList = (routeName: string) => {
    const routeIds = useRouteIds(routeName);
    const {
        data: mapList,
        error: mapError,
        hasFetched: locationFetched,
        connectionStatus
    } = useBusLocationData(routeIds);

    const getDirection = useBusDirection(routeName);
    const error = mapError;
    const hasFetched = locationFetched;

    // Maintain static order directly from the API response
    const sortedList = mapList || EMPTY_BUS_LIST;

    return useMemo(() => ({
        sortedList, getDirection, error, hasFetched, connectionStatus
    }), [sortedList, getDirection, error, hasFetched, connectionStatus]);
};
