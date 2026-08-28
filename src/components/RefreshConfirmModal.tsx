"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CacheMetadata } from "@/types/bus";
import { formatCooldownRemaining } from "@/lib/timeUtils";
import {
  Clock,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";

interface RefreshConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  meta: CacheMetadata | null;
  onConfirmRefresh: (force: boolean) => Promise<void>;
  isRefreshing: boolean;
}

export const RefreshConfirmModal: React.FC<RefreshConfirmModalProps> = ({
  isOpen,
  onClose,
  meta,
  onConfirmRefresh,
  isRefreshing,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const cooldown = formatCooldownRemaining(meta?.updatedAt, 24);

  const formattedCriteriaDate = meta?.updatedAt
    ? new Date(meta.updatedAt).toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 dark:bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-[#121620] transition-colors duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.03] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-blue-600/15 text-blue-600 dark:text-blue-400">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                시간표 새로고침
              </h2>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                원주시 교통정보센터(ITS) 최신 시간표 동기화
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer active:scale-95"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Current Status Box */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>시간표 기준 일시</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                  cooldown.isReady
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30"
                    : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30"
                }`}
              >
                {cooldown.text}
              </span>
            </div>

            <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
              {formattedCriteriaDate}
            </p>
          </div>

          {/* Info Notice */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-500/20 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[11.5px]">
              원주시 ITS 서버 부하를 방지하기 위해 <strong>24시간(하루 1회)</strong> 캐시가 권장됩니다.
              지금 새로고침을 누르면 원주시 교통정보센터에서 최신 시간표를 즉시 스크래핑하여 갱신합니다.
            </p>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.03] flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-xs font-bold text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            disabled={isRefreshing}
            onClick={async () => {
              await onConfirmRefresh(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003876] hover:bg-blue-800 text-white text-xs font-black shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isRefreshing ? "animate-spin" : ""
              }`}
            />
            <span>
              {isRefreshing ? "시간표 가져오는 중..." : "지금 새로고침"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
