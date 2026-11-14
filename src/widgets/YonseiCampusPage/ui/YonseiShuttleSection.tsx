"use client";

import React, {memo, useId, useMemo, useState} from "react";
import {AlertCircle, Bus, Clock, GraduationCap, Info, Search, X} from "lucide-react";

import {type ShuttleInboundItem, type ShuttleOutboundItem, YONSEI_SHUTTLE_SCHEDULE,} from "@entities/schedule";
import {UI_TEXT} from "@shared/config/locale";
import type {DayMode} from "@shared/types/navigation";
import {
    type CampusDirectionMode,
    filterShuttleSchedule,
    getNextShuttleDepartures,
    type ShuttleDayFilter,
} from "../lib/yonseiShuttleUtils";

export interface YonseiShuttleSectionProps {
    directionMode: CampusDirectionMode;
    onDirectionModeChange: (mode: CampusDirectionMode) => void;
    dayMode: DayMode;
    now: Date;
}

type ShuttleTab = "OUTBOUND" | "INBOUND" | "GUIDELINES";

function getShuttleWaitConfig(waitMins: number): {
    pillClass: string;
    dotClass: string | null;
    label: string;
} {
    if (waitMins <= 10) {
        return {
            pillClass: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30 font-black",
            dotClass: "bg-rose-500",
            label: waitMins === 0 ? "곧 출발" : `${waitMins}분 후`,
        };
    }
    if (waitMins <= 30) {
        return {
            pillClass:
                "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-black",
            dotClass: null,
            label: `${waitMins}분 후`,
        };
    }
    return {
        pillClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25 font-extrabold",
        dotClass: null,
        label: `${waitMins}분 후`,
    };
}

