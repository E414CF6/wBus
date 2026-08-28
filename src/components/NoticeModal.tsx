"use client";

import React, {useEffect, useState} from "react";
import {createPortal} from "react-dom";
import {NoticeDetail, NoticeListResponse} from "@/types/notice";
import {
    ArrowLeft,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Download,
    ExternalLink,
    Eye,
    Megaphone,
    Paperclip,
    Search,
    User,
    X,
} from "lucide-react";

interface NoticeModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialNoticeId?: string | null;
}

export const NoticeModal: React.FC<NoticeModalProps> = ({
                                                            isOpen,
                                                            onClose,
                                                            initialNoticeId,
                                                        }) => {
    const [mounted, setMounted] = useState(false);
    const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"ALL" | "PINNED">("ALL");
    const [page, setPage] = useState(1);
    const [searchText, setSearchText] = useState("");
    const [searchInput, setSearchInput] = useState("");

    const [listData, setListData] = useState<NoticeListResponse | null>(null);
    const [isListLoading, setIsListLoading] = useState(false);
    const [detailData, setDetailData] = useState<NoticeDetail | null>(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (initialNoticeId) {
            setSelectedNoticeId(initialNoticeId);
        }
    }, [initialNoticeId]);

    // Handle ESC key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (selectedNoticeId) {
                    setSelectedNoticeId(null);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, selectedNoticeId, onClose]);

    // Fetch notice list
    useEffect(() => {
        if (!isOpen) return;
        let isCancelled = false;
        const fetchList = async () => {
            setIsListLoading(true);
            try {
                const params = new URLSearchParams();
                params.set("page", String(page));
                if (searchText) params.set("searchText", searchText);

                const res = await fetch(`/api/notice?${params.toString()}`);
                const json = await res.json();
                if (!isCancelled && json.success && json.data) {
                    setListData(json.data);
                }
            } catch (err) {
                console.warn("Failed to fetch notices:", err);
            } finally {
                if (!isCancelled) setIsListLoading(false);
            }
        };
        fetchList();
        return () => {
            isCancelled = true;
        };
    }, [isOpen, page, searchText]);

    // Fetch notice detail
    useEffect(() => {
        if (!isOpen || !selectedNoticeId) {
            setDetailData(null);
            return;
        }
        let isCancelled = false;
        const fetchDetail = async () => {
            setIsDetailLoading(true);
            try {
                const res = await fetch(`/api/notice/${selectedNoticeId}`);
                const json = await res.json();
                if (!isCancelled && json.success && json.data) {
                    setDetailData(json.data);
                }
            } catch (err) {
                console.warn("Failed to fetch notice detail:", err);
            } finally {
                if (!isCancelled) setIsDetailLoading(false);
            }
        };
        fetchDetail();
        return () => {
            isCancelled = true;
        };
    }, [isOpen, selectedNoticeId]);

    if (!isOpen || !mounted) return null;

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        setSearchText(searchInput.trim());
    };

    const filteredNotices = (listData?.notices || [])
        .filter((item) => {
            if (activeTab === "PINNED") return item.isNotice;
            return true;
        })
        .sort((a, b) => {
            const dateA = a.date || "";
            const dateB = b.date || "";
            if (dateA !== dateB) {
                return dateB.localeCompare(dateA);
            }
            return (parseInt(b.id, 10) || 0) - (parseInt(a.id, 10) || 0);
        });

    const totalPages = listData
        ? Math.max(1, Math.ceil(listData.totalCount / 10))
        : 1;

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 dark:bg-black/80 backdrop-blur-md animate-fadeIn"
            onClick={onClose}
        >
            <div
                className="w-full max-w-3xl h-[92dvh] sm:h-auto sm:max-h-[88vh] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-[#121620] transition-colors duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.03] flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                            <Megaphone className="w-4 h-4"/>
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                                원주시 교통정보센터 알림마당
                            </h2>
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                                원주시 시내버스 노선 변경 및 공식 교통 공지사항
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer active:scale-95 shrink-0"
                        aria-label="닫기"
                    >
                        <X className="w-4 h-4"/>
                    </button>
                </div>

                {/* Detail View */}
                {selectedNoticeId ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {isDetailLoading ? (
                            <div className="p-6 space-y-4 animate-pulse">
                                <div className="h-6 w-3/4 bg-slate-200 dark:bg-white/10 rounded-xl"/>
                                <div className="h-4 w-1/3 bg-slate-200 dark:bg-white/10 rounded-lg"/>
                                <div className="h-40 w-full bg-slate-200 dark:bg-white/10 rounded-2xl"/>
                            </div>
                        ) : detailData ? (
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
                                {/* Meta Box */}
                                <div
                                    className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 space-y-2.5">
                                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                                        {detailData.title}
                                    </h3>
                                    <div
                                        className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-white/10">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400"/>
                      <span>{detailData.writer}</span>
                    </span>
                                        <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400"/>
                      <span>{detailData.date}</span>
                    </span>
                                        <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-slate-400"/>
                      <span>조회수 {detailData.views}</span>
                    </span>
                                    </div>
                                </div>

                                {/* Attachments */}
                                {detailData.files && detailData.files.length > 0 && (
                                    <div
                                        className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                                        <div
                                            className="flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-amber-300">
                                            <Paperclip className="w-3.5 h-3.5"/>
                                            <span>첨부파일 ({detailData.files.length}개)</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            {detailData.files.map((file, idx) => (
                                                <a
                                                    key={idx}
                                                    href={file.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    download
                                                    className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-white/10 hover:bg-amber-500/20 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors group"
                                                >
                                                    <span className="truncate pr-2">{file.name}</span>
                                                    <Download
                                                        className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform"/>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Content Area */}
                                <div
                                    className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans overflow-x-auto space-y-3 prose dark:prose-invert max-w-none"
                                    dangerouslySetInnerHTML={{
                                        __html: detailData.content
                                            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                                            .replace(/<script[^>]*>/gi, "")
                                            .replace(/<\/script>/gi, ""),
                                    }}
                                />

                                {/* Prev / Next Notice */}
                                {(detailData.prevId || detailData.nextId) && (
                                    <div
                                        className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 space-y-1.5 text-xs">
                                        {detailData.prevId && (
                                            <div
                                                onClick={() => setSelectedNoticeId(detailData.prevId!)}
                                                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
                                            >
                        <span className="font-bold text-amber-600 dark:text-amber-400 shrink-0">
                          이전글:
                        </span>
                                                <span className="truncate text-slate-700 dark:text-slate-300">
                          {detailData.prevTitle || detailData.prevId}
                        </span>
                                            </div>
                                        )}
                                        {detailData.nextId && (
                                            <div
                                                onClick={() => setSelectedNoticeId(detailData.nextId!)}
                                                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
                                            >
                        <span className="font-bold text-amber-600 dark:text-amber-400 shrink-0">
                          다음글:
                        </span>
                                                <span className="truncate text-slate-700 dark:text-slate-300">
                          {detailData.nextTitle || detailData.nextId}
                        </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-12 text-center text-slate-400 text-xs">
                                공지사항 내용을 불러올 수 없습니다.
                            </div>
                        )}

                        {/* Footer of Detail */}
                        <div
                            className="p-3.5 sm:p-4 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.03] flex items-center justify-between gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setSelectedNoticeId(null)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-xs font-black text-slate-800 dark:text-white transition-all cursor-pointer active:scale-95"
                            >
                                <ArrowLeft className="w-3.5 h-3.5"/>
                                <span>목록으로 돌아가기</span>
                            </button>

                            <a
                                href={`http://its.wonju.go.kr/center/noticeView.do?bdIdx=${selectedNoticeId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                <span>원문 보기</span>
                                <ExternalLink className="w-3 h-3"/>
                            </a>
                        </div>
                    </div>
                ) : (
                    /* List View */
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Search & Tabs Row */}
                        <div
                            className="p-3 sm:p-4 border-b border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-[#121620]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
                            {/* Tab Pills */}
                            <div
                                className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-xs font-bold shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("ALL")}
                                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                        activeTab === "ALL"
                                            ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-2xs font-black"
                                            : "text-slate-500 dark:text-slate-400"
                                    }`}
                                >
                                    전체 ({listData?.totalCount || 0})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("PINNED")}
                                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                        activeTab === "PINNED"
                                            ? "bg-amber-500 text-white shadow-2xs font-black"
                                            : "text-slate-500 dark:text-slate-400"
                                    }`}
                                >
                                    중요 공지
                                </button>
                            </div>

                            {/* Search Form */}
                            <form
                                onSubmit={handleSearchSubmit}
                                className="relative flex-1 max-w-sm"
                            >
                                <Search
                                    className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    placeholder="공지 검색 (예: 요금, 30번, 변경)..."
                                    className="w-full pl-8 pr-12 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-transparent focus:border-amber-500/50 text-slate-900 dark:text-white outline-none font-medium"
                                />
                                <button
                                    type="submit"
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[11px] font-bold cursor-pointer"
                                >
                                    검색
                                </button>
                            </form>
                        </div>

                        {/* Notice List Items */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-2">
                            {isListLoading ? (
                                <div className="space-y-2 animate-pulse">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div
                                            key={i}
                                            className="p-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 space-y-2"
                                        >
                                            <div className="h-4 bg-slate-200 dark:bg-white/10 rounded-md w-3/4"/>
                                            <div className="h-3 bg-slate-200 dark:bg-white/10 rounded-md w-1/4"/>
                                        </div>
                                    ))}
                                </div>
                            ) : filteredNotices.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 text-xs">
                                    등록된 공지사항이 없습니다.
                                </div>
                            ) : (
                                filteredNotices.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedNoticeId(item.id)}
                                        className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5 hover:border-amber-500/50 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-all cursor-pointer flex items-center justify-between gap-3 group active:scale-[0.99]"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                {item.isNotice ? (
                                                    <span
                                                        className="px-2 py-0.5 rounded-md bg-amber-500 text-white font-black text-[10px] shrink-0 shadow-2xs">
                            공지
                          </span>
                                                ) : (
                                                    <span
                                                        className="font-mono font-bold text-slate-400 text-xs shrink-0 w-7">
                            {item.num}
                          </span>
                                                )}
                                                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                                    {item.title}
                                                </h4>
                                                {item.hasFile && (
                                                    <Paperclip className="w-3 h-3 text-slate-400 shrink-0"/>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                                <span>{item.date}</span>
                                                <span>·</span>
                                                <span>조회수 {item.views}</span>
                                            </div>
                                        </div>
                                        <ChevronRight
                                            className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0"/>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div
                                className="p-3 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.03] flex items-center justify-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    className="p-1.5 rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 disabled:opacity-30 cursor-pointer"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5"/>
                                </button>
                                <span className="text-xs font-black text-slate-700 dark:text-slate-300 font-mono">
                  {page} / {totalPages}
                </span>
                                <button
                                    type="button"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    className="p-1.5 rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 disabled:opacity-30 cursor-pointer"
                                >
                                    <ChevronRight className="w-3.5 h-3.5"/>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
