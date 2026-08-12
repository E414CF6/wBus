"use client";

import React, {memo, useMemo} from "react";
import {BusRoute} from "@shared/types/bus";
import {parseTimeToMinutes} from "@shared/lib/timeUtils";
import {UI_TEXT} from "@shared/config/locale";
import {ChevronRight, GraduationCap, MapPin, Star} from "lucide-react";

interface YonseiRouteCardProps {
    route: BusRoute;
    isBookmarked: boolean;
    onToggleBookmark: (routeId: string) => void;
    onSelectRoute: (route: BusRoute) => void;
    onSelectMapRoute?: (routeName: string) => void;
    currentTime?: Date;
}

export const YonseiRouteCard: React.FC<YonseiRouteCardProps> = memo(({
                                                                         route,
                                                                         isBookmarked,
                                                                         onToggleBookmark,
                                                                         onSelectRoute,
                                                                         onSelectMapRoute,
                                                                         currentTime,
                                                                     }) => {
    const isHoechon = route.routeNo === "34-1";
    const locationLabel = isHoechon ? "회촌 출발" : "연세대 출발";

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

    // Next 4 upcoming departure times preview
    const upcomingTimes = useMemo(() => {
        if (!validDepartures.length) return [];
        const future = validDepartures.filter((item) => {
            const mins = parseTimeToMinutes(item.destDepTime);
            return mins !== null && mins >= currentMins;
        });
        return (future.length > 0 ? future : validDepartures).slice(0, 4);
    }, [validDepartures, currentMins]);

    const getRouteBadgeGradient = (no: string) => {
        if (no === "30") return "from-[#003876] to-blue-700 shadow-blue-900/30";
        if (no === "34") return "from-blue-600 to-indigo-600 shadow-blue-500/20";
        if (no === "34-1") return "from-indigo-600 to-purple-600 shadow-indigo-500/20";
        return "from-[#003876] to-blue-700 shadow-blue-900/30";
    };

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
            className="backdrop-blur-2xl bg-white/80 dark:bg-[#121212]/80 rounded-3xl p-5 flex flex-col justify-between relative group border border-black/5 dark:border-white/10 hover:border-blue-400/80 dark:hover:border-blue-500/50 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 cursor-pointer select-none active:scale-[0.99]"
        >
            <div>
                {/* Header: Route Badge, Day Type & Bookmarks */}
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center space-x-2.5">
                        <div
                            className={`px-4 py-1.5 rounded-2xl bg-gradient-to-r ${getRouteBadgeGradient(
                                route.routeNo
                            )} font-black text-white text-lg tracking-tight shadow-md`}
                        >
                            {route.routeNo}번
                        </div>
                        <span
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold border ${getDayTypeBadgeStyle()}`}>
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
                                title="실시간 지도"
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
                            title={isBookmarked ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                        >
                            <Star
                                className={`h-4 w-4 ${
                                    isBookmarked ? "fill-amber-400 text-amber-500 dark:text-amber-400" : ""
                                }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Departure Location Subtitle */}
                <div className="flex items-center justify-between my-2 text-xs">
                    <div className="flex items-center space-x-1.5 font-extrabold text-slate-900 dark:text-white">
                        <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400"/>
                        <span>{locationLabel}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400 font-mono">
                        총 {validDepartures.length}회 운행
                    </span>
                </div>

                {/* Next Upcoming Departure Spotlight */}
                <div
                    className="my-3 p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-500/20">
                    <div
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>다음 {locationLabel}</span>
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
                            오늘 운행 종료
                        </div>
                    )}
                </div>

                {/* Upcoming Times Horizontal Badges */}
                {upcomingTimes.length > 0 && (
                    <div className="mt-3">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            이어지는 출발 시각
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {upcomingTimes.map((item, idx) => (
                                <span
                                    key={idx}
                                    className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold border transition-colors ${
                                        nextInfo && nextInfo.entry.destDepTime === item.destDepTime && idx === 0
                                            ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                            : "bg-black/[0.03] dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 border-black/5 dark:border-white/5"
                                    }`}
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
                    전체 시간표 상세
                </span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelectRoute(route);
                    }}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 text-xs font-extrabold border border-blue-500/20 transition-all cursor-pointer"
                >
                    <span>시간표 보기</span>
                    <ChevronRight className="h-3.5 w-3.5"/>
                </button>
            </div>
        </div>
    );
});

YonseiRouteCard.displayName = "YonseiRouteCard";
