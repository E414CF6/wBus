"use client";

import React, {memo} from "react";
import {BusRoute} from "@shared/types/bus";
import {getNextDeparture} from "@shared/lib/timeUtils";
import {UI_TEXT} from "@shared/config/locale";
import {ArrowRight, ChevronRight, Clock, MapPin, Star} from "lucide-react";

interface RouteCardProps {
    route: BusRoute;
    isBookmarked: boolean;
    onToggleBookmark: (routeId: string) => void;
    onSelectRoute: (route: BusRoute) => void;
    onSelectMapRoute?: (routeName: string) => void;
}

export const RouteCard: React.FC<RouteCardProps> = memo(({
                                                             route,
                                                             isBookmarked,
                                                             onToggleBookmark,
                                                             onSelectRoute,
                                                             onSelectMapRoute,
                                                         }) => {
    const {nextOrigin, nextDest, originWaitMins, destWaitMins, soonest} = getNextDeparture(route.timetable);

    // Get color gradient for route badge based on route number
    const getRouteBadgeGradient = (no: string) => {
        if (no.startsWith("2")) return "from-teal-500 to-emerald-600 shadow-emerald-500/20";
        if (no.startsWith("16")) return "from-purple-600 to-indigo-600 shadow-purple-500/20";
        if (no.startsWith("3")) return "from-blue-600 to-indigo-600 shadow-blue-500/20";
        if (no.startsWith("4")) return "from-cyan-600 to-blue-600 shadow-cyan-500/20";
        if (no.startsWith("5")) return "from-amber-500 to-orange-600 shadow-orange-500/20";
        return "from-blue-600 to-indigo-600 shadow-blue-600/20";
    };

    // Determine badge style based on day type
    const getDayTypeBadgeStyle = () => {
        if (route.dayType.includes("방학"))
            return "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300/60 dark:border-amber-500/40";
        if (route.dayType.includes("토요일"))
            return "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-300/60 dark:border-indigo-500/40";
        if (route.dayType.includes("일") || route.dayType.includes("공휴일"))
            return "bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300/60 dark:border-rose-500/40";
        return "bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300/60 dark:border-blue-500/40";
    };

    return (
        <div
            onClick={() => onSelectRoute(route)}
            className="backdrop-blur-2xl bg-white/80 dark:bg-[#121212]/80 rounded-2xl p-5 flex flex-col justify-between relative group border border-black/5 dark:border-white/10 hover:border-blue-400/80 dark:hover:border-blue-500/50 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 cursor-pointer select-none active:scale-[0.99]"
        >
            {/* Card Content Container */}
            <div>
                {/* Header: Route Number Badge, Day Type & Actions */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center space-x-2.5">
                        <div
                            className={`px-3.5 py-1.5 rounded-xl bg-gradient-to-r ${getRouteBadgeGradient(
                                route.routeNo
                            )} font-black text-white text-lg tracking-tight shadow-md`}
                        >
                            {route.routeNo}
                        </div>
                        <span
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${getDayTypeBadgeStyle()}`}>
              {route.dayType}
            </span>
                    </div>

                    <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                        {onSelectMapRoute && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectMapRoute(route.routeNo);
                                }}
                                className="p-2 rounded-xl bg-slate-100/80 hover:bg-blue-50 dark:bg-white/[0.06] dark:hover:bg-blue-950/60 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors border border-black/5 dark:border-white/10 cursor-pointer"
                                title={UI_TEXT.TIMETABLE.VIEW_REALTIME_MAP_BTN}
                            >
                                <MapPin className="h-4 w-4"/>
                            </button>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleBookmark(route.id);
                            }}
                            className="p-2 rounded-xl bg-slate-100/80 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors border border-black/5 dark:border-white/10 cursor-pointer"
                            title={isBookmarked ? UI_TEXT.TIMETABLE.BOOKMARK_TOGGLE_REMOVE : UI_TEXT.TIMETABLE.BOOKMARK_TOGGLE_ADD}
                        >
                            <Star
                                className={`h-4 w-4 ${
                                    isBookmarked ? "fill-amber-400 text-amber-500 dark:text-amber-400" : ""
                                }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Origin -> Destination Banner */}
                <div
                    className="flex items-center space-x-2 my-3 text-slate-900 dark:text-slate-100 font-extrabold text-base tracking-tight">
          <span className="truncate max-w-[130px]" title={route.origin}>
            {route.origin}
          </span>
                    <ArrowRight className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0"/>
                    <span className="truncate max-w-[130px]" title={route.destination}>
            {route.destination}
          </span>
                </div>

                {/* Route Stats Matrix */}
                <div
                    className="grid grid-cols-2 gap-2 my-4 text-xs text-slate-500 dark:text-slate-400 bg-black/[0.025] dark:bg-white/[0.03] p-3 rounded-xl border border-black/5 dark:border-white/5">
                    <div>
                        <span
                            className="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">{UI_TEXT.TIMETABLE.FIRST_LAST_BUS}</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
              {route.firstBus} ~ {route.lastBus}
            </span>
                    </div>
                    <div>
                        <span
                            className="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">{UI_TEXT.TIMETABLE.RUN_INTERVAL}</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
              {route.runCount} ({route.interval})
            </span>
                    </div>
                </div>
            </div>

            {/* Next Departure Info by Location & Action Button */}
            <div
                className="pt-3 border-t border-black/5 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mt-1">
                {/* Next Bus Departure Locations */}
                <div className="flex flex-col gap-1 text-xs min-w-0 flex-1">
                    {nextOrigin || nextDest ? (
                        <div className="flex flex-col gap-1">
                            {/* Origin Departure */}
                            {nextOrigin && (
                                <div className="flex items-center space-x-1.5 min-w-0">
                  <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                    <span
                        className={`relative inline-flex rounded-full h-2 w-2 ${
                            soonest?.type === "origin"
                                ? "bg-emerald-500 animate-pulse"
                                : "bg-teal-400 dark:bg-teal-500"
                        }`}
                    />
                  </span>
                                    <span
                                        className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 shrink-0">
                    {UI_TEXT.TIMETABLE.ORIGIN_LABEL(route.origin)}
                  </span>
                                    <span className="text-slate-800 dark:text-slate-200 font-bold truncate">
                    <strong className="font-mono text-slate-900 dark:text-white">{nextOrigin.originDepTime}</strong>
                                        {originWaitMins !== null && originWaitMins >= 0 && (
                                            <span
                                                className="ml-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-extrabold">
                        {UI_TEXT.TIMETABLE.WAIT_MINUTES(originWaitMins)}
                      </span>
                                        )}
                  </span>
                                </div>
                            )}

                            {/* Destination Departure */}
                            {nextDest && (
                                <div className="flex items-center space-x-1.5 min-w-0">
                  <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                    <span
                        className={`relative inline-flex rounded-full h-2 w-2 ${
                            soonest?.type === "dest"
                                ? "bg-emerald-500 animate-pulse"
                                : "bg-indigo-400 dark:bg-indigo-500"
                        }`}
                    />
                  </span>
                                    <span
                                        className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 shrink-0">
                    {UI_TEXT.TIMETABLE.DEST_LABEL(route.destination)}
                  </span>
                                    <span className="text-slate-800 dark:text-slate-200 font-bold truncate">
                    <strong className="font-mono text-slate-900 dark:text-white">{nextDest.destDepTime}</strong>
                                        {destWaitMins !== null && destWaitMins >= 0 && (
                                            <span
                                                className="ml-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-extrabold">
                        {UI_TEXT.TIMETABLE.WAIT_MINUTES(destWaitMins)}
                      </span>
                                        )}
                  </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center space-x-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0"/>
                            <span
                                className="text-slate-400 dark:text-slate-500 text-[11px]">{UI_TEXT.TIMETABLE.SERVICE_ENDED}</span>
                        </div>
                    )}
                </div>

                {/* View Timetable Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelectRoute(route);
                    }}
                    className="flex items-center justify-center space-x-1 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-200/80 dark:border-blue-500/20 transition-all group-hover:border-blue-400 cursor-pointer shrink-0 self-end sm:self-center"
                >
                    <span>{UI_TEXT.TIMETABLE.VIEW_TIMETABLE_BTN}</span>
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"/>
                </button>
            </div>
        </div>
    );
});

RouteCard.displayName = "RouteCard";
