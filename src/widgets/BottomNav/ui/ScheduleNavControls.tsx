"use client";

import React, {memo} from "react";
import {Bus, GraduationCap} from "lucide-react";
import {UI_TEXT} from "@shared/config/locale";
import type {DayMode, TimetableSubTab} from "@shared/types/navigation";
import {DayModeToggleGroup} from "./DayModeToggleGroup";

interface ScheduleNavControlsProps {
    scheduleSubTab?: TimetableSubTab;
    onScheduleSubTabChange?: (subTab: TimetableSubTab) => void;
    dayMode?: DayMode;
    onDayModeChange?: (mode: DayMode) => void;
    isTodayWeekendOrHoliday?: boolean;
}

export const ScheduleNavControls = memo(function ScheduleNavControls({
    scheduleSubTab = "yonsei",
    onScheduleSubTabChange,
    dayMode = "AUTO",
    onDayModeChange,
    isTodayWeekendOrHoliday = false,
}: ScheduleNavControlsProps) {
    return (
        <>
            {/* Divider */}
            <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0 animate-fadeIn"/>

            {/* Timetable Sub-tab Toggle Pills (Yonsei vs All) */}
            <div className="flex items-center gap-1 shrink-0 animate-fadeIn">
                <button
                    type="button"
                    onClick={() => onScheduleSubTabChange?.("yonsei")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                        scheduleSubTab === "yonsei"
                            ? "bg-[#003876] text-white shadow-md shadow-[#003876]/25 scale-[1.02]"
                            : "bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 border border-black/5 dark:border-white/10"
                    }`}
                >
                    <GraduationCap className="w-3.5 h-3.5"/>
                    <span className="whitespace-nowrap">{UI_TEXT.BOTTOM_NAV.TAB_YONSEI}</span>
                </button>

                <button
                    type="button"
                    onClick={() => onScheduleSubTabChange?.("all")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                        scheduleSubTab === "all"
                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md shadow-black/10 dark:shadow-white/10 scale-[1.02]"
                            : "bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 border border-black/5 dark:border-white/10"
                    }`}
                >
                    <Bus className="w-3.5 h-3.5"/>
                    <span className="whitespace-nowrap">{UI_TEXT.BOTTOM_NAV.TAB_ALL}</span>
                </button>
            </div>

            {/* Yonsei-specific Day Mode Toggle (Auto / Weekday / Vacation) */}
            {scheduleSubTab === "yonsei" && onDayModeChange && (
                <>
                    <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0 animate-fadeIn"/>
                    <DayModeToggleGroup
                        dayMode={dayMode}
                        onDayModeChange={onDayModeChange}
                        isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                    />
                </>
            )}
        </>
    );
});
