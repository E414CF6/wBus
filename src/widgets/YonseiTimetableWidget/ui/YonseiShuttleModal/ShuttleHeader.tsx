"use client";

import React from "react";
import {Bus, Calendar, Check, Clock, HelpCircle, MapPin, Search, X} from "lucide-react";

import type {DayFilter, ShuttleTab} from "../../types";

interface ShuttleHeaderProps {
    activeTab: ShuttleTab;
    onTabChange: (tab: ShuttleTab) => void;
    dayFilter: DayFilter;
    onDayFilterChange: (filter: DayFilter) => void;
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    onClose: () => void;
}

export const ShuttleHeader: React.FC<ShuttleHeaderProps> = ({
                                                                activeTab,
                                                                onTabChange,
                                                                dayFilter,
                                                                onDayFilterChange,
                                                                searchQuery,
                                                                onSearchQueryChange,
                                                                onClose,
                                                            }) => {
    return (
        <div
            className="p-4 sm:p-6 border-b border-teal-500/20 dark:border-teal-500/20 flex flex-col gap-3 bg-white dark:bg-[#111622] shrink-0">
            {/* Top Row: Title + Close Button */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-teal-600 via-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-teal-700/20 shrink-0">
                        <Bus className="w-5 h-5"/>
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate flex items-center gap-2">
                            <span>연세대학교 미래캠퍼스 무료 셔틀버스</span>
                            <span
                                className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30">
                                2026/08/21
                            </span>
                        </h2>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                            여주역 · 만종역 · 원주고속터미널 · 원주역 · 시청사거리 · 세브란스 ↔ 연세대학교 미래캠퍼스
                        </p>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    title="닫기 (ESC)"
                >
                    <X className="w-4 h-4"/>
                </button>
            </div>

            {/* Navigation Tabs */}
            <div
                className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-white/[0.06] border border-black/5 dark:border-white/5 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => onTabChange("inbound")}
                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === "inbound"
                            ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-700/20"
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                >
                    <Clock className="w-3.5 h-3.5"/>
                    <span>등교</span>
                </button>

                <button
                    onClick={() => onTabChange("outbound")}
                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === "outbound"
                            ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-700/20"
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                >
                    <Clock className="w-3.5 h-3.5"/>
                    <span>하교</span>
                </button>

                <button
                    onClick={() => onTabChange("stops")}
                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === "stops"
                            ? "bg-gradient-to-r from-blue-600 to-teal-600 text-white shadow-md shadow-blue-600/20"
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                >
                    <MapPin className="w-3.5 h-3.5"/>
                    <span>정류장 지도</span>
                </button>

                <button
                    onClick={() => onTabChange("guidelines")}
                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === "guidelines"
                            ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-700/20"
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                >
                    <HelpCircle className="w-3.5 h-3.5"/>
                    <span>이용 안내</span>
                </button>
            </div>

            {/* Sub Filter / Search Bar (Only shown for schedule tabs) */}
            {(activeTab === "inbound" || activeTab === "outbound") && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                    {/* Day filter pills */}
                    <div className="flex items-center gap-1 flex-wrap text-xs">
                        <span
                            className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mr-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3"/>
                            운행일:
                        </span>
                        {(
                            [
                                {key: "ALL", label: "전체"},
                                {key: "WEEKDAY", label: "평일 (월~금)"},
                                {key: "SUNDAY", label: "일요일"},
                            ] as const
                        ).map((pill) => {
                            const isSelected = dayFilter === pill.key;
                            return (
                                <button
                                    key={pill.key}
                                    onClick={() => onDayFilterChange(pill.key)}
                                    className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                        isSelected
                                            ? "bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/40"
                                            : "bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/10 text-slate-600 dark:text-slate-400"
                                    }`}
                                >
                                    {isSelected && <Check className="w-3 h-3 text-teal-600 dark:text-teal-400"/>}
                                    <span>{pill.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Search filter input */}
                    <div className="relative min-w-[160px] sm:w-48">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input
                            type="text"
                            placeholder="출발지/경유지 검색..."
                            value={searchQuery}
                            onChange={(e) => onSearchQueryChange(e.target.value)}
                            className="w-full pl-8 pr-7 py-1 text-xs rounded-xl bg-slate-100 dark:bg-white/[0.05] border border-black/5 dark:border-white/5 focus:border-teal-500 focus:outline-hidden text-slate-900 dark:text-white placeholder-slate-400"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => onSearchQueryChange("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 cursor-pointer"
                            >
                                <X className="w-3 h-3"/>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
