"use client";

import React, {useMemo, useState} from "react";
import {useNoticeDetail, useNoticeList} from "@entities/notice/hooks";
import {UI_TEXT} from "@shared/config/locale";
import {sanitizeHtml} from "@shared/utils/sanitizer";
import {Modal} from "@shared/ui";
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Download,
    ExternalLink,
    Eye,
    FileText,
    Megaphone,
    Paperclip,
    RefreshCw,
    Search,
    X,
} from "lucide-react";

export interface NoticeModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialNoticeId?: string | null;
    zIndex?: string;
}

export function NoticeModal({
                                isOpen,
                                onClose,
                                initialNoticeId = null,
                                zIndex = "z-[110]",
                            }: NoticeModalProps) {
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState("");
    const [activeSearch, setActiveSearch] = useState("");
    const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(initialNoticeId);
    const [prevInitialNoticeId, setPrevInitialNoticeId] = useState<string | null>(initialNoticeId);

    if (initialNoticeId !== prevInitialNoticeId) {
        setPrevInitialNoticeId(initialNoticeId);
        setSelectedNoticeId(initialNoticeId);
    }

    const {data: listData, loading: listLoading, error: listError, refresh} = useNoticeList(page, activeSearch);
    const {notice: detailNotice, loading: detailLoading, error: detailError} = useNoticeDetail(selectedNoticeId);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setActiveSearch(searchInput);
        setPage(1);
    };

    const handleClearSearch = () => {
        setSearchInput("");
        setActiveSearch("");
        setPage(1);
    };

    const handleSelectNotice = (id: string) => {
        setSelectedNoticeId(id);
    };

    const handleBackToList = () => {
        setSelectedNoticeId(null);
    };

    const handleClose = () => {
        if (selectedNoticeId) {
            setSelectedNoticeId(null);
        } else {
            onClose();
        }
    };

    // When modal closes, reset selection
    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (!isOpen) {
            setSelectedNoticeId(null);
        }
    }

    const notices = listData?.notices ?? [];
    const totalPages = listData?.totalPages || (listData?.totalCount ? Math.ceil(listData.totalCount / 10) : 1);

    const modalLeading = selectedNoticeId ? (
        <button
            type="button"
            onClick={handleBackToList}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
            aria-label={UI_TEXT.NOTICE.BACK_TO_LIST}
        >
            <ArrowLeft className="w-4 h-4"/>
        </button>
    ) : undefined;

    const modalIcon = !selectedNoticeId ? (
        <div
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-400/20 dark:text-amber-400 shrink-0">
            <Megaphone className="w-4.5 h-4.5"/>
        </div>
    ) : undefined;

    const modalTitle = selectedNoticeId
        ? detailNotice?.title
            ? detailNotice.title
            : UI_TEXT.NOTICE.SECTION_TITLE
        : UI_TEXT.NOTICE.WIDGET_TITLE;

    const modalActions = (
        <a
            href="http://its.wonju.go.kr/center/notice.do"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 transition-colors"
            title={UI_TEXT.NOTICE.OFFICIAL_LINK}
        >
            <span className="truncate">{UI_TEXT.NOTICE.OFFICIAL_LINK}</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70"/>
        </a>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={modalTitle}
            subtitle={UI_TEXT.NOTICE.SUBTITLE}
            headerLeading={modalLeading}
            icon={modalIcon}
            headerActions={modalActions}
            maxWidth="2xl"
            height="tall"
            zIndex={zIndex}
            modalId={selectedNoticeId ? `notice-${selectedNoticeId}` : "notice"}
            ariaLabel={UI_TEXT.NOTICE.WIDGET_TITLE}
        >
            <div className="relative flex-1 overflow-hidden flex flex-col">
                {selectedNoticeId ? (
                    /* Detail View */
                    <DetailView
                        id={selectedNoticeId}
                        notice={detailNotice}
                        loading={detailLoading}
                        error={detailError ? String(detailError) : null}
                        onSelectNotice={handleSelectNotice}
                        onBack={handleBackToList}
                    />
                ) : (
                    /* List View */
                    <div className="flex flex-col h-full overflow-hidden">
                        {/* Search and Refresh Bar */}
                        <div className="p-3.5 sm:p-4 border-b border-black/5 dark:border-white/5 space-y-2.5 shrink-0">
                            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                                <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    placeholder={UI_TEXT.NOTICE.SEARCH_PLACEHOLDER}
                                    className="
                                        w-full pl-10 pr-20 py-2 text-xs sm:text-sm rounded-xl
                                        bg-slate-100 dark:bg-white/5 border border-transparent focus:border-amber-500/50 focus:bg-white dark:focus:bg-black/50 
                                        text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all
                                    "
                                />
                                <div className="absolute right-1.5 flex items-center gap-1">
                                    {searchInput && (
                                        <button
                                            type="button"
                                            onClick={handleClearSearch}
                                            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                        >
                                            <X className="w-3.5 h-3.5"/>
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer"
                                    >
                                        {UI_TEXT.NOTICE.SEARCH_BUTTON}
                                    </button>
                                </div>
                            </form>

                            <div className="flex items-center justify-between pt-0.5">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                    {listData?.totalCount ? UI_TEXT.NOTICE.TOTAL_COUNT_FORMAT(listData.totalCount) : UI_TEXT.NOTICE.TOTAL_COUNT_LABEL}
                                </span>

                                <button
                                    type="button"
                                    onClick={() => refresh()}
                                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                                    title={UI_TEXT.NOTICE.REFRESH}
                                >
                                    <RefreshCw
                                        className={`w-3.5 h-3.5 ${listLoading ? "animate-spin text-amber-500" : ""}`}/>
                                    <span>{UI_TEXT.NOTICE.REFRESH}</span>
                                </button>
                            </div>
                        </div>

                        {/* Notice Items List */}
                        <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar space-y-2.5">
                            {listLoading && notices.length === 0 ? (
                                <ListSkeleton/>
                            ) : listError ? (
                                <div
                                    className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
                                    <p className="text-sm">{UI_TEXT.NOTICE.ERROR_FETCH_LIST}</p>
                                    <button
                                        type="button"
                                        onClick={() => refresh()}
                                        className="mt-3 px-4 py-2 text-xs font-semibold rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 transition-colors cursor-pointer"
                                    >
                                        {UI_TEXT.COMMON.RETRY}
                                    </button>
                                </div>
                            ) : notices.length === 0 ? (
                                <div
                                    className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                                    <FileText className="w-10 h-10 stroke-[1.5] mb-2 opacity-50"/>
                                    <p className="text-sm font-medium">{UI_TEXT.NOTICE.NO_NOTICES}</p>
                                </div>
                            ) : (
                                notices.map((notice) => (
                                    <div
                                        key={notice.id}
                                        onClick={() => handleSelectNotice(notice.id)}
                                        className={`
                                            group relative flex flex-col p-3 rounded-2xl cursor-pointer
                                            border transition-all duration-200 select-none
                                            ${
                                            notice.isNotice
                                                ? "bg-amber-500/5 dark:bg-amber-400/5 border-amber-500/20 hover:border-amber-500/40"
                                                : "bg-slate-50/70 dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15"
                                        }
                                            hover:scale-[1.006] active:scale-[0.995]
                                        `}
                                    >
                                        <div className="flex items-start justify-between gap-2.5">
                                            <div className="flex items-start gap-2 flex-1 min-w-0">
                                                <span
                                                    className={`shrink-0 px-2 py-0.5 text-[10px] font-black rounded-md ${
                                                        notice.isNotice
                                                            ? "bg-amber-500 text-white shadow-xs"
                                                            : "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                                                    }`}
                                                >
                                                    {notice.isNotice ? UI_TEXT.NOTICE.PINNED_BADGE : `#${notice.num}`}
                                                </span>
                                                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-2 leading-snug">
                                                    {notice.title}
                                                </h3>
                                            </div>

                                            {notice.hasFile && (
                                                <div
                                                    className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-slate-200/60 dark:bg-white/10 text-slate-500 dark:text-slate-400"
                                                    title={UI_TEXT.NOTICE.ATTACHMENT_EXIST_TITLE}
                                                >
                                                    <Paperclip className="w-3 h-3"/>
                                                </div>
                                            )}
                                        </div>

                                        <div
                                            className="flex items-center justify-between mt-2 pt-1.5 border-t border-black/4 dark:border-white/4 text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                                            <span>{notice.date}</span>
                                            <div className="flex items-center gap-1">
                                                <Eye className="w-3 h-3 opacity-60"/>
                                                <span>{notice.views}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Pagination Controls */}
                        {!selectedNoticeId && totalPages > 1 && (
                            <footer
                                className="flex items-center justify-between px-5 py-3 border-t border-black/5 dark:border-white/5 bg-white/40 dark:bg-white/[0.02] shrink-0">
                                <button
                                    type="button"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-200 dark:hover:bg-white/20 transition-colors cursor-pointer"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5"/>
                                    {UI_TEXT.NOTICE.PREV_PAGE}
                                </button>

                                <span className="text-xs text-slate-500 font-bold font-mono">
                                    {UI_TEXT.NOTICE.PAGE_FORMAT(page, totalPages)}
                                </span>

                                <button
                                    type="button"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-200 dark:hover:bg-white/20 transition-colors cursor-pointer"
                                >
                                    {UI_TEXT.NOTICE.NEXT_PAGE}
                                    <ChevronRight className="w-3.5 h-3.5"/>
                                </button>
                            </footer>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}

interface DetailViewProps {
    id: string;
    notice: ReturnType<typeof useNoticeDetail>["notice"];
    loading: boolean;
    error: string | null;
    onSelectNotice: (id: string) => void;
    onBack: () => void;
}

function DetailView({id, notice, loading, error, onSelectNotice, onBack}: DetailViewProps) {
    const sanitizedContent = useMemo(() => sanitizeHtml(notice?.content), [notice?.content]);

    if (loading) {
        return (
            <div className="flex flex-col h-full p-6 space-y-4 animate-pulse">
                <div className="h-6 w-3/4 bg-slate-200 dark:bg-white/10 rounded-lg"/>
                <div className="h-4 w-1/3 bg-slate-200 dark:bg-white/10 rounded-lg"/>
                <div className="h-32 w-full bg-slate-200 dark:bg-white/10 rounded-2xl mt-4"/>
            </div>
        );
    }

    if (error || !notice) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <p className="text-sm text-slate-500">{UI_TEXT.NOTICE.ERROR_FETCH_DETAIL}</p>
                <button
                    type="button"
                    onClick={onBack}
                    className="mt-3 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 cursor-pointer"
                >
                    {UI_TEXT.NOTICE.BACK_TO_LIST}
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar space-y-4">
                {/* Meta Header */}
                <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-400/5 border border-amber-500/20 space-y-2.5">
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-xs">
                            공지 #{id}
                        </span>
                    </div>

                    <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                        {notice.title}
                    </h1>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 dark:text-slate-400 font-medium pt-1 border-t border-black/5 dark:border-white/5">
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold">{UI_TEXT.NOTICE.WRITER}:</span>
                            <span>{notice.writer || UI_TEXT.NOTICE.DEFAULT_WRITER}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold">{UI_TEXT.NOTICE.DATE}:</span>
                            <span className="font-mono">{notice.date}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold">{UI_TEXT.NOTICE.HITS}:</span>
                            <span className="font-mono">{notice.views}회</span>
                        </div>
                    </div>
                </div>

                {/* Attachments */}
                {notice.files && notice.files.length > 0 && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                            <Paperclip className="w-3.5 h-3.5"/>
                            <span>{UI_TEXT.NOTICE.ATTACHMENT_COUNT(notice.files.length)}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {notice.files.map((file, idx) => (
                                <a
                                    key={idx}
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download
                                    className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-white/10 hover:bg-amber-500/10 transition-colors text-xs font-medium text-slate-800 dark:text-slate-200 group border border-black/5 dark:border-white/5"
                                >
                                    <span className="truncate pr-2">{file.name}</span>
                                    <Download
                                        className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform"/>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Main Content Area */}
                <div
                    className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans space-y-3"
                >
                    <div
                        className="prose dark:prose-invert max-w-none break-words overflow-x-auto space-y-2"
                        dangerouslySetInnerHTML={{__html: sanitizedContent}}
                    />
                </div>

                {/* Prev / Next Notice Links */}
                {(notice.prevId || notice.nextId) && (
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-2 text-xs">
                        {notice.prevId && (
                            <div
                                onClick={() => onSelectNotice(notice.prevId!)}
                                className="flex items-center gap-2 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
                            >
                                <span className="shrink-0 font-bold text-amber-600 dark:text-amber-400">{UI_TEXT.NOTICE.PREV_NOTICE}</span>
                                <span className="truncate text-slate-700 dark:text-slate-300">{notice.prevTitle || notice.prevId}</span>
                            </div>
                        )}
                        {notice.nextId && (
                            <div
                                onClick={() => onSelectNotice(notice.nextId!)}
                                className="flex items-center gap-2 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
                            >
                                <span className="shrink-0 font-bold text-amber-600 dark:text-amber-400">{UI_TEXT.NOTICE.NEXT_NOTICE}</span>
                                <span className="truncate text-slate-700 dark:text-slate-300">{notice.nextTitle || notice.nextId}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Actions */}
            <footer className="flex items-center justify-between px-5 py-3 border-t border-black/5 dark:border-white/5 bg-white/40 dark:bg-white/[0.02] shrink-0">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer"
                >
                    <ArrowLeft className="w-3.5 h-3.5"/>
                    <span>{UI_TEXT.NOTICE.BACK_TO_LIST}</span>
                </button>

                <a
                    href={`http://its.wonju.go.kr/center/noticeView.do?bdIdx=${id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors font-medium"
                >
                    <span>{UI_TEXT.NOTICE.VIEW_ORIGINAL}</span>
                    <ExternalLink className="w-3 h-3"/>
                </a>
            </footer>
        </div>
    );
}

function ListSkeleton() {
    return (
        <div className="space-y-2.5 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-white/10 rounded-md w-3/4"/>
                    <div className="h-3 bg-slate-200 dark:bg-white/10 rounded-md w-1/4"/>
                </div>
            ))}
        </div>
    );
}

export default NoticeModal;
