"use client";

import React from "react";
import {Bus, Megaphone, MessageSquare} from "lucide-react";

import {DayMode} from "@/types/bus";
import {ThemeToggle} from "./ThemeToggle";

interface HeaderProps {
    dayMode: DayMode;
    onDayModeChange: (mode: DayMode) => void;
    isTodayWeekendOrHoliday: boolean;
    onOpenNoticeModal: () => void;
    onOpenCommentsModal: () => void;
    commentCount: number;
}

export const Header: React.FC<HeaderProps> = ({
                                                  dayMode,
                                                  onDayModeChange,
                                                  isTodayWeekendOrHoliday,
                                                  onOpenNoticeModal,
                                                  onOpenCommentsModal,
                                                  commentCount,
                                              }) => {
    return (
        <header className="w-full mb-6 select-none">
            <div
                className="backdrop-blur-2xl bg-white/75 dark:bg-[#111622]/80 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-wrap items-center justify-between gap-3">
                {/* Left: Branding */}
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-2xl bg-[#003876] text-white flex items-center justify-center shadow-md shadow-blue-900/20 shrink-0">
                        <Bus className="w-5 h-5"/>
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span
                                className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none">
                                wBus
                            </span>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                            30 · 34 · 34-1 시내버스 시간표
                        </p>
                    </div>
                </div>

                {/* Right: Day Mode Switcher, Quick Notice, Talk & Theme Toggle */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Day Mode Switcher */}
                    <div
                        className="inline-flex p-0.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-[11px] font-bold">
                        <button
                            type="button"
                            onClick={() => onDayModeChange("AUTO")}
                            className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                                dayMode === "AUTO"
                                    ? "bg-blue-600 text-white shadow-xs font-black"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                            title={`자동 감지 (${isTodayWeekendOrHoliday ? "휴일" : "평일"})`}
                        >
                            자동
                        </button>
                        <button
                            type="button"
                            onClick={() => onDayModeChange("WEEKDAY")}
                            className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                                dayMode === "WEEKDAY"
                                    ? "bg-amber-600 text-white shadow-xs font-black"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                            title="평일 시간표"
                        >
                            평일
                        </button>
                        <button
                            type="button"
                            onClick={() => onDayModeChange("VACATION")}
                            className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                                dayMode === "VACATION"
                                    ? "bg-indigo-600 text-white shadow-xs font-black"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                            title="방학/휴일 시간표"
                        >
                            방학·휴일
                        </button>
                    </div>

                    {/* Quick Notice Modal Trigger */}
                    <button
                        type="button"
                        onClick={onOpenNoticeModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/25 text-xs font-black transition-all cursor-pointer active:scale-95 shadow-2xs"
                        title="원주시 교통정보센터 공지사항"
                    >
                        <Megaphone className="w-3.5 h-3.5"/>
                        <span className="hidden md:inline">교통 공지</span>
                    </button>

                    {/* Quick Realtime Talk Trigger */}
                    <button
                        type="button"
                        onClick={onOpenCommentsModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/25 text-xs font-black transition-all cursor-pointer active:scale-95 shadow-2xs"
                        title="실시간 버스 톡 & 메모"
                    >
                        <MessageSquare className="w-3.5 h-3.5"/>
                        <span>실시간 톡</span>
                        {commentCount > 0 && (
                            <span
                                className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-black shadow-2xs">
                                {commentCount}
                            </span>
                        )}
                    </button>

                    {/* Dark/Light Theme Toggle */}
                    <ThemeToggle/>
                </div>
            </div>
        </header>
    );
};
