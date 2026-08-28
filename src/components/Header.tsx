"use client";

import React from "react";
import {Clock, GraduationCap} from "lucide-react";
import {DayMode} from "@/types/bus";
import {ThemeToggle} from "./ThemeToggle";

interface HeaderProps {
    dayMode: DayMode;
    onDayModeChange: (mode: DayMode) => void;
    isTodayWeekendOrHoliday: boolean;
    currentTime: Date;
}

export const Header: React.FC<HeaderProps> = ({
                                                  dayMode,
                                                  onDayModeChange,
                                                  isTodayWeekendOrHoliday,
                                                  currentTime,
                                              }) => {
    const timeFormatted = currentTime.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    return (
        <header className="w-full mb-6">
            {/* Top Bar: Yonsei Mirae Campus Branding & Day Mode / Clock / Theme */}
            <div
                className="backdrop-blur-2xl bg-gradient-to-br from-blue-900/15 via-indigo-900/10 to-slate-900/10 dark:from-blue-950/60 dark:via-indigo-950/40 dark:to-slate-900/60 rounded-3xl p-4 sm:p-6 border border-blue-500/20 shadow-sm relative overflow-hidden">
                {/* Glow decoration */}
                <div
                    className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"/>

                <div className="relative z-10">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                        {/* Yonsei Badge */}
                        <div
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black bg-[#003876] text-white shadow-sm ring-1 ring-white/10">
                            <GraduationCap className="w-4 h-4 text-blue-200"/>
                            <span>연세대학교 미래캠퍼스</span>
                        </div>

                        {/* Right Group: Compact Day Mode Pill, Live Clock & Theme Toggle */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Compact Day Mode Switcher (자동 / 평일 / 방학·휴일) */}
                            <div
                                className="inline-flex p-0.5 rounded-2xl bg-white/85 dark:bg-[#141824]/90 text-[10px] sm:text-[11px] font-black border border-slate-200/80 dark:border-white/10 shadow-2xs">
                                <button
                                    type="button"
                                    onClick={() => onDayModeChange("AUTO")}
                                    className={`px-2 sm:px-2.5 py-1 rounded-xl transition-all active:scale-95 cursor-pointer ${
                                        dayMode === "AUTO"
                                            ? "bg-blue-600 text-white shadow-xs font-black"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                    }`}
                                    title={`오늘 요일 기준 자동 감지 (${isTodayWeekendOrHoliday ? "휴일" : "평일"})`}
                                >
                                    자동
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDayModeChange("WEEKDAY")}
                                    className={`px-2 sm:px-2.5 py-1 rounded-xl transition-all active:scale-95 cursor-pointer ${
                                        dayMode === "WEEKDAY"
                                            ? "bg-amber-600 text-white shadow-xs font-black"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                    }`}
                                    title="평일 운행 시간표"
                                >
                                    평일
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDayModeChange("VACATION")}
                                    className={`px-2 sm:px-2.5 py-1 rounded-xl transition-all active:scale-95 cursor-pointer ${
                                        dayMode === "VACATION"
                                            ? "bg-indigo-600 text-white shadow-xs font-black"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                    }`}
                                    title="방학 및 주말/공휴일 시간표"
                                >
                                    방학·휴일
                                </button>
                            </div>

                            {/* Live Clock */}
                            <div
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-white/80 dark:bg-white/5 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 shadow-2xs">
                                <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-pulse"/>
                                <span suppressHydrationWarning>{timeFormatted}</span>
                            </div>

                            {/* Theme Toggle */}
                            <ThemeToggle/>
                        </div>
                    </div>

                    {/* Title & Subtitle */}
                    <div className="mt-2">
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                            시내버스 시간표
                        </h1>
                        <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mt-1 max-w-xl flex items-center gap-1.5">
                            <span>
                                <strong>30, 34, 34-1</strong>번 버스 운행 시간표
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        </header>
    );
};
