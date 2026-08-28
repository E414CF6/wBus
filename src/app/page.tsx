"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BusRoute, DayMode, DepartureDirection } from "@/types/bus";
import { YONSEI_ROUTES, TARGET_ROUTE_NUMBERS } from "@/data/yonseiRoutes";
import { isWeekend, selectRouteVariant } from "@/lib/timeUtils";
import { Header } from "@/components/Header";
import { RouteCard } from "@/components/RouteCard";
import { RouteDetailModal } from "@/components/RouteDetailModal";
import { NoticeBanner } from "@/components/NoticeBanner";
import { Footer } from "@/components/Footer";
import { Bus, Filter } from "lucide-react";

export default function YonseiTimetablePage() {
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
  const [dayMode, setDayMode] = useState<DayMode>("AUTO");
  const [direction, setDirection] = useState<DepartureDirection>("DEST");
  const [selectedRoute, setSelectedRoute] = useState<BusRoute | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  // Update live clock every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Load bookmarks from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("yonsei_bus_bookmarks");
      if (saved) {
        setBookmarks(JSON.parse(saved));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const toggleBookmark = useCallback((routeNo: string) => {
    setBookmarks((prev) => {
      const next = prev.includes(routeNo)
        ? prev.filter((id) => id !== routeNo)
        : [...prev, routeNo];
      try {
        localStorage.setItem("yonsei_bus_bookmarks", JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  // Check if today is actual weekend
  const isTodayWeekendOrHoliday = useMemo(() => {
    return isWeekend(currentTime);
  }, [currentTime]);

  // Effective holiday flag taking DayMode into account
  const effectiveIsHoliday = useMemo(() => {
    if (dayMode === "WEEKDAY") return false;
    if (dayMode === "VACATION") return true;
    return isTodayWeekendOrHoliday;
  }, [dayMode, isTodayWeekendOrHoliday]);

  // Pair each target routeNo (30, 34, 34-1) with its matching active schedule variant
  const activeRoutes = useMemo(() => {
    const list: BusRoute[] = [];
    for (const rNo of TARGET_ROUTE_NUMBERS) {
      const route = selectRouteVariant(YONSEI_ROUTES, rNo, effectiveIsHoliday);
      if (route) {
        list.push(route);
      }
    }
    return list;
  }, [effectiveIsHoliday]);

  // Filter routes if user selects a specific route filter tab
  const displayedRoutes = useMemo(() => {
    if (selectedFilter === "ALL") return activeRoutes;
    return activeRoutes.filter((r) => r.routeNo === selectedFilter);
  }, [activeRoutes, selectedFilter]);

  return (
    <main className="min-h-screen flex flex-col justify-between py-6 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div>
        {/* Top Header */}
        <Header
          dayMode={dayMode}
          onDayModeChange={setDayMode}
          isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
          direction={direction}
          onDirectionChange={setDirection}
          currentTime={currentTime}
        />

        {/* Notice Info Banner */}
        <NoticeBanner />

        {/* Route Filter Navigation Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-5">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 shadow-2xs">
            <button
              type="button"
              onClick={() => setSelectedFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedFilter === "ALL"
                  ? "bg-[#003876] text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              전체 노선 (3)
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter("30")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedFilter === "30"
                  ? "bg-[#003876] text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              30번
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter("34")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedFilter === "34"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              34번
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter("34-1")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedFilter === "34-1"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              34-1번
            </button>
          </div>

          <div className="text-xs font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Bus className="w-3.5 h-3.5 text-blue-500" />
            <span>
              {direction === "DEST"
                ? "연세대·회촌 → 시내"
                : "장양리(시내) → 연세대"}
            </span>
          </div>
        </div>

        {/* Route Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {displayedRoutes.map((route) => (
            <RouteCard
              key={route.id}
              route={route}
              direction={direction}
              currentTime={currentTime}
              onOpenModal={setSelectedRoute}
              isBookmarked={bookmarks.includes(route.routeNo)}
              onToggleBookmark={toggleBookmark}
            />
          ))}
        </div>
      </div>

      {/* Detailed Timetable Modal */}
      {selectedRoute && (
        <RouteDetailModal
          route={selectedRoute}
          allRoutes={YONSEI_ROUTES}
          direction={direction}
          onDirectionChange={setDirection}
          onClose={() => setSelectedRoute(null)}
          currentTime={currentTime}
        />
      )}

      {/* Minimal Footer */}
      <Footer />
    </main>
  );
}
