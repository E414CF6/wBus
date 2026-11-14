"use client";

import React, {memo, useMemo} from "react";
import Link from "next/link";
import {ArrowRight, Clock, Map as MapIcon, Table2} from "lucide-react";

import {ROUTE_CONFIG} from "@entities/route";
import {type BusRoute, getUpcomingDepartures} from "@entities/schedule";
import {UI_TEXT} from "@shared/config/locale";
import {buildMapUrl} from "@widgets/AppShell/hooks/useAppNavigation";
import type {CampusDirectionMode} from "../lib/yonseiShuttleUtils";

export interface YonseiCityBusCardProps {
    routeNo: "30" | "34" | "34-1";
    scheduleRoute: BusRoute | null;
    directionMode: CampusDirectionMode;
    now: Date;
    onOpenTimetable: (routeNo: string, location: "origin" | "dest") => void;
}

const ROUTE_ACCENT_STYLES: Record<
    "30" | "34" | "34-1",
    {
        topBar: string;
        surfaceRing: string;
        timeText: string;
    }
> = {
    "30": {
        topBar: "from-[#003876] via-blue-700 to-blue-500",
        surfaceRing: "hover:border-[#003876]/35 dark:hover:border-blue-500/40",
        timeText: "text-[#003876] dark:text-blue-300",
    },
    "34": {
        topBar: "from-blue-600 via-sky-500 to-indigo-600",
        surfaceRing: "hover:border-blue-500/35 dark:hover:border-sky-500/40",
        timeText: "text-blue-700 dark:text-sky-300",
    },
    "34-1": {
        topBar: "from-indigo-600 via-violet-600 to-purple-600",
        surfaceRing: "hover:border-indigo-500/35 dark:hover:border-violet-500/40",
        timeText: "text-indigo-700 dark:text-violet-300",
    },
};

function getWaitBadgeConfig(waitMins: number): {
    pillClass: string;
    dotClass: string | null;
    label: string;
} {
    if (waitMins <= 5) {
        return {
            pillClass:
                "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30 font-black",
            dotClass: "bg-rose-500",
            label:
                waitMins === 0
                    ? UI_TEXT.YONSEI.STATUS_DEPARTING_SOON
                    : UI_TEXT.YONSEI.STATUS_MINUTES_REL(waitMins),
        };
    }
    if (waitMins <= 20) {
        return {
            pillClass:
                "bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/30 font-black",
            dotClass: waitMins <= 10 ? "bg-amber-500" : null,
            label: UI_TEXT.YONSEI.STATUS_MINUTES_REL(waitMins),
        };
    }
    return {
        pillClass:
            "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25 font-extrabold",
        dotClass: null,
        label: UI_TEXT.YONSEI.STATUS_MINUTES_REL(waitMins),
    };
}

