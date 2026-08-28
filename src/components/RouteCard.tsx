"use client";

import React, {useMemo} from "react";
import {AlertCircle, ArrowRight, Clock, Sparkles} from "lucide-react";

import {BusRoute} from "@/types/bus";

import {ROUTE_CONFIG} from "@data/yonseiRoutes";
import {getUpcomingDepartures} from "@lib/timeUtils";

interface RouteCardProps {
    route: BusRoute;
    currentTime: Date;
    onOpenModal: (route: BusRoute) => void;
}

export const RouteCard: React.FC<RouteCardProps> = ({
                                                        route,
                                                        currentTime,
                                                        onOpenModal,
                                                    }) => {
    const config = ROUTE_CONFIG[route.routeNo] || {
        name: `${route.routeNo}번`,
        gradient: "from-blue-600 to-indigo-600",
        destLabel: "연세대 출발",
        originLabel: "장양리 출발",
        viaStops: "",
        description: "",
    };

    const isHoechon = route.routeNo === "34-1";
    const departureTitle = isHoechon ? "회촌 출발" : "연세대 출발";
    const directionSubtitle = isHoechon
        ? "연세대 · 시내 방면"
        : "시내 · 터미널 방면";

    const departureShortLabel = isHoechon ? "회촌발" : "연세대발";

    // Calculate upcoming departures for outbound ("DEST") direction
    const {nextDeparture, subsequentDepartures, allValidDepartures} = useMemo(() => {
        return getUpcomingDepartures(route.timetable, "DEST", currentTime);
    }, [route.timetable, currentTime]);

    const isVacationSchedule = useMemo(() => {
        const d = route.dayType || "";
        return (
            d.includes("방학") ||
            d.includes("휴일") ||
            d.includes("토요일") ||
            d.includes("공휴일")
        );
    }, [route.dayType]);

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
            onClick={() => onOpenModal(route)}
            className="backdrop-blur-2xl bg-white/75 dark:bg-[#111622]/80 border border-slate-200/80 dark:border-white/10 rounded-3xl p-5 sm:p-6 flex flex-col justify-between relative group hover:border-blue-500/60 dark:hover:border-blue-400/60 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-0.5 cursor-pointer select-none active:scale-[0.99]"
        >
            <div>
                {/* Top Row: Route Badge + Departure Title & Direction Subtitle */}
                <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div
                            className={`px-3.5 py-1 rounded-2xl bg-gradient-to-r ${config.gradient} font-black text-white text-xl tracking-tight shadow-md font-mono shrink-0`}
                        >
                            {route.routeNo}
                        </div>
                        <div className="flex flex-col min-w-0">
              <span className="text-base font-black text-slate-900 dark:text-white leading-tight truncate">
                {departureTitle}
              </span>
                            <span
                                className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {directionSubtitle}
              </span>
                        </div>
                    </div>

                    <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${
                            route.routeNo === "30"
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                                : isVacationSchedule
                                    ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30"
                                    : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                        }`}
                    >
              {route.routeNo === "30"
                  ? "매일 운행"
                  : isVacationSchedule
                      ? "방학 · 휴일"
                      : "평일"}
            </span>
                </div>

                {/* Next Upcoming Departure Spotlight Card */}
                <div
                    className={`my-3 p-4 rounded-2xl border transition-all ${
                        nextDeparture && nextDeparture.waitMins <= 5
                            ? "bg-gradient-to-br from-rose-50/90 to-amber-50/70 dark:from-rose-950/40 dark:to-amber-950/20 border-rose-300/80 dark:border-rose-500/40 shadow-xs"
                            : "bg-blue-50/60 dark:bg-blue-950/30 border-blue-200/70 dark:border-blue-500/25"
                    }`}
                >
                    <div
                        className="text-[11px] font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
              <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"/>
              <span>다음 {departureShortLabel} 출발 버스</span>
            </span>
                        {nextDeparture && (
                            <span
                                className={`px-2.5 py-0.5 rounded-lg text-[11px] border ${getWaitBadgeStyle(
                                    nextDeparture.waitMins
                                )}`}
                            >
                {nextDeparture.waitMins <= 5 && (
                    <AlertCircle className="w-3 h-3 inline mr-1 -mt-0.5"/>
                )}
                                {nextDeparture.waitMins === 0
                                    ? "곧 출발"
                                    : `${nextDeparture.waitMins}분 후`}
              </span>
                        )}
                    </div>

                    {nextDeparture ? (
                        <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                {nextDeparture.timeStr}
              </span>
                            {nextDeparture.entry.notes && (
                                <span
                                    className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-extrabold border border-amber-500/20 truncate max-w-[150px]"
                                    title={nextDeparture.entry.notes}
                                >
                  {nextDeparture.entry.notes}
                </span>
                            )}
                        </div>
                    ) : (
                        <div className="text-xs text-slate-500 dark:text-slate-400 italic py-1">
                            오늘 남은 출발 예정 버스가 없습니다 (운행 종료)
                        </div>
                    )}
                </div>

                {/* Upcoming Subsequent Departures Chips */}
                {subsequentDepartures.length > 0 && (
                    <div className="mt-3">
                        <div
                            className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-blue-500"/>
                            <span>이어지는 출발 시각</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            {subsequentDepartures.map((item, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-slate-100/80 dark:bg-white/[0.04] border border-black/5 dark:border-white/5 text-slate-800 dark:text-slate-200"
                                >
                                    <span className="font-mono text-[13px]">{item.timeStr}</span>
                                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-400">
                    +{item.waitMins}분
                  </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* View Full Timetable Footer Button */}
            <div
                className="pt-4 mt-4 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono">
          총 {allValidDepartures.length}회 운행
        </span>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenModal(route);
                    }}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 text-xs font-black border border-blue-500/20 transition-all cursor-pointer active:scale-95"
                >
                    <span>시간표 전체보기</span>
                    <ArrowRight className="h-3.5 w-3.5"/>
                </button>
            </div>
        </div>
    );
};
