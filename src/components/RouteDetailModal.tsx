"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BusRoute, DepartureDirection } from "@/types/bus";
import { ROUTE_CONFIG } from "@/data/yonseiRoutes";
import { parseTimeToMinutes } from "@/lib/timeUtils";
import { Clock, Info, Palmtree, Search, Sun, X, ArrowRightLeft } from "lucide-react";

interface RouteDetailModalProps {
  route: BusRoute | null;
  allRoutes: BusRoute[];
  direction: DepartureDirection;
  onDirectionChange: (dir: DepartureDirection) => void;
  onClose: () => void;
  currentTime?: Date;
}

interface MinuteItem {
  seq: number;
  timeStr: string;
  minuteStr: string;
  type: string;
  notes: string;
  footnoteSymbol?: string;
  footnoteNumber?: number;
  isNextBus: boolean;
}

const CIRCLED_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫"];

const getFootnoteSymbol = (num: number) => {
  if (num >= 1 && num <= CIRCLED_NUMBERS.length) return CIRCLED_NUMBERS[num - 1];
  return `[${num}]`;
};

export const RouteDetailModal: React.FC<RouteDetailModalProps> = ({
  route,
  allRoutes,
  direction,
  onDirectionChange,
  onClose,
  currentTime,
}) => {
  const [mounted, setMounted] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [selectedFootnote, setSelectedFootnote] = useState<number | null>(null);
  const [now, setNow] = useState<Date>(() => currentTime || new Date());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (currentTime) {
      setNow(currentTime);
    }
  }, [currentTime]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const currentHourStr = useMemo(() => {
    return String(now.getHours()).padStart(2, "0");
  }, [now]);

  const currentMins = useMemo(() => {
    return now.getHours() * 60 + now.getMinutes();
  }, [now]);

  const config = useMemo(() => {
    if (!route) return null;
    return (
      ROUTE_CONFIG[route.routeNo] || {
        name: `${route.routeNo}번`,
        gradient: "from-blue-600 to-indigo-600",
        destLabel: "연세대 출발",
        originLabel: "장양리 출발",
        viaStops: "",
        description: "",
      }
    );
  }, [route]);

  // Resolve Weekday & Vacation route variants for dual-column view
  const { weekdayRoute, vacationRoute } = useMemo(() => {
    if (!route) return { weekdayRoute: null, vacationRoute: null };
    const matches = allRoutes.filter((r) => r.routeNo === route.routeNo);
    if (!matches.length) return { weekdayRoute: route, vacationRoute: route };

    const wRoute =
      matches.find((r) => r.dayType === "평일" || r.dayType === "통상") ||
      matches[0];
    const vRoute =
      matches.find(
        (r) =>
          r.dayType === "방학,휴일" ||
          r.dayType.includes("방학") ||
          r.dayType.includes("휴일") ||
          r.dayType.includes("토요일") ||
          r.dayType.includes("공휴일") ||
          r.dayType === "통상"
      ) || matches[0];

    return { weekdayRoute: wRoute, vacationRoute: vRoute };
  }, [route, allRoutes]);

  // Build Footnote Index Map (unique notes mapped to numbered index)
  const footnoteMap = useMemo(() => {
    if (!weekdayRoute && !vacationRoute) return new Map<string, number>();

    const notesSet = new Set<string>();
    const extractNotes = (r: BusRoute | null) => {
      if (!r || !r.timetable) return;
      for (const item of r.timetable) {
        if (item.notes && item.notes.trim()) {
          notesSet.add(item.notes.trim());
        }
      }
    };

    extractNotes(weekdayRoute);
    extractNotes(vacationRoute);

    const map = new Map<string, number>();
    let counter = 1;
    for (const note of Array.from(notesSet)) {
      map.set(note, counter++);
    }
    return map;
  }, [weekdayRoute, vacationRoute]);

  // Check if weekday and vacation schedules are identical (e.g. route 30)
  const isSingleSchedule = useMemo(() => {
    if (!route) return false;
    if (route.routeNo === "30") return true;
    if (!weekdayRoute || !vacationRoute) return true;
    return weekdayRoute.id === vacationRoute.id;
  }, [route, weekdayRoute, vacationRoute]);

  // Group departure times into Hourly Rows (Hour | Weekday Minutes | Vacation Minutes)
  const dualHourlyTimetable = useMemo(() => {
    if (!route || !weekdayRoute || !vacationRoute) return [];

    const getValidEntries = (r: BusRoute) => {
      return (r.timetable || []).filter((item) => {
        const timeVal =
          direction === "DEST" ? item.destDepTime : item.originDepTime;
        return timeVal && timeVal !== "-" && timeVal.trim() !== "";
      });
    };

    const wEntries = getValidEntries(weekdayRoute);
    const vEntries = getValidEntries(vacationRoute);

    const filterBySearch = (entries: typeof wEntries) => {
      if (!tableSearch) return entries;
      const q = tableSearch.toLowerCase();
      return entries.filter((item) => {
        const timeVal =
          direction === "DEST" ? item.destDepTime : item.originDepTime;
        return (
          timeVal.includes(q) ||
          (item.type && item.type.toLowerCase().includes(q)) ||
          (item.notes && item.notes.toLowerCase().includes(q))
        );
      });
    };

    const filteredW = filterBySearch(wEntries);
    const filteredV = filterBySearch(vEntries);

    const hourMap = new Map<
      string,
      {
        weekdayMinutes: MinuteItem[];
        vacationMinutes: MinuteItem[];
      }
    >();

    const addEntriesToMap = (
      entries: typeof wEntries,
      isVacation: boolean
    ) => {
      for (const item of entries) {
        const timeVal =
          direction === "DEST" ? item.destDepTime : item.originDepTime;
        const parts = timeVal.trim().split(":");
        if (parts.length < 2) continue;

        const hourStr = parts[0].padStart(2, "0");
        const minuteStr = parts[1].padStart(2, "0");

        if (!hourMap.has(hourStr)) {
          hourMap.set(hourStr, { weekdayMinutes: [], vacationMinutes: [] });
        }

        const noteTrimmed = (item.notes || "").trim();
        const fnNum = noteTrimmed ? footnoteMap.get(noteTrimmed) : undefined;
        const fnSymbol = fnNum ? getFootnoteSymbol(fnNum) : undefined;

        const minuteItem: MinuteItem = {
          seq: item.seq,
          timeStr: timeVal,
          minuteStr,
          type: item.type || "",
          notes: noteTrimmed,
          footnoteSymbol: fnSymbol,
          footnoteNumber: fnNum,
          isNextBus: false,
        };

        if (isVacation) {
          hourMap.get(hourStr)!.vacationMinutes.push(minuteItem);
        } else {
          hourMap.get(hourStr)!.weekdayMinutes.push(minuteItem);
        }
      }
    };

    addEntriesToMap(filteredW, false);
    addEntriesToMap(filteredV, true);

    // Identify next bus sequence for Weekday
    let nextWeekdaySeq = -1;
    for (const item of filteredW) {
      const timeVal =
        direction === "DEST" ? item.destDepTime : item.originDepTime;
      const mins = parseTimeToMinutes(timeVal);
      if (mins !== null && mins >= currentMins) {
        nextWeekdaySeq = item.seq;
        break;
      }
    }

    // Identify next bus sequence for Vacation
    let nextVacationSeq = -1;
    for (const item of filteredV) {
      const timeVal =
        direction === "DEST" ? item.destDepTime : item.originDepTime;
      const mins = parseTimeToMinutes(timeVal);
      if (mins !== null && mins >= currentMins) {
        nextVacationSeq = item.seq;
        break;
      }
    }

    const sortedHours = Array.from(hourMap.keys()).sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10)
    );

    return sortedHours.map((hourStr) => {
      const data = hourMap.get(hourStr)!;
      const isCurrentHour = hourStr === currentHourStr;

      return {
        hourStr,
        displayHour: String(parseInt(hourStr, 10)),
        isCurrentHour,
        weekdayMinutes: data.weekdayMinutes.map((m) => ({
          ...m,
          isNextBus: m.seq === nextWeekdaySeq,
        })),
        vacationMinutes: data.vacationMinutes.map((m) => ({
          ...m,
          isNextBus: m.seq === nextVacationSeq,
        })),
      };
    });
  }, [
    route,
    weekdayRoute,
    vacationRoute,
    direction,
    tableSearch,
    currentMins,
    currentHourStr,
    footnoteMap,
  ]);

  if (!route || !mounted) return null;

  const isHoechon = route.routeNo === "34-1";
  const modalTitle =
    direction === "DEST"
      ? isHoechon
        ? "회촌 출발 시간표 (시내 방면)"
        : "연세대 출발 시간표 (시내 방면)"
      : "장양리 출발 시간표 (연세대/회촌 방면)";

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 dark:bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[92dvh] sm:h-auto sm:max-h-[90vh] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-[#121620] transition-colors duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.03] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`px-3.5 py-1 rounded-2xl bg-gradient-to-r ${config?.gradient} font-black text-white text-lg sm:text-xl tracking-tight shadow-md font-mono shrink-0`}
            >
              {route.routeNo}번
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 truncate">
                <span>{modalTitle}</span>
                {isSingleSchedule && (
                  <span className="px-2 py-0.5 rounded-lg text-[11px] font-black bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 shrink-0">
                    매일 운행
                  </span>
                )}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Direction Switcher inside Modal */}
            <button
              type="button"
              onClick={() =>
                onDirectionChange(direction === "DEST" ? "ORIGIN" : "DEST")
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 text-xs font-bold border border-blue-200/80 dark:border-blue-500/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all cursor-pointer active:scale-95"
              title="방향 전환"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {direction === "DEST" ? "장양리발 보기" : "연세대발 보기"}
              </span>
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer active:scale-95"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Full-width Via Marquee Strip */}
        {config?.viaStops && (
          <div className="w-full px-4 py-2 bg-slate-100/90 dark:bg-white/[0.03] border-b border-slate-200/70 dark:border-white/10 flex items-center gap-2 overflow-hidden shrink-0">
            <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-black text-[10px] shrink-0 shadow-2xs">
              경유
            </span>
            <div className="relative overflow-hidden flex-1 flex items-center h-4 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <div className="animate-marquee-fast flex shrink-0 items-center whitespace-nowrap">
                <span className="mr-10">{config.viaStops}</span>
                <span className="mr-10">{config.viaStops}</span>
              </div>
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-slate-100/95 dark:from-[#121620] to-transparent z-10" />
            </div>
          </div>
        )}

        {/* Search Bar & Total count */}
        <div className="p-3 sm:p-4 border-b border-slate-200/70 dark:border-white/10 bg-white/50 dark:bg-[#121620]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="출발 시각 또는 비고(예: 원주역, 상지대) 검색..."
              className="w-full pl-9 pr-4 py-1.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-transparent focus:border-blue-500/50 text-xs font-semibold text-slate-900 dark:text-white outline-none transition-all"
            />
          </div>
          <div className="text-[11px] sm:text-xs font-extrabold text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-2">
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <Clock className="w-3.5 h-3.5" />
              <span>현재 {currentHourStr}시</span>
            </span>
            <span>·</span>
            <span>총 {dualHourlyTimetable.length}개 시간대</span>
          </div>
        </div>

        {/* Timetable Table Header */}
        <div className="sticky top-0 z-10 bg-slate-100/95 dark:bg-[#181d2a]/95 backdrop-blur-md px-4 py-2.5 border-b border-slate-200/80 dark:border-white/10 grid grid-cols-12 gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 shrink-0">
          <div className="col-span-3 sm:col-span-2 text-center border-r border-slate-200/80 dark:border-white/10 pr-2">
            시간
          </div>

          {isSingleSchedule ? (
            /* Single Column Header for Route 30 */
            <div className="col-span-9 sm:col-span-10 flex items-center justify-center gap-1.5 text-blue-600 dark:text-blue-400">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>매일 운행 (평일 · 휴일 동일)</span>
            </div>
          ) : (
            /* Dual Columns Header for Routes 34, 34-1 */
            <>
              <div className="col-span-4 sm:col-span-5 flex items-center justify-center gap-1.5 text-blue-600 dark:text-blue-400 border-r border-slate-200/80 dark:border-white/10 pr-2">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>평일</span>
              </div>
              <div className="col-span-5 flex items-center justify-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                <Palmtree className="w-3.5 h-3.5 text-emerald-500" />
                <span>방학 · 휴일</span>
              </div>
            </>
          )}
        </div>

        {/* Timetable Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {dualHourlyTimetable.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 font-sans text-xs">
              검색 조건에 일치하는 출발 시각이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {dualHourlyTimetable.map(
                ({
                  hourStr,
                  displayHour,
                  isCurrentHour,
                  weekdayMinutes,
                  vacationMinutes,
                }) => (
                  <div
                    key={hourStr}
                    className={`grid grid-cols-12 gap-2 p-3 sm:p-4 transition-colors items-center text-xs ${
                      isCurrentHour
                        ? "bg-blue-500/[0.08] dark:bg-blue-500/[0.14] border-l-4 border-l-blue-600 font-semibold"
                        : "hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                    }`}
                  >
                    {/* Hour Column */}
                    <div className="col-span-3 sm:col-span-2 text-center border-r border-slate-200/80 dark:border-white/10 pr-2 flex flex-col items-center justify-center">
                      <div className="flex items-baseline gap-0.5">
                        <span
                          className={`text-lg sm:text-2xl font-black font-mono ${
                            isCurrentHour
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-slate-900 dark:text-white"
                          }`}
                        >
                          {displayHour}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                          시
                        </span>
                      </div>
                      {isCurrentHour && (
                        <span className="mt-0.5 px-1.5 py-0.2 rounded-md bg-blue-600 text-white text-[9px] font-extrabold">
                          현재 시각
                        </span>
                      )}
                    </div>

                    {isSingleSchedule ? (
                      /* Single Column Body for Route 30 */
                      <div className="col-span-9 sm:col-span-10 pl-2">
                        {weekdayMinutes.length === 0 ? (
                          <span className="text-slate-300 dark:text-slate-600 italic text-[11px]">
                            -
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            {weekdayMinutes.map((item) => (
                              <div
                                key={item.seq}
                                className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl font-mono text-xs font-bold border transition-all active:scale-95 ${
                                  item.isNextBus
                                    ? "bg-blue-600 text-white border-blue-600 shadow-md scale-105"
                                    : "bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 border-blue-200/60 dark:border-blue-500/20 hover:border-blue-400/60"
                                }`}
                              >
                                <span className="font-extrabold text-xs sm:text-[13px]">
                                  {item.minuteStr}
                                </span>
                                {item.isNextBus && (
                                  <span className="text-[8px] sm:text-[9px] px-1 py-0.2 rounded bg-white/20 text-white font-sans font-black">
                                    다음
                                  </span>
                                )}
                                {item.footnoteSymbol && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (item.footnoteNumber) {
                                        setSelectedFootnote(
                                          selectedFootnote ===
                                            item.footnoteNumber
                                            ? null
                                            : item.footnoteNumber
                                        );
                                      }
                                    }}
                                    title={item.notes}
                                    className={`text-xs font-black font-mono ml-0.5 cursor-pointer hover:scale-125 transition-transform ${
                                      item.isNextBus
                                        ? "text-amber-200"
                                        : "text-amber-600 dark:text-amber-400"
                                    }`}
                                  >
                                    {item.footnoteSymbol}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Dual Column Body for Routes 34, 34-1 */
                      <>
                        {/* Weekday Column */}
                        <div className="col-span-4 sm:col-span-5 border-r border-slate-200/80 dark:border-white/10 pr-1.5 sm:pr-2">
                          {weekdayMinutes.length === 0 ? (
                            <span className="text-slate-300 dark:text-slate-600 italic text-[11px]">
                              -
                            </span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                              {weekdayMinutes.map((item) => (
                                <div
                                  key={item.seq}
                                  className={`inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-xl font-mono text-[11px] sm:text-xs font-bold border transition-all active:scale-95 ${
                                    item.isNextBus
                                      ? "bg-blue-600 text-white border-blue-600 shadow-md scale-105"
                                      : "bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 border-blue-200/60 dark:border-blue-500/20"
                                  }`}
                                >
                                  <span className="font-extrabold">
                                    {item.minuteStr}
                                  </span>
                                  {item.isNextBus && (
                                    <span className="text-[8px] sm:text-[9px] px-0.5 sm:px-1 py-0.2 rounded bg-white/20 text-white font-sans font-black">
                                      다음
                                    </span>
                                  )}
                                  {item.footnoteSymbol && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (item.footnoteNumber) {
                                          setSelectedFootnote(
                                            selectedFootnote ===
                                              item.footnoteNumber
                                              ? null
                                              : item.footnoteNumber
                                          );
                                        }
                                      }}
                                      title={item.notes}
                                      className={`text-xs font-black font-mono ml-0.5 cursor-pointer hover:scale-125 transition-transform ${
                                        item.isNextBus
                                          ? "text-amber-200"
                                          : "text-amber-600 dark:text-amber-400"
                                      }`}
                                    >
                                      {item.footnoteSymbol}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Vacation Column */}
                        <div className="col-span-5 pl-1.5 sm:pl-2">
                          {vacationMinutes.length === 0 ? (
                            <span className="text-slate-300 dark:text-slate-600 italic text-[11px]">
                              -
                            </span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                              {vacationMinutes.map((item) => (
                                <div
                                  key={item.seq}
                                  className={`inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-xl font-mono text-[11px] sm:text-xs font-bold border transition-all active:scale-95 ${
                                    item.isNextBus
                                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md scale-105"
                                      : "bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 border-indigo-200/60 dark:border-indigo-500/20"
                                  }`}
                                >
                                  <span className="font-extrabold">
                                    {item.minuteStr}
                                  </span>
                                  {item.isNextBus && (
                                    <span className="text-[8px] sm:text-[9px] px-0.5 sm:px-1 py-0.2 rounded bg-white/20 text-white font-sans font-black">
                                      다음
                                    </span>
                                  )}
                                  {item.footnoteSymbol && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (item.footnoteNumber) {
                                          setSelectedFootnote(
                                            selectedFootnote ===
                                              item.footnoteNumber
                                              ? null
                                              : item.footnoteNumber
                                          );
                                        }
                                      }}
                                      title={item.notes}
                                      className={`text-xs font-black font-mono ml-0.5 cursor-pointer hover:scale-125 transition-transform ${
                                        item.isNextBus
                                          ? "text-indigo-200"
                                          : "text-amber-600 dark:text-amber-400"
                                      }`}
                                    >
                                      {item.footnoteSymbol}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Footnote Strip Box */}
        {footnoteMap.size > 0 && (
          <div className="p-3 sm:p-4 bg-slate-100/90 dark:bg-white/[0.04] border-t border-slate-200/80 dark:border-white/10 text-xs shrink-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>비고 및 경유 안내</span>
              </div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400">
                좌우로 스크롤하여 확인 →
              </div>
            </div>

            {/* Horizontal Scroll Strip */}
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-1 scroll-smooth touch-pan-x overscroll-x-contain">
              {Array.from(footnoteMap.entries()).map(([noteText, num]) => {
                const isHighlighted = selectedFootnote === num;
                return (
                  <div
                    key={num}
                    onClick={() =>
                      setSelectedFootnote(isHighlighted ? null : num)
                    }
                    className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border shrink-0 transition-all cursor-pointer select-none active:scale-95 ${
                      isHighlighted
                        ? "bg-amber-100 dark:bg-amber-950/70 border-amber-400 dark:border-amber-500 shadow-sm ring-1 ring-amber-400"
                        : "bg-white dark:bg-[#181d2a] border-slate-200/80 dark:border-white/10 hover:border-blue-400/60"
                    }`}
                  >
                    <span className="font-black text-amber-600 dark:text-amber-400 text-xs sm:text-sm shrink-0 font-mono">
                      {getFootnoteSymbol(num)}
                    </span>
                    <span className="text-slate-700 dark:text-slate-200 font-bold text-[11px] sm:text-xs whitespace-nowrap">
                      {noteText}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
