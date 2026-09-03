"use client";

import React, {memo, useMemo} from "react";
import {AlertCircle, Clock, MapPin} from "lucide-react";

import {BusRoute} from "@shared/types/bus";
import {parseTimeToMinutes} from "@shared/lib/timeUtils";
import {UI_TEXT} from "@shared/config/locale";

interface YonseiRouteCardProps {
    route: BusRoute;
    isBookmarked?: boolean;
    onToggleBookmark?: (routeId: string) => void;
    onSelectRoute: (route: BusRoute) => void;
    onSelectMapRoute?: (routeName: string) => void;
    currentTime?: Date;
}

export const YonseiRouteCard: React.FC<YonseiRouteCardProps> = memo(({
                                                                         route,
                                                                         isBookmarked: _isBookmarked,
                                                                         onToggleBookmark: _onToggleBookmark,
                                                                         onSelectRoute,
                                                                         onSelectMapRoute,
                                                                         currentTime,
                                                                     }) => {
    const isHoechon = route.routeNo === "34-1";
    const locationLabel = isHoechon ? UI_TEXT.YONSEI.LOCATION_HOECHON : UI_TEXT.YONSEI.LOCATION_YONSEI;

    const now = currentTime || new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    // Day type label
    const isVacationSchedule = useMemo(() => {
        const dType = route.dayType || "";
        return dType.includes("방학") || dType.includes("휴일") || dType.includes("토요일") || dType.includes("공휴일");
    }, [route.dayType]);

    // Valid departure times from 연세대 (30, 34) or 회촌 (34-1)
    const validDepartures = useMemo(() => {
        return (route.timetable || []).filter(
            (item) => item.destDepTime && item.destDepTime !== "-" && item.destDepTime !== ""
        );
    }, [route.timetable]);

    // Next departure info
    const nextInfo = useMemo(() => {
        if (!validDepartures.length) return null;

        for (const item of validDepartures) {
            const mins = parseTimeToMinutes(item.destDepTime);
            if (mins !== null && mins >= currentMins) {
                return {
                    entry: item,
                    waitMins: mins - currentMins,
                };
            }
        }
        return null;
    }, [validDepartures]);

    // Upcoming subsequent departure times (up to 2 upcoming times)
    const upcomingTimes = useMemo(() => {
        if (!validDepartures.length) return [];

        const remaining = validDepartures
            .map((item) => {
                const mins = parseTimeToMinutes(item.destDepTime);
                return {
                    ...item,
                    minutes: mins,
                    offsetMins: mins !== null && mins >= currentMins ? mins - currentMins : null,
                };
            })
            .filter((item) => item.minutes !== null && item.minutes >= currentMins);

        return remaining.slice(1, 3);
    }, [validDepartures]);

    const getRouteBadgeGradient = (no: string) => {
        if (no === "30") return "from-[#003876] to-blue-700 shadow-blue-900/30 text-white";
        if (no === "34") return "from-blue-600 to-indigo-600 shadow-blue-500/25 text-white";
        if (no === "34-1") return "from-indigo-600 to-purple-600 shadow-indigo-500/25 text-white";
        return "from-[#003876] to-blue-700 shadow-blue-900/30 text-white";
    };

    // Urgency styling for wait time badge
    const getWaitBadgeStyle = (waitMins: number) => {
        if (waitMins <= 5) {
            return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-black animate-pulse";
        }
        if (waitMins <= 15) {
            return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-black";
        }
        return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 font-extrabold";
    };

    return (
        <div
            onClick={() => onSelectRoute(route)}
            className="backdrop-blur-2xl bg-white/90 dark:bg-[#141822]/90 rounded-3xl p-4 sm:p-6 flex flex-col justify-between relative group border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-500/60 dark:hover:border-blue-500/60 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-0.5 cursor-pointer select-none active:scale-[0.98]"
        >
            <div>
                {/* Top Section: Route Badge + Location Header & Total Runs / Realtime Map & Schedule Badge */}
                <div className="flex items-center justify-between gap-2.5 mb-2.5 sm:mb-3">
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <div
                            className={`px-3 sm:px-3.5 py-1 rounded-2xl bg-gradient-to-r ${getRouteBadgeGradient(
                                route.routeNo
                            )} font-black text-lg sm:text-xl tracking-tight shadow-sm font-mono shrink-0`}
                        >
                            {route.routeNo}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span
                                className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight truncate">
                                {locationLabel}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-400 font-mono mt-0.5">
                                {UI_TEXT.YONSEI.TOTAL_RUNS(validDepartures.length)}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <span
                            className={`px-2 py-1 rounded-xl text-[10px] sm:text-[11px] font-extrabold border shrink-0 ${
                                route.routeNo === "30"
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                                    : isVacationSchedule
                                        ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30"
                                        : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                            }`}
                        >
                            {route.routeNo === "30"
                                ? UI_TEXT.YONSEI.SCHEDULE_APPLIED_ALL_DAYS
                                : isVacationSchedule
                                    ? UI_TEXT.YONSEI.SCHEDULE_APPLIED_VACATION
                                    : UI_TEXT.YONSEI.SCHEDULE_APPLIED_WEEKDAY}
                        </span>
                        {onSelectMapRoute && (
                            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectMapRoute(route.routeNo);
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[11px] font-bold border border-blue-200/70 dark:border-blue-500/20 transition-all cursor-pointer shadow-2xs active:scale-95"
                                    title={UI_TEXT.YONSEI.REALTIME_MAP_BTN}
                                >
                                    <MapPin className="h-3 w-3 shrink-0"/>
                                    <span className="sm:inline">{UI_TEXT.YONSEI.REALTIME_MAP_BTN}</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Next Upcoming Departure Spotlight Card */}
                <div
                    className={`my-2.5 sm:my-3 p-3.5 sm:p-4 rounded-2xl border transition-all ${
                        nextInfo && nextInfo.waitMins <= 5
                            ? "bg-gradient-to-br from-rose-50/80 to-amber-50/60 dark:from-rose-950/30 dark:to-amber-950/20 border-rose-300/80 dark:border-rose-500/40 shadow-sm"
                            : "bg-blue-50/70 dark:bg-blue-950/30 border-blue-200/70 dark:border-blue-500/25"
                    }`}
                >
                    <div
                        className="text-[11px] font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"/>
                            <span>{UI_TEXT.YONSEI.NEXT_LOCATION_DEP(locationLabel)}</span>
                        </span>
                        {nextInfo && (
                            <span
                                className={`px-2.5 py-0.5 rounded-lg text-[11px] border ${getWaitBadgeStyle(
                                    nextInfo.waitMins
                                )}`}
                            >
                                {nextInfo.waitMins <= 5 && (
                                    <AlertCircle className="w-3 h-3 inline mr-1 -mt-0.5"/>
                                )}
                                {nextInfo.waitMins === 0
                                    ? UI_TEXT.YONSEI.STATUS_DEPARTING_SOON
                                    : UI_TEXT.TIMETABLE.WAIT_MINUTES(nextInfo.waitMins)}
                            </span>
                        )}
                    </div>

                    {nextInfo ? (
                        <div className="flex items-baseline justify-between mt-1">
                            <span
                                className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                                {nextInfo.entry.destDepTime}
                            </span>
                            {nextInfo.entry.notes && (
                                <span
                                    className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-extrabold border border-amber-500/20 truncate max-w-[130px]"
                                    title={nextInfo.entry.notes}
                                >
                                    {nextInfo.entry.notes}
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className="text-xs text-slate-500 dark:text-slate-400 italic py-1">
                            {UI_TEXT.YONSEI.SERVICE_ENDED}
                        </div>
                    )}
                </div>

                {/* Upcoming Departure Times Chips */}
                {upcomingTimes.length > 0 && (
                    <div className="mt-2.5">
                        <div className="grid grid-cols-2 gap-1.5">
                            {upcomingTimes.map((item, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-slate-100/80 dark:bg-white/[0.05] border border-black/5 dark:border-white/5 text-slate-800 dark:text-slate-200"
                                >
                                    <span className="font-mono text-[13px]">{item.destDepTime}</span>
                                    {item.offsetMins !== null && (
                                        <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-400">
                                            {UI_TEXT.YONSEI.STATUS_MINUTES_REL(item.offsetMins)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

YonseiRouteCard.displayName = "YonseiRouteCard";
