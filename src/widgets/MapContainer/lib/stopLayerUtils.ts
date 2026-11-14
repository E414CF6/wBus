import type {Feature, FeatureCollection, Point} from "geojson";
import type {BusStop} from "@entities/station/types";

export const STOP_SOURCE_ID = "wbus-stops-source";
export const STOP_CIRCLE_NEARBY_LAYER_ID = "wbus-stops-circle-nearby";
export const STOP_CIRCLE_ROUTE_LAYER_ID = "wbus-stops-circle-route";
export const STOP_LABEL_PRIORITY_LAYER_ID = "wbus-stops-label-priority";
export const STOP_LABEL_ROUTE_LAYER_ID = "wbus-stops-label-route";
export const STOP_LABEL_NEARBY_LAYER_ID = "wbus-stops-label-nearby";

export const STOP_INTERACTIVE_LAYER_IDS = [
    STOP_CIRCLE_ROUTE_LAYER_ID,
    STOP_CIRCLE_NEARBY_LAYER_ID,
    STOP_LABEL_PRIORITY_LAYER_ID,
    STOP_LABEL_ROUTE_LAYER_ID,
    STOP_LABEL_NEARBY_LAYER_ID,
] as const;

export interface StopFeatureProperties {
    stopKey: string;
    nodeid: string;
    nodenm: string;
    nodeno: string;
    color: string;
    isRouteStop: boolean;
    isFavorite: boolean;
    /** Lower value = higher priority in MapLibre symbol-sort-key */
    sortKey: number;
}

export interface BuildBusStopsGeoJsonParams {
    routeStops: BusStop[];
    favoriteStops: BusStop[];
    nearbyStops: BusStop[];
    showNearbyStops: boolean;
    stopColorMap: Map<string, string>;
    routeMainColor: string;
    favoriteNodeIds: Set<string>;
}

export interface BuildBusStopsGeoJsonResult {
    geoJson: FeatureCollection<Point, StopFeatureProperties>;
    stopByKey: Map<string, BusStop>;
}

export function getBusStopKey(stop: Pick<BusStop, "nodeid" | "updowncd">, fallbackIndex?: number): string {
    if (stop.nodeid) {
        return `${stop.nodeid}-${stop.updowncd ?? "na"}`;
    }
    return `stop-${fallbackIndex ?? 0}`;
}

/**
 * Builds a deduplicated GeoJSON FeatureCollection for all bus stops
 * (route stops, favorites, and nearby stops) to render natively via MapLibre WebGL layers.
 */
export function buildBusStopsGeoJson({
    routeStops,
    favoriteStops,
    nearbyStops,
    showNearbyStops,
    stopColorMap,
    routeMainColor,
    favoriteNodeIds,
}: BuildBusStopsGeoJsonParams): BuildBusStopsGeoJsonResult {
    const features: Array<Feature<Point, StopFeatureProperties>> = [];
    const stopByKey = new Map<string, BusStop>();
    const addedNodeIds = new Set<string>();

    const pushStop = (
        stop: BusStop,
        opts: {isRouteStop: boolean; isFavorite: boolean; color: string; sortKey: number},
        fallbackIndex?: number
    ) => {
        if (!Number.isFinite(stop.gpslong) || !Number.isFinite(stop.gpslati)) return;
        const stopKey = getBusStopKey(stop, fallbackIndex);
        stopByKey.set(stopKey, stop);

        features.push({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [stop.gpslong, stop.gpslati],
            },
            properties: {
                stopKey,
                nodeid: stop.nodeid,
                nodenm: stop.nodenm,
                nodeno: stop.nodeno !== undefined && stop.nodeno !== null ? String(stop.nodeno) : "",
                color: opts.color,
                isRouteStop: opts.isRouteStop,
                isFavorite: opts.isFavorite,
                sortKey: opts.sortKey,
            },
        });
    };

    // 1. Route stops (highest priority after favorites)
    for (let i = 0; i < routeStops.length; i++) {
        const rStop = routeStops[i];
        const stopKey = getBusStopKey(rStop, i);
        const color = stopColorMap.get(stopKey) || stopColorMap.get(rStop.nodeid) || routeMainColor;
        const isFav = favoriteNodeIds.has(rStop.nodeid);
        addedNodeIds.add(rStop.nodeid);
        pushStop(
            rStop,
            {
                isRouteStop: true,
                isFavorite: isFav,
                color,
                sortKey: isFav ? 1 : 2,
            },
            i
        );
    }

    // 2. Favorite stops not on active route
    for (let i = 0; i < favoriteStops.length; i++) {
        const fav = favoriteStops[i];
        if (addedNodeIds.has(fav.nodeid)) continue;
        addedNodeIds.add(fav.nodeid);
        pushStop(
            fav,
            {
                isRouteStop: false,
                isFavorite: true,
                color: "#f59e0b",
                sortKey: 1,
            },
            i
        );
    }

    // 3. Nearby stops (when enabled)
    if (showNearbyStops && nearbyStops.length > 0) {
        for (let i = 0; i < nearbyStops.length; i++) {
            const nStop = nearbyStops[i];
            if (addedNodeIds.has(nStop.nodeid)) continue;
            addedNodeIds.add(nStop.nodeid);
            pushStop(
                {
                    nodeid: nStop.nodeid,
                    nodenm: nStop.nodenm,
                    nodeno: nStop.nodeno ?? "",
                    gpslati: nStop.gpslati,
                    gpslong: nStop.gpslong,
                },
                {
                    isRouteStop: false,
                    isFavorite: false,
                    color: "#64748b",
                    sortKey: 3,
                },
                i
            );
        }
    }

    return {
        geoJson: {
            type: "FeatureCollection",
            features,
        },
        stopByKey,
    };
}