export const YonseiShuttleSection: React.FC<YonseiShuttleSectionProps> = memo(
    function YonseiShuttleSection({directionMode, onDirectionModeChange, dayMode, now}) {
        const [activeTab, setActiveTab] = useState<ShuttleTab>(directionMode);
        const [prevDirectionMode, setPrevDirectionMode] = useState<CampusDirectionMode>(directionMode);

        if (directionMode !== prevDirectionMode) {
            setPrevDirectionMode(directionMode);
            setActiveTab(directionMode);
        }

        const [dayFilter, setDayFilter] = useState<ShuttleDayFilter>("ALL");
        const [searchQuery, setSearchQuery] = useState("");
        const tabBaseId = useId();

        const {dayType, nextInbound, nextOutbound} = useMemo(() => {
            return getNextShuttleDepartures(YONSEI_SHUTTLE_SCHEDULE, dayMode, now);
        }, [dayMode, now]);

        const filteredOutbound = useMemo(() => {
            return filterShuttleSchedule(
                YONSEI_SHUTTLE_SCHEDULE.outbound_from_campus,
                dayFilter,
                searchQuery
            );
        }, [dayFilter, searchQuery]);

        const filteredInbound = useMemo(() => {
            return filterShuttleSchedule(
                YONSEI_SHUTTLE_SCHEDULE.inbound_to_campus,
                dayFilter,
                searchQuery
            );
        }, [dayFilter, searchQuery]);

        const handleTabClick = (tab: ShuttleTab, targetEl?: HTMLElement) => {
            setActiveTab(tab);
            if (tab === "OUTBOUND" || tab === "INBOUND") {
                onDirectionModeChange(tab);
            }
            targetEl?.scrollIntoView({block: "nearest", inline: "nearest"});
        };

        const activeList = activeTab === "OUTBOUND" ? filteredOutbound : filteredInbound;
        const outboundWait = nextOutbound ? getShuttleWaitConfig(nextOutbound.waitMins) : null;
        const inboundWait = nextInbound ? getShuttleWaitConfig(nextInbound.waitMins) : null;

        return (
            <section
                id="shuttle-section"
                className="scroll-mt-20 rounded-3xl p-4 sm:p-6 bg-white dark:bg-[#111623] border border-slate-200/85 dark:border-white/10 shadow-xs space-y-5"
            >
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-[#003876] to-blue-700 text-white shadow-xs shrink-0">
                            <GraduationCap className="w-5 h-5"/>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                    {YONSEI_SHUTTLE_SCHEDULE.title}
                                </h2>
                                <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                                        dayType.isSaturday
                                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                                            : dayType.isSunday
                                                ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30"
                                                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                    }`}
                                >
                                    {dayType.label}
                                </span>
                            </div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                여주역 · 만종역 · 원주고속터미널 · 시청사거리 · 원주역 · 세브란스 ↔ 미래캠퍼스 (학생·교직원 무료)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Saturday No-Operation Notice */}
                {dayType.isSaturday && (
                    <div
                        className="p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 flex items-center gap-2.5 text-xs font-bold text-amber-800 dark:text-amber-200">
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0"/>
                        <span>
                            {UI_TEXT.YONSEI_SHUTTLE.SATURDAY_NO_RUN_DESC} (아래에서 평일·일요일 전체 시간표를 미리 확인할 수 있습니다)
                        </span>
                    </div>
                )}

                {/* Dual Next Shuttle Spotlight Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Outbound Spotlight */}
                    <button
                        type="button"
                        onClick={() => handleTabClick("OUTBOUND")}
                        className={`text-left p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] ${
                            directionMode === "OUTBOUND"
                                ? "bg-gradient-to-br from-blue-50/95 to-slate-50/80 dark:from-blue-950/40 dark:to-[#151c2e] border-[#003876] dark:border-blue-500 ring-2 ring-blue-500/20 shadow-xs"
                                : "bg-slate-50/80 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/10 hover:bg-blue-50/40 dark:hover:bg-blue-950/20"
                        }`}
                    >
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <span
                                className="flex items-center gap-1.5 text-xs font-black text-[#003876] dark:text-blue-300">
                                <Clock className="w-3.5 h-3.5 shrink-0"/>
                                <span>{UI_TEXT.YONSEI_SHUTTLE.NEXT_FROM_CAMPUS}</span>
                            </span>
                            {outboundWait && (
                                <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] border tabular-nums ${outboundWait.pillClass}`}
                                >
                                    {outboundWait.dotClass && (
                                        <span className="relative flex h-1.5 w-1.5">
                                            <span
                                                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${outboundWait.dotClass}`}
                                            />
                                            <span
                                                className={`relative inline-flex rounded-full h-1.5 w-1.5 ${outboundWait.dotClass}`}
                                            />
                                        </span>
                                    )}
                                    <span>{outboundWait.label}</span>
                                </span>
                            )}
                        </div>

                        {nextOutbound ? (
                            <div className="space-y-1.5">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span
                                        className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white">
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
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 py-2">
                                {dayType.isSaturday
                                    ? "토요일은 셔틀 운행이 없습니다"
                                    : "금일 하교 셔틀 운행이 종료되었습니다"}
                            </p>
                        )}
                    </button>

                    {/* Inbound Spotlight */}
                    <button
                        type="button"
                        onClick={() => handleTabClick("INBOUND")}
                        className={`text-left p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] ${
                            directionMode === "INBOUND"
                                ? "bg-gradient-to-br from-indigo-50/95 to-slate-50/80 dark:from-indigo-950/40 dark:to-[#151c2e] border-indigo-600 dark:border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs"
                                : "bg-slate-50/80 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/10 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20"
                        }`}
                    >
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <span
                                className="flex items-center gap-1.5 text-xs font-black text-indigo-700 dark:text-indigo-300">
                                <Bus className="w-3.5 h-3.5 shrink-0"/>
                                <span>{UI_TEXT.YONSEI_SHUTTLE.NEXT_TO_CAMPUS}</span>
                            </span>
                            {inboundWait && (
                                <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] border tabular-nums ${inboundWait.pillClass}`}
                                >
                                    {inboundWait.dotClass && (
                                        <span className="relative flex h-1.5 w-1.5">
                                            <span
                                                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${inboundWait.dotClass}`}
                                            />
                                            <span
                                                className={`relative inline-flex rounded-full h-1.5 w-1.5 ${inboundWait.dotClass}`}
                                            />
                                        </span>
                                    )}
                                    <span>{inboundWait.label}</span>
                                </span>
                            )}
                        </div>

                        {nextInbound ? (
                            <div className="space-y-1.5">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span
                                        className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white">
                                        {nextInbound.item.departure_time}
                                    </span>
                                    <span
                                        className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300 truncate">
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
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 py-2">
                                {dayType.isSaturday
                                    ? "토요일은 셔틀 운행이 없습니다"
                                    : "금일 등교 셔틀 운행이 종료되었습니다"}
                            </p>
                        )}
                    </button>
                </div>

                {/* Tabs & Search Controls */}
                <div
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-200/70 dark:border-white/[0.07]">
                    {/* Single-row scrollable tablist */}
                    <div
                        role="tablist"
                        aria-label="셔틀버스 시간표 탭"
                        className="flex items-center gap-1 rounded-2xl bg-slate-100 dark:bg-white/[0.05] p-1 overflow-x-auto no-scrollbar shrink-0"
                    >
                        <button
                            id={`${tabBaseId}-outbound`}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === "OUTBOUND"}
                            onClick={(e) => handleTabClick("OUTBOUND", e.currentTarget)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer whitespace-nowrap flex-none ${
                                activeTab === "OUTBOUND"
                                    ? "bg-[#003876] text-white shadow-xs border-b-2 border-blue-300"
                                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            하교 시간표 (캠퍼스 → 시내/역)
                        </button>
                        <button
                            id={`${tabBaseId}-inbound`}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === "INBOUND"}
                            onClick={(e) => handleTabClick("INBOUND", e.currentTarget)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer whitespace-nowrap flex-none ${
                                activeTab === "INBOUND"
                                    ? "bg-indigo-600 text-white shadow-xs border-b-2 border-indigo-300"
                                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            등교 시간표 (시내/역 → 캠퍼스)
                        </button>
                        <button
                            id={`${tabBaseId}-guidelines`}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === "GUIDELINES"}
                            onClick={(e) => handleTabClick("GUIDELINES", e.currentTarget)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer whitespace-nowrap flex-none ${
                                activeTab === "GUIDELINES"
                                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs border-b-2 border-slate-400 dark:border-slate-500"
                                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            {UI_TEXT.YONSEI_SHUTTLE.USAGE_GUIDE_TAB}
                        </button>
                    </div>

                    {/* Day Filter + Search */}
                    {activeTab !== "GUIDELINES" && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <div className="flex items-center gap-1 shrink-0">
                                {(
                                    [
                                        {id: "ALL", label: UI_TEXT.YONSEI_SHUTTLE.FILTER_ALL},
                                        {id: "WEEKDAY", label: UI_TEXT.YONSEI_SHUTTLE.FILTER_WEEKDAY},
                                        {id: "SUNDAY", label: UI_TEXT.YONSEI_SHUTTLE.FILTER_SUNDAY},
                                    ] as const
                                ).map((chip) => (
                                    <button
                                        key={chip.id}
                                        type="button"
                                        onClick={() => setDayFilter(chip.id)}
                                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black border transition-colors cursor-pointer whitespace-nowrap ${
                                            dayFilter === chip.id
                                                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xs"
                                                : "bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                                        }`}
                                    >
                                        {chip.label}
                                    </button>
                                ))}
                            </div>

                            <div className="relative flex-1 sm:w-64">
                                <Search
                                    className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                <input
                                    id="yonsei-shuttle-search"
                                    name="yonsei-shuttle-search"
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={UI_TEXT.YONSEI_SHUTTLE.SEARCH_PLACEHOLDER}
                                    aria-label={UI_TEXT.YONSEI_SHUTTLE.SEARCH_PLACEHOLDER}
                                    className="w-full pl-8 pr-8 py-1.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery("")}
                                        aria-label="검색어 지우기"
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5"/>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Tab Panel Content */}
                <div
                    role="tabpanel"
                    aria-labelledby={
                        activeTab === "OUTBOUND"
                            ? `${tabBaseId}-outbound`
                            : activeTab === "INBOUND"
                                ? `${tabBaseId}-inbound`
                                : `${tabBaseId}-guidelines`
                    }
                >
                    {activeTab === "GUIDELINES" ? (
                        <div
                            className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 space-y-3">
                            <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0"/>
                                <span>{UI_TEXT.YONSEI_SHUTTLE.GUIDELINES_TITLE}</span>
                            </div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {UI_TEXT.YONSEI_SHUTTLE.GUIDELINES_DESC}
                            </p>
                            <ul className="space-y-2.5 pt-1">
                                {YONSEI_SHUTTLE_SCHEDULE.guidelines.map((line, idx) => (
                                    <li
                                        key={idx}
                                        className="flex items-start gap-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 leading-relaxed"
                                    >
                                        <span
                                            className="w-5 h-5 rounded-full bg-[#003876]/10 dark:bg-blue-500/15 text-[#003876] dark:text-blue-300 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                                            {idx + 1}
                                        </span>
                                        <span>{line}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : activeList.length === 0 ? (
                        <div className="py-12 text-center text-xs font-bold text-slate-400 dark:text-slate-500">
                            {activeTab === "INBOUND"
                                ? UI_TEXT.YONSEI_SHUTTLE.EMPTY_TO_CAMPUS
                                : UI_TEXT.YONSEI_SHUTTLE.EMPTY_FROM_CAMPUS}
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            <div
                                className="flex items-center justify-between px-1 text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
                                <span>
                                    {activeTab === "OUTBOUND"
                                        ? "미래관 출발 하교 셔틀 목록"
                                        : "시내·기차역 출발 등교 셔틀 목록"}
                                </span>
                                <span className="tabular-nums">
                                    {UI_TEXT.YONSEI_SHUTTLE.TOTAL_RUNS(activeList.length)}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {activeList.map((item, idx) => {
                                    const isSundayItem = item.operation_type.includes("일요일");
                                    const isNext =
                                        activeTab === "OUTBOUND"
                                            ? nextOutbound?.item.departure_time === item.departure_time &&
                                            nextOutbound.item.destination ===
                                            (item as ShuttleOutboundItem).destination
                                            : nextInbound?.item.departure_time === item.departure_time &&
                                            nextInbound.item.departure_point ===
                                            (item as ShuttleInboundItem).departure_point;

                                    return (
                                        <div
                                            key={`${activeTab}-${item.departure_time}-${item.departure_point}-${idx}`}
                                            className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 ${
                                                isNext
                                                    ? "bg-blue-50/90 dark:bg-blue-950/35 border-blue-500/60 ring-1 ring-blue-500/30 shadow-xs"
                                                    : "bg-slate-50/80 dark:bg-white/[0.03] border-slate-200/70 dark:border-white/[0.08]"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-baseline gap-2.5 min-w-0">
                                                    <span
                                                        className="text-lg sm:text-xl font-black tabular-nums text-[#003876] dark:text-blue-300 shrink-0">
                                                        {item.departure_time}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <div
                                                            className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                                                            {activeTab === "OUTBOUND"
                                                                ? `${item.departure_point} → ${item.destination}`
                                                                : `${item.departure_point} 발 → ${item.destination}`}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1 shrink-0">
                                                    {isNext && (
                                                        <span
                                                            className="px-2 py-0.5 rounded-md text-[10px] font-black bg-[#003876] dark:bg-blue-600 text-white">
                                                            {UI_TEXT.YONSEI_SHUTTLE.NEXT_BUS}
                                                        </span>
                                                    )}
                                                    <span
                                                        className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                                                            isSundayItem
                                                                ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30"
                                                                : "bg-white dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-transparent"
                                                        }`}
                                                    >
                                                        {item.operation_type}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Via stops */}
                                            <div
                                                className="flex flex-wrap items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                                                {item.via.length > 0 ? (
                                                    <>
                                                        <span className="font-bold text-slate-400 mr-0.5">
                                                            경유:
                                                        </span>
                                                        {item.via.map((v, vIdx) => (
                                                            <React.Fragment key={`${v.name}-${vIdx}`}>
                                                                <span
                                                                    className="px-1.5 py-0.5 rounded-md bg-white dark:bg-white/[0.08] border border-slate-200/70 dark:border-white/10 font-semibold">
                                                                    {v.name}
                                                                    {v.time && (
                                                                        <span
                                                                            className="ml-1 font-black tabular-nums text-[#003876] dark:text-blue-400">
                                                                            {v.time}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                {vIdx < item.via.length - 1 && (
                                                                    <span className="text-slate-400">→</span>
                                                                )}
                                                            </React.Fragment>
                                                        ))}
                                                    </>
                                                ) : (
                                                    <span className="text-slate-500 dark:text-slate-400 font-semibold">
                                                        {UI_TEXT.YONSEI_SHUTTLE.NO_VIA_EXPRESS}
                                                    </span>
                                                )}
                                            </div>

                                            {item.note && (
                                                <div
                                                    className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1">
                                                    ※ {item.note}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </section>
        );
    }
);

YonseiShuttleSection.displayName = "YonseiShuttleSection";
