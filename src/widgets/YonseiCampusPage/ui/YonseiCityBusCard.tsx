"use client";

import React, {memo, useMemo} from "react";
import Link from "next/link";
import {AlertCircle, Bus, Clock, MapIcon, MapPin, Table2} from "lucide-react";

import {ROUTE_CONFIG} from "@entities/route";
import {type BusRoute, getUpcomingDepartures} from "@entities/schedule";
import {useBusSortedList} from "@features/live-tracking/useBusSortedList";
import {UI_TEXT} from "@shared/config/locale";
import type {CampusDirectionMode} from "../lib/yonseiShuttleUtils";

export interface YonseiCityBusCardProps {
    routeNo: "30" | "34" | "34-1";
    scheduleRoute: BusRoute | null;
    directionMode: CampusDirectionMode;
    now: Date;
    onOpenTimetable: (routeNo: string, location: "origin" | "dest") => void;
}

function getWaitBadgeStyle(waitMins: number): string {
    if (waitMins <= 5) {
        return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-black animate-pulse";
    }
    if (waitMins <= 20) {
        return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-black";
    }
    return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 font-extrabold";
}

export const YonseiCityBusCard: React.FC<YonseiCityBusCardProps> = memo(function YonseiCityBusCard({
    routeNo,
    scheduleRoute,
    directionMode,
    now,
    onOpenTimetable,
}) {
    const config = ROUTE_CONFIG[routeNo];
    const {sortedList: runningBuses, connectionStatus, hasFetched} = useBusSortedList(routeNo, true, "32020");

    const scheduleDirection = directionMode === "OUTBOUND" ? "DEST" : "ORIGIN";
    const modalLocation: "origin" | "dest" = directionMode === "OUTBOUND" ? "dest" : "origin";

    const departureLabel = useMemo(() => {
        if (directionMode === "OUTBOUND") {
            return config?.destLabel ?? "연세대 출발";
        }
        return config?.originLabel ?? "장양리 출발";
    }, [directionMode, config]);

    const {nextDeparture, subsequentDepartures} = useMemo(() => {
        return getUpcomingDepartures(scheduleRoute?.timetable ?? [], scheduleDirection, now);
    }, [scheduleRoute?.timetable, scheduleDirection, now]);

    const dayTypeLabel = useMemo(() => {
        if (routeNo === "30") return UI_TEXT.YONSEI.SCHEDULE_APPLIED_ALL_DAYS;
        const dType = scheduleRoute?.dayType ?? "";
        const isVacation =
            dType.includes("방학") ||
            dType.includes("휴일") ||
            dType.includes("토요일") ||
            dType.includes("공휴일");
        return isVacation ? UI_TEXT.YONSEI.SCHEDULE_APPLIED_VACATION : UI_TEXT.YONSEI.SCHEDULE_APPLIED_WEEKDAY;
    }, [routeNo, scheduleRoute?.dayType]);

    const runningCount = runningBuses.length;
    const isConnecting = !hasFetched || connectionStatus === "connecting";
    const latestStopName = runningBuses[0]?.nodenm;

    return (
        <article className="group flex flex-col justify-between rounded-3xl p-5 bg-white/90 dark:bg-[#111520]/90 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 shadow-sm hover:shadow-md transition-all duration-200">
            <div>
                {/* Header: Route Number Badge + Live Telemetry Status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span
                            className={`inline-flex items-center justify-center px-3 py-1.5 rounded-2xl text-sm font-black text-white shadow-sm bg-gradient-to-r ${config?.gradient ?? "from-[#003876] to-blue-700"} shrink-0`}
                        >
                            {routeNo}번
                        </span>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                                    {departureLabel}
                                </span>
                                <span className="px-1.5 py-0.2 rounded-md text-[10px] font-black bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 shrink-0">
                                    {dayTypeLabel}
                                </span>
                            </div>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5" title={config?.description}>
                                {config?.description}
                            </p>
                        </div>
                    </div>

                    {/* Live Running Badge */}
                    <div
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black border shrink-0 ${
                            isConnecting
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                : runningCount > 0
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                    : "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20"
                        }`}
                    >
                        <span
                            className={`w-1.5 h-1.5 rounded-full ${
                                isConnecting
                                    ? "bg-amber-500 animate-pulse"
                                    : runningCount > 0
                                        ? "bg-emerald-500 animate-pulse"
                                        : "bg-slate-400"
                            }`}
                        />
                        <span>
                            {isConnecting ? "연결중" : runningCount > 0 ? `${runningCount}대 운행` : "대기중"}
                        </span>
                    </div>
                </div>

                {/* Latest Live Bus Location Strip */}
                {runningCount > 0 && latestStopName && (
                    <div className="mb-3 px-3 py-1.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-500/20 flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
                        <Bus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="truncate">
                            현재 운행 위치: <strong className="font-black">{latestStopName}</strong>
                            {runningCount > 1 ? ` 외 ${runningCount - 1}대` : ""}
                        </span>
                    </div>
                )}

                {/* Next Departure Spotlight Box */}
                <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] border border-black/5 dark:border-white/10">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                            <span>다음 {departureLabel}</span>
                        </span>
                        {nextDeparture && (
                            <span
                                className={`px-2 py-0.5 rounded-lg text-[10px] border shrink-0 ${getWaitBadgeStyle(nextDeparture.waitMins)}`}
                            >
                                {nextDeparture.waitMins <= 5 && (
                                    <AlertCircle className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" />
                                )}
                                {nextDeparture.waitMins === 0
                                    ? UI_TEXT.YONSEI.STATUS_DEPARTING_SOON
                                    : UI_TEXT.TIMETABLE.WAIT_MINUTES(nextDeparture.waitMins)}
                            </span>
                        )}
                    </div>

                    {nextDeparture ? (
                        <div className="flex items-baseline justify-between gap-2 mt-1">
                            <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                                {nextDeparture.timeStr}
                            </span>
                            {nextDeparture.entry.notes && (
                                <span
                                    className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold border border-amber-500/20 truncate max-w-[140px]"
                                    title={nextDeparture.entry.notes}
                                >
                                    {nextDeparture.entry.notes}
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className="text-xs font-bold text-slate-400 dark:text-slate-500 py-1.5">
                            {UI_TEXT.YONSEI.SERVICE_ENDED}
                        </div>
                    )}
                </div>

                {/* Subsequent Departure Chips (Up to 2) */}
                {subsequentDepartures.length > 0 && (
                    <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                        {subsequentDepartures.slice(0, 2).map((dep, idx) => (
                            <div
                                key={`${dep.timeStr}-${idx}`}
                                className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-slate-100/80 dark:bg-white/[0.04] border border-black/5 dark:border-white/5 text-slate-800 dark:text-slate-200"
                            >
                                <span>{dep.timeStr}</span>
                                <span className="text-[10px] font-extrabold text-slate-400">
                                    {UI_TEXT.YONSEI.STATUS_MINUTES_REL(dep.waitMins)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Key Via Stops Preview */}
                {config?.viaStops && (
                    <div className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <p className="line-clamp-2">{config.viaStops}</p>
                    </div>
                )}
            </div>

            {/* Bottom Action Buttons */}
            <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-white/[0.06] grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => onOpenTimetable(routeNo, modalLocation)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-black transition-all cursor-pointer active:scale-95"
                >
                    <Table2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>시간표 상세</span>
                </button>
                <Link
                    href={`/?cityCode=32020&route=${encodeURIComponent(routeNo)}`}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#003876] hover:bg-[#002a5c] text-white text-xs font-black transition-all shadow-xs active:scale-95"
                >
                    <MapIcon className="w-3.5 h-3.5" />
                    <span>실시간 지도</span>
                </Link>
            </div>
        </article>
    );
});

YonseiCityBusCard.displayName = "YonseiCityBusCard";
