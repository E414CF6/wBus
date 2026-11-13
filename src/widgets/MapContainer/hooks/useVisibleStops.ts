import {useMemo} from "react";
import type {BusStop} from "@entities/station/types";
import type {LngLatBounds} from "maplibre-gl";

export interface VisibleStopItem extends BusStop {
    isRouteStop: boolean;
    showLabel: boolean;
    color: string;
}

export interface UseVisibleStopsParams {
    routeStops: BusStop[];
    favoriteStops: BusStop[];
    nearbyStops: BusStop[];
    showNearbyStops: boolean;
    showStopLabels?: boolean;
    bounds: LngLatBounds | null;
    zoom: number;
    stopColorMap: Map<string, string>;
    routeMainColor: string;
    activeFocusedStopId: string | null;
    eventFocusedStop: BusStop | null;
}

export function useVisibleStops({
    routeStops,
    favoriteStops,
    nearbyStops,
    showNearbyStops,
                                    showStopLabels = true,
    bounds,
    zoom,
    stopColorMap,
    routeMainColor,
    activeFocusedStopId,
    eventFocusedStop,
}: UseVisibleStopsParams): VisibleStopItem[] {
    return useMemo(() => {
        if (!bounds || zoom < 12.0) {
            if (eventFocusedStop) {
                return [
                    {
                        ...eventFocusedStop,
                        isRouteStop: true,
                        showLabel: true,
                        color: routeMainColor,
                    },
                ];
            }
            return [];
        }

        const stopsInView: VisibleStopItem[] = [];
        const addedNodeIds = new Set<string>();
        const isRouteLabelVisible = showStopLabels && zoom >= 14.2;
        const isNearbyLabelVisible = showStopLabels && zoom >= 15.6;

        // 1. Include route stops that are inside current viewport bounds (or currently focused)
        if (zoom >= 12.2) {
            for (const rStop of routeStops) {
                if (bounds.contains([rStop.gpslong, rStop.gpslati]) || rStop.nodeid === activeFocusedStopId) {
                    const stopKey = `${rStop.nodeid}-${rStop.updowncd ?? "na"}`;
                    const color = stopColorMap.get(stopKey) || stopColorMap.get(rStop.nodeid) || routeMainColor;

                    addedNodeIds.add(rStop.nodeid);
                    stopsInView.push({
                        ...rStop,
                        isRouteStop: true,
                        showLabel: isRouteLabelVisible || rStop.nodeid === activeFocusedStopId,
                        color,
                    });
                }
            }
        }

        // 2. Include favorite stops in viewport even if not on active route
        for (const fav of favoriteStops) {
            if (
                !addedNodeIds.has(fav.nodeid) &&
                (bounds.contains([fav.gpslong, fav.gpslati]) || fav.nodeid === activeFocusedStopId)
            ) {
                addedNodeIds.add(fav.nodeid);
                stopsInView.push({
                    nodeid: fav.nodeid,
                    nodenm: fav.nodenm,
                    nodeno: fav.nodeno,
                    gpslati: fav.gpslati,
                    gpslong: fav.gpslong,
                    isRouteStop: false,
                    showLabel: showStopLabels || fav.nodeid === activeFocusedStopId,
                    color: "#f59e0b",
                });
            }
        }

        // 3. Include spatial nearby stops when zoomed in (>= 14.3)
        if (showNearbyStops && zoom >= 14.3 && nearbyStops.length > 0) {
            for (const nStop of nearbyStops) {
                if (
                    !addedNodeIds.has(nStop.nodeid) &&
                    (bounds.contains([nStop.gpslong, nStop.gpslati]) || nStop.nodeid === activeFocusedStopId)
                ) {
                    addedNodeIds.add(nStop.nodeid);
                    stopsInView.push({
                        nodeid: nStop.nodeid,
                        nodenm: nStop.nodenm,
                        nodeno: nStop.nodeno ?? "",
                        gpslati: nStop.gpslati,
                        gpslong: nStop.gpslong,
                        isRouteStop: false,
                        showLabel: isNearbyLabelVisible || nStop.nodeid === activeFocusedStopId,
                        color: "#64748b",
                    });
                }
            }
        }

        // 4. Ensure eventFocusedStop is always included even while camera is flying to it
        if (eventFocusedStop && !addedNodeIds.has(eventFocusedStop.nodeid)) {
            stopsInView.push({
                ...eventFocusedStop,
                isRouteStop: routeStops.some((s) => s.nodeid === eventFocusedStop.nodeid),
                showLabel: true,
                color: stopColorMap.get(eventFocusedStop.nodeid) || routeMainColor,
            });
        }

        return stopsInView;
    }, [
        routeStops,
        favoriteStops,
        nearbyStops,
        showNearbyStops,
        showStopLabels,
        bounds,
        zoom,
        stopColorMap,
        routeMainColor,
        activeFocusedStopId,
        eventFocusedStop,
    ]);
}
