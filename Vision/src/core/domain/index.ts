/**
 * @fileoverview Unified domain types for the wBus application.
 * All business domain types are exported from here for consistent imports.
 */

// ============================================================================
// Bus Types
// ============================================================================

/** Real-time bus location item from API */
export interface BusItem {
    routeid?: string;
    routenm: string;
    gpslati: number;
    gpslong: number;
    vehicleno: string;
    nodenm?: string;
    nodeid?: string;
    nodeord?: number;
}

// ============================================================================
// Route Types
// ============================================================================

/** Route info containing name and vehicle IDs */
export interface RouteInfo {
    routeName: string;
    vehicleRouteIds: string[];
}

/** Sequence item within a route detail */
export interface SequenceItem {
    nodeord: number;
    nodeid: string;
    updowncd: number;
}

/** Route detail with sequence information */
export interface RouteDetail {
    routeno?: string;
    sequence: SequenceItem[];
}

// ============================================================================
// Station Types
// ============================================================================

/** Station location data (from routeMap stations) */
export interface StationLocation {
    gpslati: number;
    gpslong: number;
    nodenm: string;
    nodeno: string | number;
}

/** Bus stop with route-specific info */
export interface BusStop extends StationLocation {
    nodeid: string;
    nodeord?: number;
    updowncd?: number;
}

/** Bus arrival info for a stop */
export interface BusStopArrival {
    arrprevstationcnt: number;
    arrtime: number;
    routeid: string;
    routeno: string;
    vehicletp: string;
}

// ============================================================================
// Schedule Types
// ============================================================================

export interface RowItem {
    minute: string;
    noteId?: string;
}

export interface HourlySchedule {
    [destination: string]: RowItem[];
}

export interface BusSchedule {
    routeId: string;
    routeName: string;
    description: string;
    lastUpdated: string;
    directions: string[];
    routeDetails?: string[];
    featuredStops?: { [key: string]: string[] };
    schedule: {
        general?: { [hour: string]: HourlySchedule };
        weekday?: { [hour: string]: HourlySchedule };
        weekend?: { [hour: string]: HourlySchedule };
    };
    notes?: { [key: string]: string };
}

// ============================================================================
// GeoJSON Types
// ============================================================================

export interface BusRouteFeatureCollection {
    type: "FeatureCollection";
    features: BusRouteFeature[];
}

export interface BusRouteFeature {
    type: "Feature";
    id: string;
    bbox: [number, number, number, number];
    geometry: {
        type: "LineString";
        coordinates: Array<[number, number]>;
    };
    properties: BusRouteProperties;
}

export interface BusRouteProperties {
    route_id: string;
    route_no: string;
    stops: Array<{
        id: string;
        name: string;
        ord: number;
        ud: number;
    }>;
    turn_idx: number;
    stop_to_coord: number[];
    total_dist: number;
    source_ver: string;
}

export type GeoPolyline = BusRouteFeatureCollection;
export type GeoFeature = BusRouteFeature;

// ============================================================================
// Error Types
// ============================================================================

/** Error types for bus location polling */
export type BusDataError =
    | "ERR:NONE_RUNNING"
    | "ERR:NETWORK"
    | "ERR:INVALID_ROUTE"
    | null;

// ============================================================================
// Common Types
// ============================================================================

/** Coordinate tuple [lat, lng] for Leaflet */
export type Coordinate = [number, number];

/** GeoJSON coordinate [lng, lat] */
export type GeoJSONCoordinate = [number, number];

/** Direction enum values */
export const Direction = {
    UP: 1,
    DOWN: 0,
} as const;

export type DirectionCode = typeof Direction[keyof typeof Direction] | null;

// ============================================================================
// Static Data Types (for API responses)
// ============================================================================

/** Cached static data structure from routeMap.json */
export interface StaticData {
    lastUpdated: string;
    route_numbers: Record<string, string[]>;
    route_details: Record<string, RouteDetail>;
    stations: Record<string, StationLocation>;
}
