/**
 * @fileoverview Arrival info feature hook.
 * Polls real-time bus arrival data for a specific stop.
 */

import { API_CONFIG, APP_CONFIG } from "@core/constants/env";
import { UI_TEXT } from "@core/constants/locale";
import { getBusStopArrivalData } from "@entities/bus/api";
import type { BusStopArrival } from "@entities/station/types";
import { useCallback, useEffect, useRef, useState } from "react";

export function useBusArrivalInfo(busStopId: string | null) {
    const [data, setData] = useState<BusStopArrival[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const fetchData = useCallback(async () => {
        if (!busStopId || busStopId.trim() === "") {
            setData([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const result = await getBusStopArrivalData(busStopId);
            setData(result);
        } catch (e) {
            if (APP_CONFIG.IS_DEV) console.error("[useBusArrivalInfo] Error fetching bus arrival data:", e);
            setError(UI_TEXT.ERROR.NO_ARRIVAL_INFO);
        } finally {
            setLoading(false);
        }
    }, [busStopId]);

    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (!busStopId || busStopId.trim() === "") {
            setData([]);
            return;
        }
        fetchData();
        timerRef.current = setInterval(fetchData, API_CONFIG.LIVE.POLLING_INTERVAL_MS);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [busStopId, fetchData]);

    return {data, loading, error};
}

export function getNextBusArrivalInfo(routeName: string, data: BusStopArrival[]) {
    const target = data.find((bus) =>
        bus.routeno.replace(/-/g, "").trim() === routeName.replace(/-/g, "").trim()
    );
    if (!target) return null;
    return {minutes: Math.ceil(target.arrtime / 60), stopsAway: target.arrprevstationcnt};
}
