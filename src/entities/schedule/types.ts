import type {ApiResponse} from "@shared/types/bus";

/**
 * Schedule Domain Entity Types
 */

export interface TimetableEntry {
    seq: number;
    originDepTime: string;
    destDepTime: string;
    type: string;
    notes: string;
}

export interface BusRoute {
    id: string;
    rawNo: string;
    routeNo: string;
    dayType: string;
    origin: string;
    destination: string;
    firstBus: string;
    lastBus: string;
    runCount: string;
    interval: string;
    timetable: TimetableEntry[];
}

export interface BusCacheData {
    updatedAt: string;
    sourceUrl: string;
    totalRoutes: number;
    routes: BusRoute[];
}

export type RouteDataset = BusCacheData;

export interface CacheMetadata {
    filePath?: string;
    exists: boolean;
    sizeBytes?: number;
    updatedAt: string | null;
    totalRoutes: number;
    minRefreshIntervalDays: number;
    canRefresh: boolean;
    nextRefreshAvailableAt: string | null;
}

export type DepartureDirection = "DEST" | "ORIGIN";

export type ScheduleApiResponse = ApiResponse<BusCacheData, CacheMetadata>;

export interface ShuttleStopLocation {
    name: string;
    location_description: string;
}

export interface ShuttleViaStop {
    name: string;
    time?: string | null;
    is_fixed_time?: boolean;
}

export interface ShuttleInboundItem {
    operation_type: string; // "평일 운행" | "일요일 특별편"
    departure_point: string;
    departure_time: string;
    via: ShuttleViaStop[];
    destination: string;
    note?: string | null;
}

export interface ShuttleOutboundItem {
    operation_type: string; // "평일 운행" | "일요일 운행"
    departure_point: string;
    departure_time: string;
    destination: string;
    via: ShuttleViaStop[];
    note?: string | null;
}

export interface ShuttleBusScheduleData {
    title: string;
    stop_locations: ShuttleStopLocation[];
    inbound_to_campus: ShuttleInboundItem[];
    outbound_from_campus: ShuttleOutboundItem[];
    guidelines: string[];
}
