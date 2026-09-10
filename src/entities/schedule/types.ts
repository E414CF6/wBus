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
