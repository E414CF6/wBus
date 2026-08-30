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

export interface CacheMetadata {
    filePath: string;
    exists: boolean;
    sizeBytes: number;
    updatedAt: string | null;
    totalRoutes: number;
    minRefreshIntervalDays: number;
    canRefresh: boolean;
    nextRefreshAvailableAt: string | null;
}

export interface BusCacheData {
    updatedAt: string;
    sourceUrl: string;
    totalRoutes: number;
    routes: BusRoute[];
}

export interface ApiResponse<T> {
    success: boolean;
    refreshed?: boolean;
    message?: string;
    data?: T;
    meta?: CacheMetadata;
    error?: string;
    elapsedMs?: number;
}
