"use client";

import React from "react";
import {Bus, GraduationCap, Sparkles} from "lucide-react";
import type {DayMode} from "@shared/types/navigation";

interface DayModeToggleGroupProps {
    dayMode: DayMode;
    onDayModeChange: (mode: DayMode) => void;
    isTodayWeekendOrHoliday: boolean;
}

export const DayModeToggleGroup: React.FC<DayModeToggleGroupProps> = ({
                                                                          dayMode,
                                                                          onDayModeChange,
                                                                          isTodayWeekendOrHoliday,
                                                                      }) => {
    return (
        <div className="flex items-center gap-1 shrink-0 animate-fadeIn">
            <button
                type="button"
                onClick={() => onDayModeChange("AUTO")}
                className={`flex items-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-full text-[11px] font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                    dayMode === "AUTO"
                        ? "bg-blue-600 text-white shadow-xs scale-[1.02]"
                        : "bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-300 border border-black/5 dark:border-white/10"
                }`}
                title={`자동 감지 (${isTodayWeekendOrHoliday ? "휴일" : "평일"})`}
            >
                <Sparkles className="w-3 h-3"/>
                <span className="whitespace-nowrap">자동</span>
            </button>

            <button
                type="button"
                onClick={() => onDayModeChange("WEEKDAY")}
                className={`flex items-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-full text-[11px] font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                    dayMode === "WEEKDAY"
                        ? "bg-amber-600 text-white shadow-xs scale-[1.02]"
                        : "bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-300 border border-black/5 dark:border-white/10"
                }`}
                title="평일 시간표"
            >
                <GraduationCap className="w-3 h-3"/>
                <span className="whitespace-nowrap">평일</span>
            </button>

            <button
                type="button"
                onClick={() => onDayModeChange("VACATION")}
                className={`flex items-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-full text-[11px] font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                    dayMode === "VACATION"
                        ? "bg-indigo-600 text-white shadow-xs scale-[1.02]"
                        : "bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-300 border border-black/5 dark:border-white/10"
                }`}
                title="방학·휴일 시간표"
            >
                <Bus className="w-3.5 h-3.5"/>
                <span className="whitespace-nowrap">방학·휴일</span>
            </button>
        </div>
    );
};