export const YonseiCityBusCard: React.FC<YonseiCityBusCardProps> = memo(function YonseiCityBusCard({
                                                                                                       routeNo,
                                                                                                       scheduleRoute,
                                                                                                       directionMode,
                                                                                                       now,
                                                                                                       onOpenTimetable,
                                                                                                   }) {
    const config = ROUTE_CONFIG[routeNo];
    const accent = ROUTE_ACCENT_STYLES[routeNo];

    const scheduleDirection = directionMode === "OUTBOUND" ? "DEST" : "ORIGIN";
    const modalLocation: "origin" | "dest" = directionMode === "OUTBOUND" ? "dest" : "origin";

    const departureLabel = useMemo(() => {
        if (directionMode === "OUTBOUND") {
            return config?.destLabel ?? "연세대 출발";
        }
        return config?.originLabel ?? "장양리 출발";
    }, [directionMode, config]);

    const {nextDeparture, subsequentDepartures, allValidDepartures} = useMemo(() => {
        return getUpcomingDepartures(scheduleRoute?.timetable ?? [], scheduleDirection, now);
    }, [scheduleRoute?.timetable, scheduleDirection, now]);

    const dayTypeLabel = useMemo(() => {
        const dType = scheduleRoute?.dayType ?? "";
        const isVacation =
            dType.includes("방학") ||
            dType.includes("휴일") ||
            dType.includes("토요일") ||
            dType.includes("공휴일");
        return isVacation ? UI_TEXT.YONSEI.SCHEDULE_APPLIED_VACATION : UI_TEXT.YONSEI.SCHEDULE_APPLIED_WEEKDAY;
    }, [scheduleRoute?.dayType]);

    const waitBadge = nextDeparture ? getWaitBadgeConfig(nextDeparture.waitMins) : null;

    return (
        <article
            className={`group relative flex flex-col justify-between rounded-3xl overflow-hidden bg-white dark:bg-[#111623] border border-slate-200/85 dark:border-white/10 shadow-xs hover:shadow-lg transition-all duration-200 ${accent.surfaceRing}`}
        >
            {/* Top Route Accent Strip */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${accent.topBar}`}/>

            <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div className="space-y-3.5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span
                                className={`inline-flex items-center justify-center px-3 py-1.5 rounded-2xl text-sm font-black text-white shadow-xs bg-gradient-to-br ${config?.gradient ?? "from-[#003876] to-blue-700"} shrink-0 tabular-nums`}
                            >
                                {routeNo}번
                            </span>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                                        {departureLabel}
                                    </span>
                                    <span
                                        className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 shrink-0">
                                        {dayTypeLabel}
                                    </span>
                                    {routeNo === "34-1" && directionMode === "OUTBOUND" && (
                                        <span
                                            className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 shrink-0">
                                            연세대 경유
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <span
                            className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100/90 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 tabular-nums">
                            {UI_TEXT.YONSEI.TOTAL_RUNS(allValidDepartures.length)}
                        </span>
                    </div>

                    {/* Route Waypoints Summary */}
                    <p
                        className="text-[11px] leading-relaxed font-medium text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[2.125rem]"
                        title={config?.description}
                    >
                        {config?.description}
                    </p>

                    {/* Next Departure Spotlight */}
                    <div
                        className="rounded-2xl p-4 bg-slate-50/90 dark:bg-white/[0.035] border border-slate-200/70 dark:border-white/[0.08] space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <span
                                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                <Clock className="w-3.5 h-3.5 text-[#003876] dark:text-blue-400"/>
                                <span>{UI_TEXT.YONSEI.NEXT_LOCATION_DEP(departureLabel)}</span>
                            </span>

                            {waitBadge && (
                                <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] border tabular-nums ${waitBadge.pillClass}`}
                                >
                                    {waitBadge.dotClass && (
                                        <span className="relative flex h-2 w-2">
                                            <span
                                                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${waitBadge.dotClass}`}
                                            />
                                            <span
                                                className={`relative inline-flex rounded-full h-2 w-2 ${waitBadge.dotClass}`}
                                            />
                                        </span>
                                    )}
                                    <span>{waitBadge.label}</span>
                                </span>
                            )}
                        </div>

                        {nextDeparture ? (
                            <>
                                <div className="flex items-baseline justify-between gap-2">
                                    <span
                                        className={`text-3xl font-black tracking-tight tabular-nums ${accent.timeText}`}
                                    >
                                        {nextDeparture.timeStr}
                                    </span>
                                    {nextDeparture.entry.notes && (
                                        <span
                                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/12 text-amber-700 dark:text-amber-300 border border-amber-500/20 truncate max-w-[140px]">
                                            {nextDeparture.entry.notes}
                                        </span>
                                    )}
                                </div>

                                {subsequentDepartures.length > 0 && (
                                    <div
                                        className="pt-2.5 border-t border-slate-200/70 dark:border-white/[0.07] flex items-center justify-between gap-2">
                                        <span
                                            className="text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0">
                                            {UI_TEXT.YONSEI.UPCOMING_DEP_TIMES}
                                        </span>
                                        <div className="grid grid-cols-3 gap-1 shrink-0">
                                            {subsequentDepartures.slice(0, 3).map((dep) => (
                                                <span
                                                    key={`${dep.entry.seq}-${dep.timeStr}`}
                                                    className="px-1.5 py-0.5 rounded-lg text-[11px] font-extrabold text-center bg-white dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 tabular-nums whitespace-nowrap"
                                                >
                                                    {dep.timeStr}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div
                                className="py-2 flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500">
                                <span>{UI_TEXT.YONSEI.SERVICE_ENDED}</span>
                                <span className="text-[10px] font-semibold">전체 시간표 확인 가능</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer CTA */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onOpenTimetable(routeNo, modalLocation)}
                        className="flex-1 min-w-0 inline-flex items-center justify-between py-2.5 px-3.5 rounded-2xl bg-slate-100/90 hover:bg-[#003876] text-slate-800 hover:text-white dark:bg-white/[0.06] dark:hover:bg-blue-600 dark:text-slate-100 text-xs font-extrabold transition-colors cursor-pointer"
                    >
                        <span className="inline-flex items-center gap-1.5 truncate">
                            <Table2 className="w-3.5 h-3.5 opacity-80 shrink-0"/>
                            <span className="truncate">{UI_TEXT.YONSEI.VIEW_TIMETABLE_BTN}</span>
                        </span>
                        <ArrowRight
                            className="w-3.5 h-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform shrink-0"/>
                    </button>

                    <Link
                        href={buildMapUrl(routeNo, "32020")}
                        aria-label={`${routeNo}번 실시간 위치 지도에서 보기`}
                        className="shrink-0 inline-flex items-center gap-1 py-2.5 px-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 border border-emerald-200/80 dark:border-emerald-400/25 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold transition-colors"
                    >
                        <MapIcon className="w-3.5 h-3.5 shrink-0"/>
                        <span>실시간</span>
                    </Link>
                </div>
            </div>
        </article>
    );
});
