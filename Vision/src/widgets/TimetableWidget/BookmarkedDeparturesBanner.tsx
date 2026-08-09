"use client";

import React, {memo} from "react";
import {BusRoute} from "@shared/types/bus";
import {getNextDeparture} from "@shared/lib/timeUtils";
import {UI_TEXT} from "@shared/config/locale";
import {ArrowRight, ChevronRight, Clock, Star} from "lucide-react";

interface BookmarkedDeparturesBannerProps {
    routes: BusRoute[];
    bookmarks: string[];
    onSelectRoute: (route: BusRoute) => void;
    currentTime?: Date;
}

export const BookmarkedDeparturesBanner: React.FC<BookmarkedDeparturesBannerProps> = memo(
    ({routes, bookmarks, onSelectRoute, currentTime}) => {
        // Filter routes that are bookmarked
        const bookmarkedRoutes = routes.filter(
            (route) => bookmarks.includes(route.id) || bookmarks.includes(route.routeNo)
        );

        if (bookmarkedRoutes.length === 0) {
            return null;
        }

        const getRouteBadgeGradient = (no: string) => {
            if (no.startsWith("2")) return "from-teal-500 to-emerald-600 shadow-emerald-500/20";
            if (no.startsWith("16")) return "from-purple-600 to-indigo-600 shadow-purple-500/20";
            if (no.startsWith("3")) return "from-blue-600 to-indigo-600 shadow-blue-500/20";
            if (no.startsWith("4")) return "from-cyan-600 to-blue-600 shadow-cyan-500/20";
            if (no.startsWith("5")) return "from-amber-500 to-orange-600 shadow-orange-500/20";
            return "from-blue-600 to-indigo-600 shadow-blue-600/20";
        };

        return (
            <div
                className="mb-6 backdrop-blur-2xl bg-amber-500/5 dark:bg-amber-500/10 rounded-3xl p-5 border border-amber-500/20 dark:border-amber-500/30 shadow-sm transition-all">
                {/* Banner Title Header */}
                <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center space-x-2">
                        <div
                            className="flex items-center justify-center w-7 h-7 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                            <Star className="w-4 h-4 fill-amber-400"/>
                        </div>
                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                            {UI_TEXT.TIMETABLE.BOOKMARKS_BANNER_TITLE}
                        </h3>
                        <span
                            className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                            {UI_TEXT.TIMETABLE.BOOKMARKS_BANNER_COUNT(bookmarkedRoutes.length)}
                        </span>
                    </div>
                </div>

                {/* Horizontal Scrollable Departure Cards Carousel */}
                <div className="flex items-stretch gap-3 overflow-x-auto pb-1.5 custom-scrollbar">
                    {bookmarkedRoutes.map((route) => {
                        const {nextOrigin, nextDest, originWaitMins, destWaitMins} = getNextDeparture(
                            route.timetable,
                            currentTime
                        );

                        return (
                            <div
                                key={`bookmark-card-${route.id}`}
                                onClick={() => onSelectRoute(route)}
                                className="min-w-[260px] sm:min-w-[290px] backdrop-blur-xl bg-white/90 dark:bg-[#18181b]/90 rounded-2xl p-3.5 border border-black/5 dark:border-white/10 hover:border-amber-400/80 dark:hover:border-amber-400/50 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer select-none group flex flex-col justify-between"
                            >
                                {/* Header: Route Badge & Origin->Dest */}
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div
                                            className={`px-2.5 py-1 rounded-xl bg-gradient-to-r ${getRouteBadgeGradient(
                                                route.routeNo
                                            )} font-black text-white text-xs tracking-tight shadow-xs`}
                                        >
                                            {route.routeNo}
                                        </div>

                                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                            {route.dayType}
                                        </span>
                                    </div>

                                    <div
                                        className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-3 truncate">
                                        <span className="truncate">{route.origin}</span>
                                        <ArrowRight className="w-3.5 h-3.5 text-amber-500 shrink-0"/>
                                        <span className="truncate">{route.destination}</span>
                                    </div>
                                </div>

                                {/* Departures Matrix */}
                                <div className="space-y-1.5 pt-2 border-t border-black/5 dark:border-white/5 text-xs">
                                    {nextOrigin || nextDest ? (
                                        <>
                                            {nextOrigin && (
                                                <div className="flex items-center justify-between gap-2">
                                                    <span
                                                        className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 shrink-0">
                                                        {UI_TEXT.TIMETABLE.ORIGIN_LABEL(route.origin)}
                                                    </span>
                                                    <span
                                                        className="font-mono font-bold text-slate-900 dark:text-white truncate">
                                                        {nextOrigin.originDepTime}
                                                        {originWaitMins !== null && originWaitMins >= 0 && (
                                                            <span
                                                                className="ml-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-extrabold">
                                                                {UI_TEXT.TIMETABLE.WAIT_MINUTES(originWaitMins)}
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            )}

                                            {nextDest && (
                                                <div className="flex items-center justify-between gap-2">
                                                    <span
                                                        className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 shrink-0">
                                                        {UI_TEXT.TIMETABLE.DEST_LABEL(route.destination)}
                                                    </span>
                                                    <span
                                                        className="font-mono font-bold text-slate-900 dark:text-white truncate">
                                                        {nextDest.destDepTime}
                                                        {destWaitMins !== null && destWaitMins >= 0 && (
                                                            <span
                                                                className="ml-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-extrabold">
                                                                {UI_TEXT.TIMETABLE.WAIT_MINUTES(destWaitMins)}
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div
                                            className="flex items-center space-x-1.5 text-slate-400 dark:text-slate-500 text-[11px]">
                                            <Clock className="w-3.5 h-3.5"/>
                                            <span>{UI_TEXT.TIMETABLE.SERVICE_ENDED}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Quick Action */}
                                <div
                                    className="mt-2.5 pt-1.5 flex items-center justify-end text-[11px] font-bold text-amber-600 dark:text-amber-400 group-hover:underline">
                                    <span>{UI_TEXT.TIMETABLE.VIEW_TIMETABLE_DETAIL}</span>
                                    <ChevronRight
                                        className="w-3 h-3 ml-0.5 transition-transform group-hover:translate-x-0.5"/>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
);

BookmarkedDeparturesBanner.displayName = "BookmarkedDeparturesBanner";
