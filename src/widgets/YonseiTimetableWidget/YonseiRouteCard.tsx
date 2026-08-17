"use client";

import React, {memo, useMemo} from "react";
import {BusRoute} from "@shared/types/bus";
import {parseTimeToMinutes} from "@shared/lib/timeUtils";
import {UI_TEXT} from "@shared/config/locale";
import {ChevronRight, GraduationCap, MapPin} from "lucide-react";

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

    // Valid departure times from 연세대 (30, 34) or 회촌 (34-1)
    const validDepartures = useMemo(() => {
        return route.timetable.filter(
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
    }, [validDepartures, currentMins]);

    // Next 4 upcoming departure times preview (excluding the current next departure)
    const upcomingTimes = useMemo(() => {
        if (!validDepartures.length) return [];
        const future = validDepartures.filter((item) => {
            const mins = parseTimeToMinutes(item.destDepTime);
            return mins !== null && mins >= currentMins;
        });
        return future.slice(1, 5);
    }, [validDepartures, currentMins]);

    const getRouteBadgeGradient = (no: string) => {
        if (no === "30") return "from-[#003876] to-blue-700 shadow-blue-900/30";
        if (no === "34") return "from-blue-600 to-indigo-600 shadow-blue-500/20";
        if (no === "34-1") return "from-indigo-600 to-purple-600 shadow-indigo-500/20";
        return "from-[#003876] to-blue-700 shadow-blue-900/30";
    };

    return (
        <div
            onClick={() => onSelectRoute(route)}
            className="backdrop-blur-2xl bg-white/80 dark:bg-[#121212]/80 rounded-3xl p-5 flex flex-col justify-between relative group border border-black/5 dark:border-white/10 hover:border-blue-400/80 dark:hover:border-blue-500/50 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 cursor-pointer select-none active:scale-[0.99]"
        >
            <div>
                {/* Header: Route Badge & Realtime Map Button */}
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div
                        className={`px-4 py-1.5 rounded-2xl bg-gradient-to-r ${getRouteBadgeGradient(
                            route.routeNo
                        )} font-black text-white text-lg tracking-tight shadow-md`}
                    >
                        {route.routeNo}번
                    </div>

                    {onSelectMapRoute && (
                        <div onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectMapRoute(route.routeNo);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-200/60 dark:border-blue-500/20 transition-colors cursor-pointer"
                                title={UI_TEXT.YONSEI.REALTIME_MAP_BTN}
                            >
                                <MapPin className="h-3.5 w-3.5"/>
                                <span>{UI_TEXT.YONSEI.REALTIME_MAP_BTN}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Departure Location Subtitle */}
                <div className="flex items-center justify-between my-2 text-xs">
                    <div className="flex items-center space-x-1.5 font-extrabold text-slate-900 dark:text-white">
                        <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400"/>
                        <span>{locationLabel}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400 font-mono">
                        {UI_TEXT.YONSEI.TOTAL_RUNS(validDepartures.length)}
                    </span>
                </div>

                {/* Next Upcoming Departure Spotlight */}
                <div
                    className="my-3 p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-500/20">
                    <div
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>{UI_TEXT.YONSEI.NEXT_LOCATION_DEP(locationLabel)}</span>
                        {nextInfo && (
                            <span
                                className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                                {UI_TEXT.TIMETABLE.WAIT_MINUTES(nextInfo.waitMins)}
                            </span>
                        )}
                    </div>

                    {nextInfo ? (
                        <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                                {nextInfo.entry.destDepTime}
                            </span>
                            {nextInfo.entry.notes && (
                                <span
                                    className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                                    {nextInfo.entry.notes}
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                            {UI_TEXT.YONSEI.SERVICE_ENDED}
                        </div>
                    )}
                </div>

                {/* Upcoming Times Horizontal Badges */}
                {upcomingTimes.length > 0 && (
                    <div className="mt-3">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            {UI_TEXT.YONSEI.UPCOMING_DEP_TIMES}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {upcomingTimes.map((item, idx) => (
                                <span
                                    key={idx}
                                    className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold border transition-colors bg-black/[0.03] dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 border-black/5 dark:border-white/5"
                                >
                                    {item.destDepTime}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* View Full Yonsei Timetable Button */}
            <div className="pt-4 mt-3 border-t border-black/5 dark:border-white/10 flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">
                    {UI_TEXT.YONSEI.FULL_TIMETABLE_DETAIL}
                </span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelectRoute(route);
                    }}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 text-xs font-extrabold border border-blue-500/20 transition-all cursor-pointer"
                >
                    <span>{UI_TEXT.YONSEI.VIEW_TIMETABLE_BTN}</span>
                    <ChevronRight className="h-3.5 w-3.5"/>
                </button>
            </div>
        </div>
    );
});

YonseiRouteCard.displayName = "YonseiRouteCard";
