"use client";

import React, {useId, useMemo, useRef, useState} from "react";
import {AlertCircle, GraduationCap, Info, Search, X} from "lucide-react";

import {type ShuttleInboundItem, type ShuttleOutboundItem, YONSEI_SHUTTLE_SCHEDULE} from "@entities/schedule";
import {UI_TEXT} from "@shared/config/locale";
import {useDialogModal} from "@shared/lib/useDialogModal";
import type {DayMode} from "@shared/types/navigation";
import {filterShuttleSchedule, getNextShuttleDepartures, type ShuttleDayFilter,} from "../lib/yonseiShuttleUtils";

export interface ShuttleTimetableModalProps {
    isOpen: boolean;
    initialTab: "OUTBOUND" | "INBOUND" | "GUIDELINES";
    dayMode: DayMode;
    now: Date;
    onClose: () => void;
}

type ShuttleTab = "OUTBOUND" | "INBOUND" | "GUIDELINES";

export const ShuttleTimetableModal: React.FC<ShuttleTimetableModalProps> = ({
                                                                                isOpen,
                                                                                initialTab,
                                                                                dayMode,
                                                                                now,
                                                                                onClose,
                                                                            }) => {
    const [activeTab, setActiveTab] = useState<ShuttleTab>(initialTab);
    const [dayFilter, setDayFilter] = useState<ShuttleDayFilter>("ALL");
    const [searchQuery, setSearchQuery] = useState("");

    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const tabBaseId = useId();

    useDialogModal(dialogRef, isOpen);

    const {dayType, nextInbound, nextOutbound} = useMemo(
        () => getNextShuttleDepartures(YONSEI_SHUTTLE_SCHEDULE, dayMode, now),
        [dayMode, now]
    );

    const filteredOutbound = useMemo(
        () => filterShuttleSchedule(YONSEI_SHUTTLE_SCHEDULE.outbound_from_campus, dayFilter, searchQuery),
        [dayFilter, searchQuery]
    );

    const filteredInbound = useMemo(
        () => filterShuttleSchedule(YONSEI_SHUTTLE_SCHEDULE.inbound_to_campus, dayFilter, searchQuery),
        [dayFilter, searchQuery]
    );

    const activeList = activeTab === "OUTBOUND" ? filteredOutbound : filteredInbound;

    return (
        <dialog
            ref={dialogRef}
            {...({closedby: "any"} as Record<string, unknown>)}
            onClose={onClose}
            aria-labelledby={titleId}
            className="m-auto w-full sm:max-w-2xl max-h-[90dvh] open:flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#111623] text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden p-0 mb-0 sm:mb-auto"
        >
            {/* Modal Header */}
            <div
                className="px-4 sm:px-6 pt-4 pb-3.5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] space-y-3 shrink-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                        <span
                            className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#003876] to-blue-700 text-white flex items-center justify-center shadow-xs shrink-0">
                            <GraduationCap className="w-4 h-4"/>
                        </span>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3
                                    id={titleId}
                                    className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate"
                                >
                                    {YONSEI_SHUTTLE_SCHEDULE.title}
                                </h3>
                                <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
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
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                여주역 · 만종역 · 원주고속터미널 · 시청사거리 · 원주역 · 세브란스 ↔ 미래캠퍼스
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={UI_TEXT.ACCESSIBILITY.CLOSE_MODAL}
                        className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-300/80 dark:hover:bg-white/20 transition-colors shrink-0 cursor-pointer"
                    >
                        <X className="w-4 h-4"/>
                    </button>
                </div>

                {/* Saturday Notice */}
                {dayType.isSaturday && (
                    <div
                        className="p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 flex items-center gap-2 text-[11px] font-bold text-amber-800 dark:text-amber-200">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0"/>
                        <span>{UI_TEXT.YONSEI_SHUTTLE.SATURDAY_NO_RUN_DESC} (평일·일요일 전체 시간표 열람 가능)</span>
                    </div>
                )}

                {/* Single-row Tabs */}
                <div
                    role="tablist"
                    aria-label="셔틀버스 시간표 탭"
                    className="flex items-center gap-1 rounded-xl bg-slate-200/60 dark:bg-white/[0.06] p-1 overflow-x-auto no-scrollbar"
                >
                    <button
                        id={`${tabBaseId}-outbound`}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "OUTBOUND"}
                        onClick={(e) => {
                            setActiveTab("OUTBOUND");
                            e.currentTarget.scrollIntoView({block: "nearest", inline: "nearest"});
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer whitespace-nowrap flex-none ${
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
                        onClick={(e) => {
                            setActiveTab("INBOUND");
                            e.currentTarget.scrollIntoView({block: "nearest", inline: "nearest"});
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer whitespace-nowrap flex-none ${
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
                        onClick={(e) => {
                            setActiveTab("GUIDELINES");
                            e.currentTarget.scrollIntoView({block: "nearest", inline: "nearest"});
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer whitespace-nowrap flex-none ${
                            activeTab === "GUIDELINES"
                                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs border-b-2 border-slate-400"
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
                                            : "bg-white dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10"
                                    }`}
                                >
                                    {chip.label}
                                </button>
                            ))}
                        </div>

                        <div className="relative flex-1">
                            <Search
                                className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={UI_TEXT.YONSEI_SHUTTLE.SEARCH_PLACEHOLDER}
                                aria-label={UI_TEXT.YONSEI_SHUTTLE.SEARCH_PLACEHOLDER}
                                className="w-full pl-8 pr-8 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
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

            {/* Body */}
            <div
                role="tabpanel"
                aria-labelledby={
                    activeTab === "OUTBOUND"
                        ? `${tabBaseId}-outbound`
                        : activeTab === "INBOUND"
                            ? `${tabBaseId}-inbound`
                            : `${tabBaseId}-guidelines`
                }
                className="flex-1 overflow-y-auto px-4 sm:px-6 py-4"
            >
                {activeTab === "GUIDELINES" ? (
                    <div
                        className="p-4 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 space-y-3">
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
                    <div className="py-14 text-center text-xs font-bold text-slate-400 dark:text-slate-500">
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

                        <div className="grid grid-cols-1 gap-2.5">
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
                                        className={`p-3.5 rounded-2xl border flex flex-col gap-2 ${
                                            isNext
                                                ? "bg-blue-50/90 dark:bg-blue-950/35 border-blue-500/60 ring-1 ring-blue-500/30 shadow-xs"
                                                : "bg-slate-50/80 dark:bg-white/[0.03] border-slate-200/70 dark:border-white/[0.08]"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-baseline gap-2.5 min-w-0">
                                                <span
                                                    className="text-lg font-black tabular-nums text-[#003876] dark:text-blue-300 shrink-0">
                                                    {item.departure_time}
                                                </span>
                                                <span
                                                    className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                                                    {activeTab === "OUTBOUND"
                                                        ? `${item.departure_point} → ${item.destination}`
                                                        : `${item.departure_point} 발 → ${item.destination}`}
                                                </span>
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

                                        <div
                                            className="flex flex-wrap items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                                            {item.via.length > 0 ? (
                                                <>
                                                    <span className="font-bold text-slate-400 mr-0.5">경유:</span>
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
        </dialog>
    );
};
