// Re-export Coordinate from shared geo utils (the canonical definition)
export type Coordinate = [number, number];

// Route Info

export type RouteInfo = {
    routeName: string; vehicleRouteIds: string[];
};

export type SequenceItem = {
    nodeord: number; nodeid: string; updowncd: number;
};

export type RouteDetail = {
    routeno?: string; sequence: SequenceItem[];
};

// GeoJSON

export interface GeoPolyline {
    route_id: string;
    route_no: string;
    stops: {
        id: string;
        name: string;
        ord: number;
        ud: number;
    }[];
    up_segments: string[];
    down_segments: string[];
    total_dist: number;
    total_time?: number;
    source_ver?: string;
    bbox?: [number, number, number, number];
}

export type SegmentsJSON = Record<string, [number, number][]>;

// Schedule Items

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

// Direction

export const Direction = {
    UP: 1, DOWN: 0,
} as const;

export type DirectionCode = (typeof Direction)[keyof typeof Direction] | null;

// Day Types

export const DAY_TYPES = {
    WEEKDAY: 'weekday', WEEKEND: 'weekend',
} as const;

export type DayType = (typeof DAY_TYPES)[keyof typeof DAY_TYPES];

// Map Data

export interface RouteMapData {
    lastUpdated: string;
    route_numbers: Record<string, string[]>;
}
