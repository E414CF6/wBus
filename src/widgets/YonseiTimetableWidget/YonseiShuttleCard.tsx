"use client";

import React, {memo, useMemo} from "react";
import {AlertCircle, Bus, ChevronRight, Clock, GraduationCap, MapPin} from "lucide-react";

import {YONSEI_SHUTTLE_SCHEDULE} from "@/data/yonseiShuttleSchedule";
import {parseTimeToMinutes} from "@shared/lib/timeUtils";

import type {ShuttleTab} from "./types";

interface YonseiShuttleCardProps {
    onOpenModal: (tab?: ShuttleTab) => void;
    currentTime?: Date;
}

export const YonseiShuttleCard: React.FC<YonseiShuttleCardProps> = memo(({
                                                                             onOpenModal,
                                                                             currentTime,
                                                                         }) => {
    const now = currentTime || new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const dayOfWeek = now.getDay();
    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;

    // Filter by today's day type and sort chronologically by departure time
    const applicableInboundList = useMemo(() => {
        if (isSaturday) return [];
        const list = YONSEI_SHUTTLE_SCHEDULE.inbound_to_campus;
        return list
            .filter((item) => {
                if (isSunday) {
                    return item.operation_type.includes("일요일");
                }
                return item.operation_type.includes("평일") || !item.operation_type.includes("일요일");
            })
            .slice()
            .sort((a, b) => (parseTimeToMinutes(a.departure_time) ?? 0) - (parseTimeToMinutes(b.departure_time) ?? 0));
    }, []);

    const applicableOutboundList = useMemo(() => {
        if (isSaturday) return [];
        const list = YONSEI_SHUTTLE_SCHEDULE.outbound_from_campus;
        return list
            .filter((item) => {
                if (isSunday) {
                    return item.operation_type.includes("일요일");
                }
                return item.operation_type.includes("평일") || !item.operation_type.includes("일요일");
            })
            .slice()
            .sort((a, b) => (parseTimeToMinutes(a.departure_time) ?? 0) - (parseTimeToMinutes(b.departure_time) ?? 0));
    }, []);

    // Find next upcoming inbound shuttle (earliest time >= currentMins)
    const nextInbound = useMemo(() => {
        for (const item of applicableInboundList) {
            const mins = parseTimeToMinutes(item.departure_time);
            if (mins !== null && mins >= currentMins) {
                return {
                    item,
                    waitMins: mins - currentMins,
                    type: "inbound" as const,
                };
            }
        }
        return null;
    }, [applicableInboundList]);

    // Find next upcoming outbound shuttle (earliest time >= currentMins)
    const nextOutbound = useMemo(() => {
        for (const item of applicableOutboundList) {
            const mins = parseTimeToMinutes(item.departure_time);
            if (mins !== null && mins >= currentMins) {
                return {
                    item,
                    waitMins: mins - currentMins,
                    type: "outbound" as const,
                };
            }
        }
        return null;
    }, [applicableOutboundList]);

    const hasUpcomingShuttle = Boolean(nextInbound || nextOutbound);

    const getWaitBadgeStyle = (waitMins: number) => {
        if (waitMins <= 10) {
            return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-black animate-pulse";
        }
        if (waitMins <= 30) {
            return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-black";
        }
        return "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30 font-extrabold";
    };

    // Minimized banner view when no shuttles are operating / available
    if (!hasUpcomingShuttle) {
        return (
            <div
                onClick={() => onOpenModal("inbound")}
                className="w-full backdrop-blur-2xl bg-gradient-to-r from-teal-900/[0.03] via-white/80 to-emerald-900/[0.03] dark:from-teal-950/25 dark:via-[#131926]/80 dark:to-emerald-950/20 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-teal-500/20 dark:border-teal-500/20 hover:border-teal-500/60 dark:hover:border-teal-400/60 transition-all duration-300 shadow-xs hover:shadow-md cursor-pointer select-none active:scale-[0.99] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 group"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpenModal("inbound");
                    }
                }}
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                        <Bus className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 dark:text-teal-400"/>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span
                                className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-tight truncate">
                                무료 셔틀버스
                            </span>
                            <span
                                className="px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-400 text-[10px] sm:text-[11px] font-bold border border-black/5 dark:border-white/5">
                                {isSaturday ? "토요일 미운행" : "운행 종료"}
                            </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                            {isSaturday
                                ? "토요일은 셔틀버스를 운행하지 않습니다 (시간표 및 정류장 위치 확인)"
                                : "오늘 셔틀버스 운행이 종료되었습니다 (전체 시간표 및 정류장 확인)"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenModal("stops");
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-black border border-blue-500/20 transition-all cursor-pointer active:scale-95"
                    >
                        <MapPin className="w-3.5 h-3.5"/>
                        <span>정류장 지도</span>
                    </button>

                    <div
                        className="flex items-center gap-1 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-teal-500/10 group-hover:bg-gradient-to-r group-hover:from-teal-600 group-hover:to-emerald-600 dark:bg-teal-500/15 text-teal-700 group-hover:text-white dark:text-teal-300 dark:group-hover:text-white text-xs font-black border border-teal-500/25 group-hover:border-transparent group-hover:shadow-md group-hover:shadow-teal-700/20 transition-all">
                        <GraduationCap className="w-3.5 h-3.5"/>
                        <span>시간표 보기</span>
                        <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"/>
                    </div>
                </div>
            </div>
        );
    }

    // Standard card view when upcoming shuttle buses exist
    return (
        <div
            onClick={() => onOpenModal("inbound")}
            className="w-full backdrop-blur-2xl bg-gradient-to-br from-teal-900/[0.04] via-white/90 to-emerald-900/[0.04] dark:from-teal-950/40 dark:via-[#131926]/90 dark:to-emerald-950/30 rounded-3xl p-4 sm:p-6 border border-teal-500/30 dark:border-teal-500/30 hover:border-teal-500/70 dark:hover:border-teal-400/70 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-0.5 cursor-pointer select-none active:scale-[0.99] flex flex-col justify-between group"
        >
            <div>
                {/* Header */}
                <div className="flex items-center justify-between gap-2.5 mb-2.5 sm:mb-3">
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <div
                            className="px-3 sm:px-3.5 py-1 rounded-2xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 text-white font-black text-sm sm:text-base tracking-tight shadow-md shadow-teal-700/20 shrink-0 flex items-center gap-1.5">
                            <Bus className="w-4 h-4"/>
                            <span>셔틀버스</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span
                                className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight truncate">
                                {YONSEI_SHUTTLE_SCHEDULE.title}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-400 font-mono mt-0.5">
                                등교 17회 / 하교 12회 운행
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenModal("stops");
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[11px] font-bold border border-blue-200/70 dark:border-blue-500/20 transition-all cursor-pointer shadow-2xs active:scale-95"
                            title="셔틀 정류장 위치 및 로드뷰 지도 보기"
                        >
                            <MapPin className="h-3 w-3 shrink-0"/>
                            <span className="sm:inline">정류장 지도</span>
                        </button>
                        <div
                            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 text-[10px] sm:text-[11px] font-extrabold border border-teal-200/80 dark:border-teal-500/30 shrink-0">
                            <span>{isSunday ? "일요일" : "평일"}</span>
                        </div>
                    </div>
                </div>

                {/* Subtitle / Key Stations */}
                <div
                    className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-3 flex items-center gap-1.5 overflow-hidden">
                    <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0"/>
                    <span className="truncate">
                        여주역 · 만종역 · 원주고속터미널 · 원주역 · 시청사거리 · 세브란스 ↔ 미래캠퍼스
                    </span>
                </div>

                {/* Live Next Upcoming Shuttle Spotlight */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 my-2">
                    {/* Inbound Next */}
                    <div
                        className="p-3 sm:p-3.5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-500/25 flex flex-col justify-between">
                        <div
                            className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider mb-1">
                            <span className="flex items-center gap-1 text-teal-800 dark:text-teal-200 font-black">
                                <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400"/>
                                <span>다음 등교 셔틀 (캠퍼스행)</span>
                            </span>
                            {nextInbound && (
                                <span
                                    className={`px-2 py-0.5 rounded-lg text-[10px] border ${getWaitBadgeStyle(
                                        nextInbound.waitMins
                                    )}`}
                                >
                                    {nextInbound.waitMins <= 5 && (
                                        <AlertCircle className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5"/>
                                    )}
                                    {nextInbound.waitMins === 0
                                        ? "곧 출발"
                                        : `${nextInbound.waitMins}분 후`}
                                </span>
                            )}
                        </div>

                        {nextInbound ? (
                            <div className="flex items-baseline justify-between mt-1">
                                <div>
                                    <span
                                        className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                                        {nextInbound.item.departure_time}
                                    </span>
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-1.5">
                                        {nextInbound.item.departure_point} 발
                                    </span>
                                </div>
                                {nextInbound.item.note && (
                                    <span
                                        className="px-1.5 py-0.5 rounded-md bg-teal-500/15 text-teal-800 dark:text-teal-200 text-[10px] font-extrabold border border-teal-500/20">
                                        {nextInbound.item.note}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="text-xs text-slate-400 dark:text-slate-500 italic py-1">
                                오늘 등교 운행이 종료되었습니다
                            </div>
                        )}
                    </div>

                    {/* Outbound Next */}
                    <div
                        className="p-3 sm:p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-500/25 flex flex-col justify-between">
                        <div
                            className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider mb-1">
                            <span className="flex items-center gap-1 text-emerald-800 dark:text-emerald-200 font-black">
                                <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400"/>
                                <span>다음 하교 셔틀 (캠퍼스발)</span>
                            </span>
                            {nextOutbound && (
                                <span
                                    className={`px-2 py-0.5 rounded-lg text-[10px] border ${getWaitBadgeStyle(
                                        nextOutbound.waitMins
                                    )}`}
                                >
                                    {nextOutbound.waitMins <= 5 && (
                                        <AlertCircle className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5"/>
                                    )}
                                    {nextOutbound.waitMins === 0
                                        ? "곧 출발"
                                        : `${nextOutbound.waitMins}분 후`}
                                </span>
                            )}
                        </div>

                        {nextOutbound ? (
                            <div className="flex items-baseline justify-between mt-1">
                                <div>
                                    <span
                                        className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                                        {nextOutbound.item.departure_time}
                                    </span>
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-1.5">
                                        → {nextOutbound.item.destination} 행
                                    </span>
                                </div>
                                {nextOutbound.item.note && (
                                    <span
                                        className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 text-[10px] font-extrabold border border-emerald-500/20 max-w-[140px] truncate"
                                        title={nextOutbound.item.note}>
                                        {nextOutbound.item.note}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="text-xs text-slate-400 dark:text-slate-500 italic py-1">
                                오늘 하교 운행이 종료되었습니다
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

YonseiShuttleCard.displayName = "YonseiShuttleCard";
