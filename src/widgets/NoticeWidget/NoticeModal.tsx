"use client";

import React, {useState, useSyncExternalStore} from "react";
import {createPortal} from "react-dom";
import {useNoticeDetail, useNoticeList} from "@entities/notice/hooks";
import {UI_TEXT} from "@shared/config/locale";
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

const emptySubscribe = () => () => {
};

interface NoticeModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialNoticeId?: string | null;
}

export default function NoticeModal({isOpen, onClose, initialNoticeId = null}: NoticeModalProps) {
    const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
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

    const notices = listData?.notices ?? [];
    const totalPages = listData?.totalPages || (listData?.totalCount ? Math.ceil(listData.totalCount / 10) : 1);

    if (!isOpen || !isClient) return null;

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/40 dark:bg-black/70 backdrop-blur-md animate-fade-in pointer-events-auto"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notice-modal-title"
        >
            <div
                className="
                    relative flex flex-col w-full max-w-2xl h-[88vh] max-h-[780px] 
                    bg-white/95 dark:bg-[#121212]/95 backdrop-blur-3xl 
                    border border-black/10 dark:border-white/10 
                    shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.7)] 
                    rounded-[32px] overflow-hidden transition-all duration-300
                "
            >
                {/* Header */}
                <header
                    className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/5 bg-white/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        {selectedNoticeId ? (
                            <button
                                type="button"
                                onClick={handleBackToList}
                                className="flex items-center justify-center w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
                                aria-label={UI_TEXT.NOTICE.BACK_TO_LIST}
                            >
                                <ArrowLeft className="w-4 h-4"/>
                            </button>
                        ) : (
                            <div
                                className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-500/10 text-amber-600 dark:bg-amber-400/20 dark:text-amber-400">
                                <Megaphone className="w-5 h-5"/>
                            </div>
                        )}
                        <div>
                            <h2 id="notice-modal-title"
                                className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                                {selectedNoticeId ? (detailNotice?.title ? detailNotice.title : UI_TEXT.NOTICE.SECTION_TITLE) : UI_TEXT.NOTICE.WIDGET_TITLE}
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {UI_TEXT.NOTICE.SUBTITLE}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <a
                            href="http://its.wonju.go.kr/center/notice.do"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 text-gray-700 dark:text-gray-200 transition-colors"
                            title={UI_TEXT.NOTICE.OFFICIAL_LINK}
                        >
                            <span className="truncate">{UI_TEXT.NOTICE.OFFICIAL_LINK}</span>
                            <ExternalLink className="w-3.5 h-3.5 opacity-70"/>
                        </a>

                        <button
                            type="button"
                            onClick={onClose}
                            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
                            aria-label={UI_TEXT.ACCESSIBILITY.CLOSE_MODAL}
                        >
                            <X className="w-5 h-5"/>
                        </button>
                    </div>
                </header>

                {/* Body Area */}
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
                            <div className="p-4 border-b border-black/5 dark:border-white/5 space-y-3">
                                <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                                    <Search className="absolute left-3.5 w-4 h-4 text-gray-400 pointer-events-none"/>
                                    <input
                                        type="text"
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        placeholder={UI_TEXT.NOTICE.SEARCH_PLACEHOLDER}
                                        className="
                      w-full pl-10 pr-20 py-2.5 text-sm rounded-2xl
                      bg-gray-100 dark:bg-white/5 border border-transparent focus:border-amber-500/50 focus:bg-white dark:focus:bg-black/50 
                      text-gray-900 dark:text-white placeholder-gray-400 outline-none transition-all
                    "
                                    />
                                    <div className="absolute right-2 flex items-center gap-1">
                                        {searchInput && (
                                            <button
                                                type="button"
                                                onClick={handleClearSearch}
                                                className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                                            >
                                                <X className="w-3.5 h-3.5"/>
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            className="px-3 py-1 text-xs font-semibold rounded-xl bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity cursor-pointer"
                                        >
                                            {UI_TEXT.NOTICE.SEARCH_BUTTON}
                                        </button>
                                    </div>
                                </form>

                                <div className="flex items-center justify-between pt-0.5">
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                        {listData?.totalCount ? UI_TEXT.NOTICE.TOTAL_COUNT_FORMAT(listData.totalCount) : UI_TEXT.NOTICE.TOTAL_COUNT_LABEL}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() => refresh()}
                                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer"
                                        title={UI_TEXT.NOTICE.REFRESH}
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${listLoading ? "animate-spin" : ""}`}/>
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
                                        className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
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
                                        className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                                        <FileText className="w-10 h-10 stroke-[1.5] mb-2 opacity-50"/>
                                        <p className="text-sm font-medium">{UI_TEXT.NOTICE.NO_NOTICES}</p>
                                    </div>
                                ) : (
                                    notices.map((notice) => (
                                        <div
                                            key={notice.id}
                                            onClick={() => handleSelectNotice(notice.id)}
                                            className={`
                        group relative flex flex-col p-3.5 rounded-2xl cursor-pointer
                        border transition-all duration-200
                        ${
                                                notice.isNotice
                                                    ? "bg-amber-500/5 dark:bg-amber-400/5 border-amber-500/20 hover:border-amber-500/40"
                                                    : "bg-gray-50/70 dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15"
                                            }
                        hover:scale-[1.008] active:scale-[0.995]
                      `}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                                    <span
                                                        className={`shrink-0 px-2 py-0.5 text-[11px] font-bold rounded-md ${
                                                            notice.isNotice
                                                                ? "bg-amber-500 text-white shadow-xs"
                                                                : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300"
                                                        }`}
                                                    >
                                                        {notice.isNotice ? UI_TEXT.NOTICE.PINNED_BADGE : `#${notice.num}`}
                                                    </span>
                                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-2 leading-snug">
                                                        {notice.title}
                                                    </h3>
                                                </div>

                                                {notice.hasFile && (
                                                    <div
                                                        className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-gray-200/60 dark:bg-white/10 text-gray-500 dark:text-gray-400"
                                                        title={UI_TEXT.NOTICE.ATTACHMENT_EXIST_TITLE}
                                                    >
                                                        <Paperclip className="w-3 h-3"/>
                                                    </div>
                                                )}
                                            </div>

                                            <div
                                                className="flex items-center justify-between mt-2.5 pt-2 border-t border-black/4 dark:border-white/4 text-[11px] text-gray-400 dark:text-gray-500">
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
                                    className="flex items-center justify-between px-5 py-3 border-t border-black/5 dark:border-white/5 bg-white/30 dark:bg-white/[0.02]">
                                    <button
                                        type="button"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 disabled:opacity-30 disabled:pointer-events-none hover:bg-gray-200 dark:hover:bg-white/20 transition-colors cursor-pointer"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5"/>
                                        {UI_TEXT.NOTICE.PREV_PAGE}
                                    </button>

                                    <span className="text-xs text-gray-500 font-medium">
                                        {UI_TEXT.NOTICE.PAGE_FORMAT(page, totalPages)}
                                    </span>

                                    <button
                                        type="button"
                                        disabled={page >= totalPages}
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 disabled:opacity-30 disabled:pointer-events-none hover:bg-gray-200 dark:hover:bg-white/20 transition-colors cursor-pointer"
                                    >
                                        {UI_TEXT.NOTICE.NEXT_PAGE}
                                        <ChevronRight className="w-3.5 h-3.5"/>
                                    </button>
                                </footer>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
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
    if (loading) {
        return (
            <div className="flex flex-col h-full p-6 space-y-4 animate-pulse">
                <div className="h-6 w-3/4 bg-gray-200 dark:bg-white/10 rounded-lg"/>
                <div className="h-4 w-1/3 bg-gray-200 dark:bg-white/10 rounded-lg"/>
                <div className="h-32 w-full bg-gray-200 dark:bg-white/10 rounded-2xl mt-4"/>
            </div>
        );
    }

    if (error || !notice) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <p className="text-sm text-gray-500">{UI_TEXT.NOTICE.ERROR_FETCH_DETAIL}</p>
                <button
                    type="button"
                    onClick={onBack}
                    className="mt-4 px-4 py-2 text-xs font-semibold rounded-xl bg-black dark:bg-white text-white dark:text-black cursor-pointer"
                >
                    {UI_TEXT.NOTICE.BACK_TO_LIST}
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto px-5 py-5 custom-scrollbar space-y-5">
                {/* Meta Information Bar */}
                <div
                    className="p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-3">
                    <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-snug">
                        {notice.title}
                    </h1>

                    <div
                        className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-black/5 dark:border-white/5">
                        <div className="flex items-center gap-1.5">
                            <span
                                className="font-medium text-gray-700 dark:text-gray-300">{UI_TEXT.NOTICE.WRITER}:</span>
                            <span>{notice.writer || UI_TEXT.NOTICE.DEFAULT_WRITER}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-700 dark:text-gray-300">{UI_TEXT.NOTICE.DATE}:</span>
                            <span>{notice.date}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-700 dark:text-gray-300">{UI_TEXT.NOTICE.HITS}:</span>
                            <span>{notice.views}</span>
                        </div>
                    </div>
                </div>

                {/* Attachments Section */}
                {notice.files && notice.files.length > 0 && (
                    <div
                        className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-400/5 border border-amber-500/20 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                            <Paperclip className="w-4 h-4"/>
                            <span>{UI_TEXT.NOTICE.ATTACHMENT_COUNT(notice.files.length)}</span>
                        </div>
                        <div className="space-y-1.5 pt-1">
                            {notice.files.map((file, idx) => (
                                <a
                                    key={idx}
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download
                                    className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-white/10 hover:bg-amber-500/10 transition-colors text-xs font-medium text-gray-800 dark:text-gray-200 group"
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
                    className="p-5 rounded-2xl bg-white dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-sans space-y-3">
                    <div
                        className="prose dark:prose-invert max-w-none break-words overflow-x-auto space-y-2"
                        dangerouslySetInnerHTML={{__html: notice.content}}
                    />
                </div>

                {/* Prev / Next Notice Links */}
                {(notice.prevId || notice.nextId) && (
                    <div
                        className="p-3 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-2 text-xs">
                        {notice.prevId && (
                            <div
                                onClick={() => onSelectNotice(notice.prevId!)}
                                className="flex items-center gap-2 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
                            >
                                <span
                                    className="shrink-0 font-bold text-amber-600 dark:text-amber-400">{UI_TEXT.NOTICE.PREV_NOTICE}</span>
                                <span
                                    className="truncate text-gray-700 dark:text-gray-300">{notice.prevTitle || notice.prevId}</span>
                            </div>
                        )}
                        {notice.nextId && (
                            <div
                                onClick={() => onSelectNotice(notice.nextId!)}
                                className="flex items-center gap-2 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
                            >
                                <span
                                    className="shrink-0 font-bold text-amber-600 dark:text-amber-400">{UI_TEXT.NOTICE.NEXT_NOTICE}</span>
                                <span
                                    className="truncate text-gray-700 dark:text-gray-300">{notice.nextTitle || notice.nextId}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Actions */}
            <footer
                className="flex items-center justify-between px-5 py-3 border-t border-black/5 dark:border-white/5 bg-white/30 dark:bg-white/[0.02]">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity cursor-pointer"
                >
                    <ArrowLeft className="w-3.5 h-3.5"/>
                    {UI_TEXT.NOTICE.BACK_TO_LIST}
                </button>

                <a
                    href={`http://its.wonju.go.kr/center/noticeView.do?bdIdx=${id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
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
                <div key={i} className="p-3.5 rounded-2xl bg-gray-100 dark:bg-white/5 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-white/10 rounded-md w-3/4"/>
                    <div className="h-3 bg-gray-200 dark:bg-white/10 rounded-md w-1/4"/>
                </div>
            ))}
        </div>
    );
}
