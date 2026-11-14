"use client";

import React from "react";
import {AlertCircle, Bus, Clock, GraduationCap, Info, MapPin, Table2} from "lucide-react";
import {
    YONSEI_SHUTTLE_SCHEDULE,
    type ShuttleInboundItem,
    type ShuttleOutboundItem,
} from "@entities/schedule";
import {UI_TEXT} from "@shared/config/locale";
import {triggerHaptic} from "@shared/utils/haptics";
import type {CampusDirectionMode, NextShuttleResult} from "../lib/yonseiShuttleUtils";
import {getShuttleWaitBadge} from "../lib/campusPageHelpers";

interface ShuttleSpotlightSectionProps {
    directionMode: CampusDirectionMode;
    shuttleDayType: {
        label: string;
        isSaturday: boolean;
        isSunday: boolean;
    };
    nextOutbound: NextShuttleResult<ShuttleOutboundItem> | null;
    nextInbound: NextShuttleResult<ShuttleInboundItem> | null;
    onOpenShuttleModal: (tab: "OUTBOUND" | "INBOUND" | "GUIDELINES") => void;
    onOpenStopsModal: () => void;
}

export const ShuttleSpotlightSection: React.FC<ShuttleSpotlightSectionProps> = ({
    directionMode,
    shuttleDayType,
    nextOutbound,
    nextInbound,
    onOpenShuttleModal,
    onOpenStopsModal,
}) => {
    const outboundWait = nextOutbound ? getShuttleWaitBadge(nextOutbound.waitMins) : null;
    const inboundWait = nextInbound ? getShuttleWaitBadge(nextInbound.waitMins) : null;

    return (
        <section className="rounded-3xl p-4 sm:p-5 bg-white dark:bg-[#111623] border border-slate-200/85 dark:border-white/10 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#003876] to-blue-700 text-white flex items-center justify-center shadow-xs shrink-0">
                        <GraduationCap className="w-4 h-4"/>
                    </span>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                                {YONSEI_SHUTTLE_SCHEDULE.title}
                            </h2>
                            <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                    shuttleDayType.isSaturday
                                        ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                                        : shuttleDayType.isSunday
                                            ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30"
                                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                }`}
                            >
                                {shuttleDayType.label}
                            </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            학생·교직원 무료 · 세부 시간표와 탑승 위치는 모달에서 확인
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                        type="button"
                        onClick={() => onOpenShuttleModal(directionMode)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/12 text-xs font-extrabold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
                    >
                        <Table2 className="w-3.5 h-3.5 text-[#003876] dark:text-blue-400"/>
                        <span>전체 시간표</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic("light");
                            onOpenStopsModal();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/12 text-xs font-extrabold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
                    >
                        <MapPin className="w-3.5 h-3.5 text-[#003876] dark:text-blue-400"/>
                        <span>탑승 장소</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onOpenShuttleModal("GUIDELINES")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/12 text-xs font-extrabold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
                    >
                        <Info className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400"/>
                        <span>이용 안내</span>
                    </button>
                </div>
            </div>

            {shuttleDayType.isSaturday && (
                <div className="p-3 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0"/>
                    <span>{UI_TEXT.YONSEI_SHUTTLE.SATURDAY_NO_RUN_DESC}</span>
                </div>
            )}

            {/* Dual Next Shuttle Spotlight Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => onOpenShuttleModal("OUTBOUND")}
                    className={`text-left p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] ${
                        directionMode === "OUTBOUND"
                            ? "bg-gradient-to-br from-blue-50/95 to-slate-50/80 dark:from-blue-950/40 dark:to-[#151c2e] border-[#003876] dark:border-blue-500 ring-1 ring-blue-500/20"
                            : "bg-slate-50/80 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/10 hover:bg-blue-50/40 dark:hover:bg-blue-950/20"
                    }`}
                >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="flex items-center gap-1.5 text-xs font-black text-[#003876] dark:text-blue-300">
                            <Clock className="w-3.5 h-3.5 shrink-0"/>
                            <span>{UI_TEXT.YONSEI_SHUTTLE.NEXT_FROM_CAMPUS}</span>
                        </span>
                        {outboundWait && (
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] border tabular-nums ${outboundWait.pillClass}`}>
                                {outboundWait.dotClass && (
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${outboundWait.dotClass}`}/>
                                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${outboundWait.dotClass}`}/>
                                    </span>
                                )}
                                <span>{outboundWait.label}</span>
                            </span>
                        )}
                    </div>

                    {nextOutbound ? (
                        <div className="space-y-1">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="text-2xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white">
                                    {nextOutbound.item.departure_time}
                                </span>
                                <span className="text-xs font-extrabold text-blue-700 dark:text-blue-300 truncate">
                                    {nextOutbound.item.departure_point} → {nextOutbound.item.destination}
                                </span>
                            </div>
                            {nextOutbound.item.via.length > 0 && (
                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                    경유: {nextOutbound.item.via.map((v) => v.name).join(" → ")}
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 py-1.5">
                            {shuttleDayType.isSaturday
                                ? "토요일은 셔틀 운행이 없습니다"
                                : "금일 하교 셔틀 운행이 종료되었습니다"}
                        </p>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => onOpenShuttleModal("INBOUND")}
                    className={`text-left p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] ${
                        directionMode === "INBOUND"
                            ? "bg-gradient-to-br from-indigo-50/95 to-slate-50/80 dark:from-indigo-950/40 dark:to-[#151c2e] border-indigo-600 dark:border-indigo-400 ring-1 ring-indigo-500/20"
                            : "bg-slate-50/80 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/10 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20"
                    }`}
                >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="flex items-center gap-1.5 text-xs font-black text-indigo-700 dark:text-indigo-300">
                            <Bus className="w-3.5 h-3.5 shrink-0"/>
                            <span>{UI_TEXT.YONSEI_SHUTTLE.NEXT_TO_CAMPUS}</span>
                        </span>
                        {inboundWait && (
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] border tabular-nums ${inboundWait.pillClass}`}>
                                {inboundWait.dotClass && (
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${inboundWait.dotClass}`}/>
                                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${inboundWait.dotClass}`}/>
                                    </span>
                                )}
                                <span>{inboundWait.label}</span>
                            </span>
                        )}
                    </div>

                    {nextInbound ? (
                        <div className="space-y-1">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="text-2xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white">
                                    {nextInbound.item.departure_time}
                                </span>
                                <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300 truncate">
                                    {nextInbound.item.departure_point} 발 → 미래캠퍼스
                                </span>
                            </div>
                            {nextInbound.item.via.length > 0 ? (
                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                    경유:{" "}
                                    {nextInbound.item.via
                                        .map((v) => (v.time ? `${v.name}(${v.time})` : v.name))
                                        .join(" → ")}
                                </p>
                            ) : (
                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                    {nextInbound.item.note || UI_TEXT.YONSEI_SHUTTLE.NO_VIA_EXPRESS}
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 py-1.5">
                            {shuttleDayType.isSaturday
                                ? "토요일은 셔틀 운행이 없습니다"
                                : "금일 등교 셔틀 운행이 종료되었습니다"}
                        </p>
                    )}
                </button>
            </div>
        </section>
    );
};
