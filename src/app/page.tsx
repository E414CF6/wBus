"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BusRoute, CacheMetadata, DayMode, DepartureDirection } from "@/types/bus";
import { CommentItem } from "@/types/comment";
import { YONSEI_DATA, TARGET_ROUTE_NUMBERS } from "@/data/yonseiRoutes";
import { isWeekend, selectRouteVariant } from "@/lib/timeUtils";
import { Header } from "@/components/Header";
import { RouteCard } from "@/components/RouteCard";
import { RouteDetailModal } from "@/components/RouteDetailModal";
import { NoticeBanner } from "@/components/NoticeBanner";
import { CacheInfoBanner } from "@/components/CacheInfoBanner";
import { RefreshConfirmModal } from "@/components/RefreshConfirmModal";
import { Footer } from "@/components/Footer";
import { Bus, CheckCircle2, Info, X } from "lucide-react";

export default function YonseiTimetablePage() {
  const [routes, setRoutes] = useState<BusRoute[]>(() => YONSEI_DATA.routes);
  const [meta, setMeta] = useState<CacheMetadata | null>(() => ({
    exists: true,
    updatedAt: YONSEI_DATA.updatedAt,
    totalRoutes: YONSEI_DATA.totalRoutes,
    minRefreshIntervalDays: 1,
    canRefresh: true,
    nextRefreshAvailableAt: null,
  }));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshModalOpen, setIsRefreshModalOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [toastNotice, setToastNotice] = useState<{
    type: "success" | "info" | "error";
    message: string;
  } | null>(null);

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
      // Ignore
    }
  }, []);

  // Load comments from API
  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch("/api/comments");
      const json = await res.json();
      if (json.success && Array.isArray(json.comments)) {
        setComments(json.comments);
      }
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

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

  // Fetch or refresh schedule from Wonju ITS API
  const handleRefreshSchedule = async (force = true) => {
    setIsRefreshing(true);
    setToastNotice(null);
    try {
      const endpoint = force
        ? "/api/schedule/refresh?force=true"
        : "/api/schedule";
      const method = force ? "POST" : "GET";

      const res = await fetch(endpoint, { method });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || "시간표 정보를 불러오는 데 실패했습니다.");
      }

      if (json.data && Array.isArray(json.data.routes)) {
        setRoutes(json.data.routes);
      }
      if (json.meta) {
        setMeta(json.meta);
      }

      if (force) {
        setToastNotice({
          type: json.refreshed ? "success" : "info",
          message:
            json.message ||
            (json.refreshed
              ? "원주시 ITS에서 최신 시간표를 성공적으로 가져왔습니다."
              : "기존 저장된 최신 시간표를 유지합니다."),
        });
      }
    } catch (err) {
      setToastNotice({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "시간표 갱신 중 오류가 발생했습니다.",
      });
    } finally {
      setIsRefreshing(false);
      setIsRefreshModalOpen(false);
    }
  };

  const handleAddComment = async (data: {
    author?: string;
    content: string;
    routeNo?: string;
  }) => {
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || "댓글 등록에 실패했습니다.");
    }
    if (json.comment) {
      setComments((prev) => [json.comment, ...prev]);
    }
  };

  const handleDeleteComment = async (id: string) => {
    try {
      const res = await fetch(`/api/comments?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setComments((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      // Ignore
    }
  };

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
      const route = selectRouteVariant(routes, rNo, effectiveIsHoliday);
      if (route) {
        list.push(route);
      }
    }
    return list;
  }, [routes, effectiveIsHoliday]);

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

        {/* Refresh Toast Banner */}
        {toastNotice && (
          <div
            className={`p-3.5 sm:p-4 mb-4 rounded-2xl border flex items-center justify-between transition-all animate-fadeIn shadow-sm ${
              toastNotice.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
                : toastNotice.type === "error"
                ? "bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-200"
                : "bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-500/40 text-blue-800 dark:text-blue-200"
            }`}
          >
            <div className="flex items-center space-x-2.5">
              {toastNotice.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              )}
              <span className="text-xs sm:text-sm font-semibold">
                {toastNotice.message}
              </span>
            </div>
            <button
              onClick={() => setToastNotice(null)}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors shrink-0 ml-2 cursor-pointer"
              title="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Timetable Criteria & Refresh Banner */}
        <CacheInfoBanner
          meta={meta}
          onOpenRefreshModal={() => setIsRefreshModalOpen(true)}
          isRefreshing={isRefreshing}
          commentsCount={comments.length}
        />

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
          allRoutes={routes}
          direction={direction}
          onDirectionChange={setDirection}
          onClose={() => setSelectedRoute(null)}
          currentTime={currentTime}
        />
      )}

      {/* Refresh Confirmation & One-Line Comments Modal */}
      <RefreshConfirmModal
        isOpen={isRefreshModalOpen}
        onClose={() => setIsRefreshModalOpen(false)}
        meta={meta}
        onConfirmRefresh={handleRefreshSchedule}
        isRefreshing={isRefreshing}
        comments={comments}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
      />

      {/* Minimal Footer */}
      <Footer />
    </main>
  );
}
