"use client";

import React, {memo, useCallback} from "react";
import {Calendar, Coffee, Sparkles} from "lucide-react";
import type {DayMode} from "@shared/types/navigation";

export interface DayModeToggleProps {
    dayMode?: DayMode;
    onDayModeChange?: (mode: DayMode) => void;
    isTodayWeekendOrHoliday?: boolean;
    className?: string;
}

export const DayModeToggle = memo(function DayModeToggle({
    dayMode = "AUTO",
    onDayModeChange,
    isTodayWeekendOrHoliday = false,
                                                             className = "",
                                                         }: DayModeToggleProps) {
    const handleToggle = useCallback(() => {
        if (!onDayModeChange) return;
        if (dayMode === "AUTO") {
            onDayModeChange("WEEKDAY");
        } else if (dayMode === "WEEKDAY") {
            onDayModeChange("VACATION");
        } else {
            onDayModeChange("AUTO");
        }
    }, [dayMode, onDayModeChange]);

    if (!onDayModeChange) return null;

    const title =
        dayMode === "AUTO"
            ? `시간표 기준: 자동 (오늘: ${isTodayWeekendOrHoliday ? "휴일" : "평일"}) · 클릭 시 평일로 변경`
            : dayMode === "WEEKDAY"
                ? "시간표 기준: 평일 · 클릭 시 휴일로 변경"
                : "시간표 기준: 휴일 · 클릭 시 자동으로 변경";

    const ariaLabel =
        dayMode === "AUTO"
            ? `시간표 기준 자동 (오늘: ${isTodayWeekendOrHoliday ? "휴일" : "평일"})`
            : dayMode === "WEEKDAY"
                ? "시간표 기준 평일"
                : "시간표 기준 휴일";

    return (
        <button
            type="button"
            onClick={handleToggle}
            title={title}
            aria-label={ariaLabel}
            className={`p-2 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all duration-200 cursor-pointer select-none active:scale-90 shrink-0 ${className}`}
        >
            {dayMode === "AUTO" && (
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 stroke-[2.2] animate-fadeIn"/>
            )}
            {dayMode === "WEEKDAY" && (
                <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400 stroke-[2.2] animate-fadeIn"/>
            )}
            {dayMode === "VACATION" && (
                <Coffee className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.2] animate-fadeIn"/>
            )}
        </button>
    );
});

export const DayModeToggleGroup = DayModeToggle;
