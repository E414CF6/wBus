import {useMemo} from "react";
import type {DayFilter} from "../types";

import {YONSEI_SHUTTLE_SCHEDULE} from "@data/yonseiShuttleSchedule";
import {parseTimeToMinutes} from "@shared/lib/timeUtils";

interface UseYonseiShuttleScheduleOptions {
    dayFilter: DayFilter;
    searchQuery: string;
    now: Date;
}

export function useYonseiShuttleSchedule({
                                             dayFilter, searchQuery, now,
                                         }: UseYonseiShuttleScheduleOptions) {
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const isSunday = now.getDay() === 0;

    // Filter and Sort Inbound Items by departure_time ascending
    const filteredInbound = useMemo(() => {
        return YONSEI_SHUTTLE_SCHEDULE.inbound_to_campus
            .filter((item) => {
                // Day filter
                if (dayFilter === "WEEKDAY" && item.operation_type.includes("일요일")) return false;
                if (dayFilter === "SUNDAY" && !item.operation_type.includes("일요일")) return false;

                // Search query
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase().trim();
                    const matchPoint = item.departure_point.toLowerCase().includes(q);
                    const matchTime = item.departure_time.includes(q);
                    const matchDest = item.destination.toLowerCase().includes(q);
                    const matchVia = item.via.some((v) => v.name.toLowerCase().includes(q));
                    const matchNote = item.note ? item.note.toLowerCase().includes(q) : false;
                    if (!matchPoint && !matchTime && !matchDest && !matchVia && !matchNote) return false;
                }

                return true;
            })
            .slice()
            .sort((a, b) => (parseTimeToMinutes(a.departure_time) ?? 0) - (parseTimeToMinutes(b.departure_time) ?? 0));
    }, [dayFilter, searchQuery]);

    // Filter and Sort Outbound Items by departure_time ascending
    const filteredOutbound = useMemo(() => {
        return YONSEI_SHUTTLE_SCHEDULE.outbound_from_campus
            .filter((item) => {
                // Day filter
                if (dayFilter === "WEEKDAY" && item.operation_type.includes("일요일")) return false;
                if (dayFilter === "SUNDAY" && !item.operation_type.includes("일요일")) return false;

                // Search query
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase().trim();
                    const matchPoint = item.departure_point.toLowerCase().includes(q);
                    const matchTime = item.departure_time.includes(q);
                    const matchDest = item.destination.toLowerCase().includes(q);
                    const matchVia = item.via.some((v) => v.name.toLowerCase().includes(q));
                    const matchNote = item.note ? item.note.toLowerCase().includes(q) : false;
                    if (!matchPoint && !matchTime && !matchDest && !matchVia && !matchNote) return false;
                }

                return true;
            })
            .slice()
            .sort((a, b) => (parseTimeToMinutes(a.departure_time) ?? 0) - (parseTimeToMinutes(b.departure_time) ?? 0));
    }, [dayFilter, searchQuery]);

    // Next upcoming index for inbound (based on earliest time >= currentMins)
    const nextInboundIdx = useMemo(() => {
        for (let i = 0; i < filteredInbound.length; i++) {
            const item = filteredInbound[i];
            const isItemSunday = item.operation_type.includes("일요일");
            if (isSunday !== isItemSunday && dayFilter === "ALL") continue;
            const mins = parseTimeToMinutes(item.departure_time);
            if (mins !== null && mins >= currentMins) {
                return i;
            }
        }
        return -1;
    }, [filteredInbound, currentMins, isSunday, dayFilter]);

    // Next upcoming index for outbound (based on earliest time >= currentMins)
    const nextOutboundIdx = useMemo(() => {
        for (let i = 0; i < filteredOutbound.length; i++) {
            const item = filteredOutbound[i];
            const isItemSunday = item.operation_type.includes("일요일");
            if (isSunday !== isItemSunday && dayFilter === "ALL") continue;
            const mins = parseTimeToMinutes(item.departure_time);
            if (mins !== null && mins >= currentMins) {
                return i;
            }
        }
        return -1;
    }, [filteredOutbound, currentMins, isSunday, dayFilter]);

    return {
        filteredInbound, filteredOutbound, nextInboundIdx, nextOutboundIdx,
    };
}
