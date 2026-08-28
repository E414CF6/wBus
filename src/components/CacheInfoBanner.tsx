"use client";

import React from "react";
import { CacheMetadata } from "@/types/bus";
import { Clock, RefreshCw } from "lucide-react";

interface CacheInfoBannerProps {
  meta: CacheMetadata | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const CacheInfoBanner: React.FC<CacheInfoBannerProps> = ({
  meta,
  onRefresh,
  isRefreshing,
}) => {
  if (!meta) return null;

  const formattedDate = meta.updatedAt
    ? new Date(meta.updatedAt).toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  return (
    <div className="flex items-center justify-between px-1 mb-4 text-xs text-slate-500 dark:text-slate-400 select-none">
      {/* Timetable Criteria Timestamp */}
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>
          시간표 기준:{" "}
          <strong className="font-mono text-slate-700 dark:text-slate-300 font-bold">
            {formattedDate}
          </strong>
        </span>
      </div>

      {/* Refresh Button */}
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-black transition-all cursor-pointer active:scale-95 text-[11px] border border-blue-500/20 disabled:opacity-50"
        title="원주시 ITS에서 시간표 새로고침"
      >
        <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
        <span>{isRefreshing ? "시간표 갱신 중..." : "시간표 새로고침"}</span>
      </button>
    </div>
  );
};
