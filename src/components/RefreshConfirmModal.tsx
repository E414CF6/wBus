"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CacheMetadata } from "@/types/bus";
import { CommentItem } from "@/types/comment";
import { formatCooldownRemaining, formatRelativeTime } from "@/lib/timeUtils";
import {
  Clock,
  RefreshCw,
  X,
  AlertTriangle,
  Send,
  MessageSquare,
  Sparkles,
  Trash2,
  CheckCircle2,
} from "lucide-react";

interface RefreshConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  meta: CacheMetadata | null;
  onConfirmRefresh: (force: boolean) => Promise<void>;
  isRefreshing: boolean;
  comments: CommentItem[];
  onAddComment: (data: {
    author?: string;
    content: string;
    routeNo?: string;
  }) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
}

export const RefreshConfirmModal: React.FC<RefreshConfirmModalProps> = ({
  isOpen,
  onClose,
  meta,
  onConfirmRefresh,
  isRefreshing,
  comments,
  onAddComment,
  onDeleteComment,
}) => {
  const [mounted, setMounted] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [selectedRouteTag, setSelectedRouteTag] = useState<string>("ALL");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentSuccess, setCommentSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle ESC key to close
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

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      await onAddComment({
        author: newAuthor.trim() || "익명 연세인",
        content: newContent.trim(),
        routeNo: selectedRouteTag === "ALL" ? undefined : selectedRouteTag,
      });
      setNewContent("");
      setCommentSuccess(true);
      setTimeout(() => setCommentSuccess(false), 2500);
    } catch {
      // Handled in parent
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3.5 sm:p-6 bg-slate-950/60 dark:bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[92dvh] sm:max-h-[90vh] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-[#121620] transition-colors duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.03] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                시간표 새로고침 & 한줄 댓글
              </h2>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                원주시 교통정보센터(ITS) 최신 시간표 갱신 및 소통 공간
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

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-6">
          {/* Section 1: Timetable Refresh & 24h Cooldown Confirmation */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>시간표 갱신 기준 및 쿨다운</span>
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

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed">
              <p>
                현재 저장된 시간표 기준:{" "}
                <strong className="font-mono text-slate-900 dark:text-white font-bold">
                  {formattedCriteriaDate}
                </strong>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                원주시 ITS 서버 부하 방지 및 안정적인 조회를 위해{" "}
                <strong className="text-blue-600 dark:text-blue-400">
                  24시간(하루 1회) 쿨다운
                </strong>
                이 적용됩니다. 필요 시 즉시 새로고침을 진행할 수 있습니다.
              </p>
            </div>

            {/* Refresh Action Buttons */}
            <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-slate-200/70 dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-xs font-bold text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={isRefreshing}
                onClick={async () => {
                  await onConfirmRefresh(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#003876] hover:bg-blue-800 text-white text-xs font-black shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                />
                <span>
                  {isRefreshing ? "ITS에서 수집 중..." : "지금 시간표 새로고침"}
                </span>
              </button>
            </div>
          </div>

          {/* Section 2: One-Line Comments & Bus Tips (한줄 댓글 & 버스 이용 팁) */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>연세인 한줄 댓글 ({comments.length})</span>
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                버스 지연, 막차 팁, 건의사항 등
              </span>
            </div>

            {/* Comment Form */}
            <form
              onSubmit={handleCommentSubmit}
              className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-500/20 mb-4"
            >
              {/* Route Tag Filter & Nickname Row */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <input
                  type="text"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  placeholder="닉네임 (기본: 익명 연세인)"
                  maxLength={15}
                  className="w-36 px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-[#181d2a] border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 font-semibold"
                />

                <div className="flex items-center gap-1 text-[11px]">
                  {["ALL", "30", "34", "34-1"].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedRouteTag(tag)}
                      className={`px-2 py-0.5 rounded-md font-extrabold transition-all cursor-pointer ${
                        selectedRouteTag === tag
                          ? "bg-blue-600 text-white shadow-2xs"
                          : "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-white/5"
                      }`}
                    >
                      {tag === "ALL" ? "공통" : `${tag}번`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Input & Submit Button */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="버스 이용 꿀팁이나 한줄 메모를 남겨보세요! (최대 100자)"
                  maxLength={100}
                  className="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#181d2a] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={!newContent.trim() || isSubmittingComment}
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white text-xs font-black transition-all cursor-pointer shrink-0 active:scale-95 disabled:cursor-not-allowed"
                >
                  <Send className="w-3 h-3" />
                  <span>등록</span>
                </button>
              </div>

              {commentSuccess && (
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold mt-2 animate-fadeIn">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>댓글이 등록되었습니다!</span>
                </div>
              )}
            </form>

            {/* Comments List */}
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
              {comments.length === 0 ? (
                <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                  아직 등록된 한줄 댓글이 없습니다. 첫 댓글을 남겨보세요!
                </div>
              ) : (
                comments.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-white dark:bg-[#161a26] border border-slate-200/80 dark:border-white/5 flex items-start justify-between gap-2.5 shadow-2xs hover:border-slate-300 dark:hover:border-white/10 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {item.author}
                        </span>
                        {item.routeNo && (
                          <span className="px-1.5 py-0.2 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-[10px] font-extrabold border border-blue-200/60 dark:border-blue-500/30">
                            {item.routeNo}번
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-medium">
                          · {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words">
                        {item.content}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteComment(item.id)}
                      className="p-1 rounded-lg text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 transition-colors shrink-0 cursor-pointer"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
