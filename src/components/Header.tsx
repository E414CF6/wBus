"use client";

import React from "react";
import { GraduationCap, Sparkles, Clock, ArrowRightLeft } from "lucide-react";
import { DayMode, DepartureDirection } from "@/types/bus";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  dayMode: DayMode;
  onDayModeChange: (mode: DayMode) => void;
  isTodayWeekendOrHoliday: boolean;
  direction: DepartureDirection;
  onDirectionChange: (dir: DepartureDirection) => void;
  currentTime: Date;
}

export const Header: React.FC<HeaderProps> = ({
  dayMode,
  onDayModeChange,
  isTodayWeekendOrHoliday,
  direction,
  onDirectionChange,
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
      {/* Top Bar: Yonsei Mirae Campus Branding & Theme Toggle */}
      <div className="backdrop-blur-2xl bg-gradient-to-br from-blue-900/15 via-indigo-900/10 to-slate-900/10 dark:from-blue-950/60 dark:via-indigo-950/40 dark:to-slate-900/60 rounded-3xl p-4 sm:p-6 border border-blue-500/20 shadow-sm relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            {/* Yonsei Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black bg-[#003876] text-white shadow-sm ring-1 ring-white/10">
              <GraduationCap className="w-4 h-4 text-blue-200" />
              <span>연세대학교 미래캠퍼스</span>
            </div>

            {/* Right Group: Live Clock & Theme Toggle */}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/80 dark:bg-white/5 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-pulse" />
                <span>{timeFormatted}</span>
              </div>
              <ThemeToggle />
            </div>
          </div>

          {/* Title & Subtitle */}
          <div className="mt-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              연세대학교 시내버스 시간표
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
              30번 · 34번 · 34-1번 실시간 다음 버스 및 전체 운행 시간표
            </p>
          </div>

          {/* Direction & Day Mode Controls Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-200/60 dark:border-white/10">
            {/* Direction Switcher (하교/시내행 vs 등교/연대행) */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1">
                <ArrowRightLeft className="w-3 h-3 text-blue-500" />
                <span>출발 방향:</span>
              </span>
              <div className="inline-flex p-0.5 rounded-xl bg-white/85 dark:bg-[#141824]/90 text-[11px] font-black border border-slate-200/80 dark:border-white/10 shadow-2xs">
                <button
                  type="button"
                  onClick={() => onDirectionChange("DEST")}
                  className={`px-3 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer ${
                    direction === "DEST"
                      ? "bg-[#003876] text-white shadow-xs font-black"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  연세대·회촌 출발 (시내 방면)
                </button>
                <button
                  type="button"
                  onClick={() => onDirectionChange("ORIGIN")}
                  className={`px-3 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer ${
                    direction === "ORIGIN"
                      ? "bg-[#003876] text-white shadow-xs font-black"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  장양리 출발 (연세대 방면)
                </button>
              </div>
            </div>

            {/* Day Mode Switcher (자동 / 평일 / 방학·휴일) */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>운행 기준:</span>
              </span>
              <div className="inline-flex p-0.5 rounded-xl bg-white/85 dark:bg-[#141824]/90 text-[11px] font-black border border-slate-200/80 dark:border-white/10 shadow-2xs">
                <button
                  type="button"
                  onClick={() => onDayModeChange("AUTO")}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer ${
                    dayMode === "AUTO"
                      ? "bg-blue-600 text-white shadow-xs font-black"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="오늘 요일 기준 자동 감지"
                >
                  자동 ({isTodayWeekendOrHoliday ? "휴일" : "평일"})
                </button>
                <button
                  type="button"
                  onClick={() => onDayModeChange("WEEKDAY")}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer ${
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
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer ${
                    dayMode === "VACATION"
                      ? "bg-indigo-600 text-white shadow-xs font-black"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="방학 및 주말/공휴일 시간표"
                >
                  방학 · 휴일
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
