import type { StationLocation } from "@entities/station/types";

// Re-export Coordinate from shared geo utils (the canonical definition)
export type Coordinate = [number, number];
export type GeoJSONCoordinate = [number, number];

// ── Route ──────────────────────────────────────────────────────

export type RouteInfo = {
    routeName: string;
    vehicleRouteIds: string[];
};

export type SequenceItem = {
    nodeord: number;
    nodeid: string;
    updowncd: number;
};

export type RouteDetail = {
    routeno?: string;
    sequence: SequenceItem[];
};

// ── GeoJSON ────────────────────────────────────────────────────

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

// ── Schedule ───────────────────────────────────────────────────

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

// ── Direction ──────────────────────────────────────────────────

export const Direction = {
    UP: 1,
    DOWN: 0,
} as const;

export type DirectionCode = (typeof Direction)[keyof typeof Direction] | null;

// ── Day Type ───────────────────────────────────────────────────

export const DAY_TYPES = {
    WEEKDAY: 'weekday',
    WEEKEND: 'weekend',
} as const;

export type DayType = (typeof DAY_TYPES)[keyof typeof DAY_TYPES];

// ── Map Data ───────────────────────────────────────────────────

export interface RouteMapData {
    lastUpdated: string;
    route_numbers: Record<string, string[]>;
}

export interface StationMapData {
    lastUpdated: string;
    stations: Record<string, StationLocation>;
}
