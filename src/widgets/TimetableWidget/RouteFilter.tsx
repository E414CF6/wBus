"use client";

import React from "react";
import {UI_TEXT} from "@shared/config/locale";
import {Filter, Layers, Search, Star, X} from "lucide-react";

interface RouteFilterProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    selectedDayType: string;
    setSelectedDayType: (dayType: string) => void;
    selectedCategory: string;
    setSelectedCategory: (category: string) => void;
    showOnlyBookmarks: boolean;
    setShowOnlyBookmarks: (show: boolean) => void;
    bookmarkCount: number;
    totalFilteredCount: number;
}

const DAY_TYPES = [
    {id: "ALL", label: UI_TEXT.TIMETABLE.DAY_ALL},
    {id: "평일", label: UI_TEXT.TIMETABLE.DAY_WEEKDAY},
    {id: "토요일", label: UI_TEXT.TIMETABLE.DAY_SATURDAY},
    {id: "일,공휴일", label: UI_TEXT.TIMETABLE.DAY_SUN_HOLIDAY},
    {id: "방학,휴일", label: UI_TEXT.TIMETABLE.DAY_VACATION_HOLIDAY},
    {id: "주말,공휴일", label: UI_TEXT.TIMETABLE.DAY_WEEKEND_HOLIDAY},
];

const QUICK_CATEGORIES = [
    {id: "ALL", label: UI_TEXT.TIMETABLE.CAT_ALL, icon: "🚌"},
    {id: "2", label: UI_TEXT.TIMETABLE.CAT_2, icon: "🏞️"},
    {id: "3", label: UI_TEXT.TIMETABLE.CAT_3_4, icon: "🚏"},
    {id: "6", label: UI_TEXT.TIMETABLE.CAT_6_7_8, icon: "🏙️"},
    {id: "16", label: UI_TEXT.TIMETABLE.CAT_16, icon: "🔄"},
    {id: "30", label: UI_TEXT.TIMETABLE.CAT_30, icon: "🎓"},
    {id: "41", label: UI_TEXT.TIMETABLE.CAT_41, icon: "🌲"},
    {id: "50", label: UI_TEXT.TIMETABLE.CAT_50, icon: "🏭"},
];

export const RouteFilter: React.FC<RouteFilterProps> = ({
                                                            searchQuery,
                                                            setSearchQuery,
                                                            selectedDayType,
                                                            setSelectedDayType,
                                                            selectedCategory,
                                                            setSelectedCategory,
                                                            showOnlyBookmarks,
                                                            setShowOnlyBookmarks,
                                                            bookmarkCount,
                                                            totalFilteredCount,
                                                        }) => {
    const isFilteredActive =
        Boolean(searchQuery) || selectedDayType !== "ALL" || selectedCategory !== "ALL" || showOnlyBookmarks;

    return (
        <div className="space-y-4 mb-6">
            {/* Top Bar: Search Input & Bookmark Toggle */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Glass Search Input */}
                <div className="relative flex-1 group">
                    <div
                        className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors"
                    >
                        <Search className="h-4 w-4 stroke-[2.4]"/>
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={UI_TEXT.TIMETABLE.SEARCH_PLACEHOLDER}
                        className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white/80 dark:bg-[#121212]/80 border border-black/5 dark:border-white/10 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm font-medium transition-all shadow-xs backdrop-blur-2xl focus:outline-none"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            aria-label={UI_TEXT.TIMETABLE.CLEAR_SEARCH_ARIA}
                        >
                            <X className="h-4 w-4"/>
                        </button>
                    )}
                </div>

                {/* Bookmark Filter Toggle */}
                <button
                    onClick={() => setShowOnlyBookmarks(!showOnlyBookmarks)}
                    className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all shrink-0 border cursor-pointer active:scale-95 ${
                        showOnlyBookmarks
                            ? "bg-amber-500/15 dark:bg-amber-500/25 text-amber-700 dark:text-amber-300 border-amber-500/40 shadow-md shadow-amber-500/10"
                            : "bg-white/80 dark:bg-[#121212]/80 text-slate-700 dark:text-slate-300 border-black/5 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.08] backdrop-blur-2xl shadow-xs"
                    }`}
                >
                    <Star
                        className={`h-4 w-4 stroke-[2.4] ${
                            showOnlyBookmarks ? "fill-amber-400 text-amber-500 dark:text-amber-400" : ""
                        }`}
                    />
                    <span>{UI_TEXT.TIMETABLE.STATS_BOOKMARKS}</span>
                    <span
                        className={`ml-1 text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                            showOnlyBookmarks
                                ? "bg-amber-500/20 text-amber-800 dark:text-amber-200"
                                : "bg-black/[0.04] dark:bg-white/[0.08] text-slate-700 dark:text-slate-300"
                        }`}
                    >
            {bookmarkCount}
          </span>
                </button>
            </div>

            {/* Filter Drawer Card */}
            <div
                className="backdrop-blur-2xl bg-white/70 dark:bg-[#121212]/70 p-4 rounded-2xl space-y-3.5 border border-black/5 dark:border-white/10 shadow-xs">
                {/* 1. Operating Day Types */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          <span
              className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0 mr-1 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 stroke-[2.4]"/> {UI_TEXT.TIMETABLE.RUN_DAY}:
          </span>
                    {DAY_TYPES.map((dt) => (
                        <button
                            key={dt.id}
                            onClick={() => setSelectedDayType(dt.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                                selectedDayType === dt.id
                                    ? "bg-black dark:bg-white text-white dark:text-black shadow-md shadow-black/10 dark:shadow-white/10 scale-[1.02]"
                                    : "bg-black/[0.03] dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] border border-black/5 dark:border-white/5"
                            }`}
                        >
                            {dt.label}
                        </button>
                    ))}
                </div>

                {/* 2. Quick Route Categories */}
                <div
                    className="flex items-center gap-1.5 overflow-x-auto pt-2.5 border-t border-black/5 dark:border-white/5 custom-scrollbar">
          <span
              className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0 mr-1 flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400 stroke-[2.4]"/> {UI_TEXT.TIMETABLE.MAIN_ROUTES_LABEL}
          </span>
                    {QUICK_CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                                selectedCategory === cat.id
                                    ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-md shadow-indigo-600/20"
                                    : "bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-black/5 dark:border-white/5"
                            }`}
                        >
                            <span className="text-[13px]">{cat.icon}</span>
                            <span>{cat.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Filter Summary Footer */}
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 pt-1">
        <span className="font-medium">
          {UI_TEXT.TIMETABLE.SEARCH_RESULTS_LABEL} <strong className="text-slate-900 dark:text-white font-mono font-bold">{totalFilteredCount}</strong>{UI_TEXT.TIMETABLE.ROUTE_COUNT(totalFilteredCount).replace(/^[0-9]+/, "")}
        </span>

                {isFilteredActive && (
                    <button
                        onClick={() => {
                            setSearchQuery("");
                            setSelectedDayType("ALL");
                            setSelectedCategory("ALL");
                            setShowOnlyBookmarks(false);
                        }}
                        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-500 font-bold cursor-pointer transition-colors"
                    >
                        <X className="h-3.5 w-3.5"/>
                        <span>{UI_TEXT.TIMETABLE.RESET_FILTER}</span>
                    </button>
                )}
            </div>
        </div>
    );
};
