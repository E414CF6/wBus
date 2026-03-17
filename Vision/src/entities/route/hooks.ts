"use client";

import type { BusSchedule } from "@entities/route/types";
import { HttpError } from "@shared/api/fetchAPI";
import { API_CONFIG, APP_CONFIG } from "@shared/config/env";
import { UI_TEXT } from "@shared/config/locale";
import { loadStaticData } from "@shared/utils/dataLoader";
import { useEffect, useState } from "react";

// ----------------------------------------------------------------------
// Caching & Helpers
// ----------------------------------------------------------------------

/**
 * Global in-memory cache to store fetched schedules.
 * Persists across component re-renders and unmounts within the same session.
 */
const GlobalScheduleCache = new Map<string, BusSchedule | null>();

/**
 * Fetches the schedule data from the network.
 * Returns `null` if the file is not found (404/403), otherwise throws an error.
 */
async function fetchScheduleData(routeId: string): Promise<BusSchedule | null> {
    try {
        return await loadStaticData<BusSchedule>(`${API_CONFIG.STATIC.PATHS.SCHEDULES}/${routeId}.json`);
    } catch (error) {
        // Treat 404 (Not Found) or 403 (Forbidden) as "Data Missing" (null) rather than an error
        if (error instanceof HttpError && (error.status === 404 || error.status === 403)) {
            return null;
        }
        throw error;
    }
}

// ----------------------------------------------------------------------
// Hook Definition
// ----------------------------------------------------------------------

/**
 * Custom hook to fetch and manage bus schedule data.
 * Includes caching, loading states, and error handling.
 *
 * @param routeId - The ID of the route to fetch (e.g., "34-1"). Pass null to reset.
 */
export function useScheduleData(routeId: string | null) {
    const [snapshot, setSnapshot] = useState<{
        routeId: string;
        data: BusSchedule | null;
        error: string | null;
        missing: boolean;
    } | null>(null);

    const cachedData = routeId ? GlobalScheduleCache.get(routeId) : undefined;
    const hasCache = routeId ? GlobalScheduleCache.has(routeId) : false;
    const activeSnapshot = snapshot?.routeId === routeId ? snapshot : null;

    const data = hasCache ? (cachedData ?? null) : activeSnapshot?.data ?? null;
    const error = hasCache ? null : activeSnapshot?.error ?? null;
    const missing = hasCache ? cachedData === null : activeSnapshot?.missing ?? false;
    const loading = Boolean(routeId && !hasCache && !activeSnapshot);

    useEffect(() => {
        // Flag to prevent state updates if the component unmounts or routeId changes
        let isActive = true;

        // Reset state if no routeId is provided
        if (!routeId) return;

        // Check Cache First
        if (GlobalScheduleCache.has(routeId)) return;

        fetchScheduleData(routeId)
            .then((result) => {
                if (!isActive) return;

                // Update Cache
                GlobalScheduleCache.set(routeId, result);

                // Update State
                setSnapshot({
                    routeId,
                    data: result,
                    error: null,
                    missing: result === null,
                });
            })
            .catch((err) => {
                if (!isActive) return;

                // Log error in Dev mode
                if (APP_CONFIG.IS_DEV) {
                    console.error(UI_TEXT.ERROR.FETCH_FAILED(UI_TEXT.DATA_LABELS.SCHEDULE_DATA, 500), err);
                }

                setSnapshot({
                    routeId,
                    data: null,
                    error: UI_TEXT.ERROR.UNKNOWN(err instanceof Error ? err.message : String(err)),
                    missing: false, // It's an error, not necessarily "missing"
                });
            });

        // Cleanup function
        return () => {
            isActive = false;
        };
    }, [routeId]);

    return {data, loading, error, missing};
}
