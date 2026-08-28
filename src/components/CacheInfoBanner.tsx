"use client";

import React from "react";
import { CacheMetadata } from "@/types/bus";
import { formatCooldownRemaining } from "@/lib/timeUtils";
import { Clock, RefreshCw, MessageSquare } from "lucide-react";

interface CacheInfoBannerProps {
  meta: CacheMetadata | null;
  onOpenRefreshModal: () => void;
  onOpenCommentsModal: () => void;
  isRefreshing: boolean;
  commentsCount: number;
}

export const CacheInfoBanner: React.FC<CacheInfoBannerProps> = ({
  meta,
  onOpenRefreshModal,
  onOpenCommentsModal,
  isRefreshing,
  commentsCount,
}) => {
  const formattedDate = meta?.updatedAt
    ? new Date(meta.updatedAt).toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  const cooldown = formatCooldownRemaining(meta?.updatedAt, 24);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 mb-4 text-xs text-slate-500 dark:text-slate-400 select-none">
      {/* Timetable Criteria Timestamp & Cooldown Status */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>
            시간표 기준:{" "}
            <strong className="font-mono text-slate-700 dark:text-slate-300 font-bold">
              {formattedDate}
            </strong>
          </span>
        </div>

        <span
          className={`hidden sm:inline-block px-2 py-0.2 rounded-md text-[10px] font-black border ${
            cooldown.isReady
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30"
              : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10"
          }`}
        >
          {cooldown.text}
        </span>
      </div>

      {/* Action Buttons: Separate Comments & Refresh */}
      <div className="flex items-center gap-2">
        {/* Dedicated Comments Button */}
        <button
          type="button"
          onClick={onOpenCommentsModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-black transition-all cursor-pointer active:scale-95 text-[11px] border border-blue-500/20 shadow-2xs"
          title="연세인 한줄 댓글 및 버스 팁 보기"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>한줄 댓글</span>
          {commentsCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-bold">
              {commentsCount}
            </span>
          )}
        </button>

        {/* Dedicated Refresh Button */}
        <button
          type="button"
          onClick={onOpenRefreshModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-300 font-black transition-all cursor-pointer active:scale-95 text-[11px] border border-slate-200/80 dark:border-white/10"
          title="시간표 갱신 확인"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
          />
          <span>{isRefreshing ? "갱신 중..." : "시간표 새로고침"}</span>
        </button>
      </div>
    </div>
  );
};
