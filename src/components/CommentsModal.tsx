"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CommentItem } from "@/types/comment";
import { formatRelativeTime } from "@/lib/timeUtils";
import {
  X,
  MessageSquare,
  Send,
  Trash2,
  CheckCircle2,
  Sparkles,
  Clock,
  Archive,
} from "lucide-react";

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  comments: CommentItem[];
  onAddComment: (data: {
    author?: string;
    content: string;
    routeNo?: string;
  }) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({
  isOpen,
  onClose,
  comments,
  onAddComment,
  onDeleteComment,
}) => {
  const [mounted, setMounted] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [selectedRouteTag, setSelectedRouteTag] = useState<string>("ALL");
  const [filterRouteTag, setFilterRouteTag] = useState<string>("ALL");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentSuccess, setCommentSuccess] = useState(false);

  // Archive toggle (defaults to 24h recent view)
  const [viewMode, setViewMode] = useState<"RECENT_24H" | "ARCHIVE">("RECENT_24H");
  const [archiveComments, setArchiveComments] = useState<CommentItem[]>([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);

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

  // Fetch archive if user switches to ARCHIVE mode
  useEffect(() => {
    if (viewMode === "ARCHIVE" && archiveComments.length === 0) {
      const fetchArchive = async () => {
        setIsLoadingArchive(true);
        try {
          const res = await fetch(`/api/comments?all=true&t=${Date.now()}`);
          const json = await res.json();
          if (json.success && Array.isArray(json.comments)) {
            setArchiveComments(json.comments);
          }
        } catch {
          // Ignore
        } finally {
          setIsLoadingArchive(false);
        }
      };
      fetchArchive();
    }
  }, [viewMode, archiveComments.length]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
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
      setIsSubmitting(false);
    }
  };

  const currentSourceList = viewMode === "ARCHIVE" ? archiveComments : comments;

  const displayedComments = currentSourceList.filter((c) => {
    if (filterRouteTag === "ALL") return true;
    return c.routeNo === filterRouteTag;
  });

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3.5 sm:p-6 bg-slate-950/60 dark:bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[92dvh] sm:max-h-[88vh] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-[#121620] transition-colors duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.03] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-blue-600/15 text-blue-600 dark:text-blue-400">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                연세인 한줄 댓글 & 버스 팁
              </h2>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-500" />
                <span>최근 24시간 동안 등록된 실시간 댓글이 표시됩니다</span>
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

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
          {/* Comment Write Form */}
          <form
            onSubmit={handleSubmit}
            className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-500/25 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <input
                type="text"
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
                placeholder="닉네임 (기본: 익명 연세인)"
                maxLength={15}
                className="w-36 px-2.5 py-1 text-xs rounded-xl bg-white dark:bg-[#181d2a] border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 font-semibold"
              />

              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-slate-400 text-[10px] font-bold mr-0.5">
                  노선 태그:
                </span>
                {["ALL", "30", "34", "34-1"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedRouteTag(tag)}
                    className={`px-2 py-0.5 rounded-lg font-black transition-all cursor-pointer ${
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
                disabled={!newContent.trim() || isSubmitting}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white text-xs font-black transition-all cursor-pointer shrink-0 active:scale-95 disabled:cursor-not-allowed"
              >
                <Send className="w-3 h-3" />
                <span>등록</span>
              </button>
            </div>

            {commentSuccess && (
              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold animate-fadeIn">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>댓글이 성공적으로 등록되었습니다!</span>
              </div>
            )}
          </form>

          {/* View Mode & Filter Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            {/* Route Filter Pills */}
            <div className="flex items-center gap-1">
              {["ALL", "30", "34", "34-1"].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setFilterRouteTag(tag)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    filterRouteTag === tag
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs font-black"
                      : "bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  {tag === "ALL"
                    ? `전체 (${currentSourceList.length})`
                    : `${tag}번`}
                </button>
              ))}
            </div>

            {/* View Mode Switcher: 24h Recent vs Archive */}
            <div className="inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-[11px] font-black border border-slate-200/80 dark:border-white/10 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode("RECENT_24H")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === "RECENT_24H"
                    ? "bg-blue-600 text-white shadow-xs font-black"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                최근 24시간
              </button>
              <button
                type="button"
                onClick={() => setViewMode("ARCHIVE")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === "ARCHIVE"
                    ? "bg-slate-800 text-white dark:bg-white/20 shadow-xs font-black"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                전체 기록
              </button>
            </div>
          </div>

          {/* Comments List */}
          <div className="space-y-2">
            {isLoadingArchive ? (
              <div className="py-8 text-center text-slate-400 text-xs animate-pulse">
                전체 댓글 기록을 불러오는 중...
              </div>
            ) : displayedComments.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                {viewMode === "RECENT_24H"
                  ? "최근 24시간 동안 등록된 댓글이 없습니다. 첫 댓글을 남겨보세요!"
                  : "등록된 댓글이 없습니다."}
              </div>
            ) : (
              displayedComments.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-[#161a26] border border-slate-200/80 dark:border-white/5 flex items-start justify-between gap-2.5 shadow-2xs hover:border-slate-300 dark:hover:border-white/10 transition-all"
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
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words font-medium">
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

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.03] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-medium">
            {viewMode === "RECENT_24H"
              ? `최근 24시간 활성 댓글 (${comments.length}건)`
              : `전체 저장된 댓글 (${archiveComments.length}건)`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-xs font-black text-slate-800 dark:text-white transition-all cursor-pointer active:scale-95"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
