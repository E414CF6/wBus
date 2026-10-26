"use client";

import React, {memo} from "react";
import {Sparkles} from "lucide-react";
import type {DayMode} from "@shared/types/navigation";

export interface DayModeToggleGroupProps {
    dayMode?: DayMode;
    onDayModeChange?: (mode: DayMode) => void;
    isTodayWeekendOrHoliday?: boolean;
}

export const DayModeToggleGroup = memo(function DayModeToggleGroup({
    dayMode = "AUTO",
    onDayModeChange,
    isTodayWeekendOrHoliday = false,
}: DayModeToggleGroupProps) {
    if (!onDayModeChange) return null;

    return (
        <div
            className="flex items-center p-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] border border-black/5 dark:border-white/10 shrink-0 select-none animate-fadeIn"
            role="group"
            aria-label="평일/휴일 시간표 선택"
        >
            <button
                type="button"
                onClick={() => onDayModeChange("AUTO")}
                aria-pressed={dayMode === "AUTO"}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                    dayMode === "AUTO"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title={`자동 감지 (오늘: ${isTodayWeekendOrHoliday ? "휴일" : "평일"})`}
            >
                <Sparkles className="w-3 h-3" />
                <span className="whitespace-nowrap">자동</span>
            </button>
            <button
                type="button"
                onClick={() => onDayModeChange("WEEKDAY")}
                aria-pressed={dayMode === "WEEKDAY"}
                className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                    dayMode === "WEEKDAY"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="평일 시간표 기준"
            >
                <span className="whitespace-nowrap">평일</span>
            </button>
            <button
                type="button"
                onClick={() => onDayModeChange("VACATION")}
                aria-pressed={dayMode === "VACATION"}
                className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                    dayMode === "VACATION"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="휴일 시간표 기준"
            >
                <span className="whitespace-nowrap">휴일</span>
            </button>
        </div>
    );
});
