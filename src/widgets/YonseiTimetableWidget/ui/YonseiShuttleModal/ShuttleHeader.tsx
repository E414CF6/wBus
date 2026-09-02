"use client";

import {YONSEI_SHUTTLE_SCHEDULE} from "@/data/yonseiShuttleSchedule";
import {ArrowRight, Bus, Clock, Info, MapPin, Search, X} from "lucide-react";
import React from "react";
import type {DayFilter, ShuttleTab} from "../../types";

interface ShuttleHeaderProps {
    activeTab: ShuttleTab;
    onTabChange: (tab: ShuttleTab) => void;
    dayFilter: DayFilter;
    onDayFilterChange: (filter: DayFilter) => void;
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    filteredCount: number;
    onClose: () => void;
}

export const ShuttleHeader: React.FC<ShuttleHeaderProps> = ({
                                                                activeTab,
                                                                onTabChange,
                                                                dayFilter,
                                                                onDayFilterChange,
                                                                searchQuery,
                                                                onSearchQueryChange,
                                                                filteredCount,
                                                                onClose,
                                                            }) => {
    const isScheduleTab = activeTab === "inbound" || activeTab === "outbound";

    return (
        <>
            {/* Header */}
            <div
                className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.03] flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div
                        className="px-3 sm:px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 text-white font-black text-sm sm:text-base tracking-tight shadow-md shadow-teal-700/20 shrink-0 flex items-center gap-1.5">
                        <Bus className="w-4 h-4 shrink-0"/>
                        <span className="whitespace-nowrap">셔틀버스</span>
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                            {YONSEI_SHUTTLE_SCHEDULE.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                            연세대학교 미래캠퍼스 셔틀버스
                        </p>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer active:scale-95 shrink-0"
                >
                    <X className="h-4 w-4"/>
                </button>
            </div>

            {/* Sub Tab Navigation */}
            <div
                className="px-3 sm:px-6 pt-3 pb-2 border-b border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-[#111622]/50 flex flex-wrap items-center justify-between gap-2 shrink-0">
                {/* Tabs */}
                <div
                    className="flex items-center gap-1 sm:gap-1.5 bg-slate-100 dark:bg-white/[0.06] p-1 rounded-2xl max-w-full overflow-x-auto custom-scrollbar-hidden shrink-0">
                    <button
                        onClick={() => onTabChange("inbound")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                            activeTab === "inbound"
                                ? "bg-teal-600 text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                    >
                        <ArrowRight className="w-3.5 h-3.5 rotate-45 shrink-0"/>
                        <span className="whitespace-nowrap">등교</span>
                        <span className="text-[10px] opacity-80 font-mono">17</span>
                    </button>
                    <button
                        onClick={() => onTabChange("outbound")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                            activeTab === "outbound"
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                    >
                        <ArrowRight className="w-3.5 h-3.5 -rotate-45 shrink-0"/>
                        <span className="whitespace-nowrap">하교</span>
                        <span className="text-[10px] opacity-80 font-mono">12</span>
                    </button>
                    <button
                        onClick={() => onTabChange("stops")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                            activeTab === "stops"
                                ? "bg-blue-600 text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                    >
                        <MapPin className="w-3.5 h-3.5 shrink-0"/>
                        <span className="whitespace-nowrap">탑승 장소</span>
                    </button>
                    <button
                        onClick={() => onTabChange("guidelines")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                            activeTab === "guidelines"
                                ? "bg-amber-600 text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                    >
                        <Info className="w-3.5 h-3.5 shrink-0"/>
                        <span className="whitespace-nowrap">이용 안내</span>
                    </button>
                </div>

                {/* Day Filter Pills */}
                {isScheduleTab && (
                    <div
                        className="flex items-center gap-1 text-[11px] font-bold shrink-0 overflow-x-auto custom-scrollbar-hidden max-w-full">
                        <button
                            onClick={() => onDayFilterChange("ALL")}
                            className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                                dayFilter === "ALL"
                                    ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-500/40 font-black"
                                    : "bg-slate-50 dark:bg-white/[0.03] text-slate-500 border-slate-200 dark:border-white/5"
                            }`}
                        >
                            전체
                        </button>
                        <button
                            onClick={() => onDayFilterChange("WEEKDAY")}
                            className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                                dayFilter === "WEEKDAY"
                                    ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-500/40 font-black"
                                    : "bg-slate-50 dark:bg-white/[0.03] text-slate-500 border-slate-200 dark:border-white/5"
                            }`}
                        >
                            평일 운행
                        </button>
                        <button
                            onClick={() => onDayFilterChange("SUNDAY")}
                            className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                                dayFilter === "SUNDAY"
                                    ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-500/40 font-black"
                                    : "bg-slate-50 dark:bg-white/[0.03] text-slate-500 border-slate-200 dark:border-white/5"
                            }`}
                        >
                            일요일 특별편
                        </button>
                    </div>
                )}
            </div>

            {/* Search Bar for Timetable Tabs */}
            {isScheduleTab && (
                <div
                    className="px-3 sm:px-6 py-2.5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-3 shrink-0">
                    <div className="relative flex-1">
                        <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => onSearchQueryChange(e.target.value)}
                            placeholder="정류장명 (여주역, 터미널, 원주역, 세브란스 등) 또는 시간 검색..."
                            className="w-full pl-8 pr-4 py-1.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-transparent focus:border-teal-500/50 text-xs font-semibold text-slate-900 dark:text-white outline-none transition-all"
                        />
                    </div>
                    <div className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400"/>
                        <span>총 {filteredCount}회 운행</span>
                    </div>
                </div>
            )}
        </>
    );
};
