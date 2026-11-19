"use client";

import React, {useState} from "react";
import {
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    MessageSquare,
    MessageSquarePlus,
    RotateCcw,
    Send,
    User,
} from "lucide-react";
import {useWikiDiscussions, type WikiDiscussionStatus, type WikiDiscussionThread,} from "@entities/wiki";
import {LOCALE, UI_TEXT} from "@shared/config/locale";
import {WikiMarkdownRenderer} from "./WikiMarkdownRenderer";

export interface WikiDiscussionPanelProps {
    slug: string;
    initialNickname: string;
    onSaveNickname: (nickname: string) => void;
    onOpenWikiSlug?: (targetSlug: string) => void;
    onSelectRoute?: (routeNo: string, cityCode: string) => void;
}

function formatDiscussionTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(LOCALE, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export const WikiDiscussionPanel: React.FC<WikiDiscussionPanelProps> = ({
                                                                            slug,
                                                                            initialNickname,
                                                                            onSaveNickname,
                                                                            onOpenWikiSlug,
                                                                            onSelectRoute,
                                                                        }) => {
    const [statusFilter, setStatusFilter] = useState<WikiDiscussionStatus | "all">("all");
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
    const [nickname, setNickname] = useState(initialNickname);

    // New thread form state
    const [newTitle, setNewTitle] = useState("");
    const [newBody, setNewBody] = useState("");
    const [newBodyPreview, setNewBodyPreview] = useState(false);
    const [honeypot, setHoneypot] = useState("");
    const [isSubmittingThread, setIsSubmittingThread] = useState(false);
    const [composerError, setComposerError] = useState<string | null>(null);

    // Per-thread reply & status action states
    const [replyInputs, setReplyInputs] = useState<Record<number, string>>({});
    const [submittingReplyId, setSubmittingReplyId] = useState<number | null>(null);
    const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
    const [threadErrors, setThreadErrors] = useState<Record<number, string>>({});

    const {data, isLoading, error, mutate} = useWikiDiscussions(slug, true, statusFilter);

    const threads = data?.threads ?? [];
    const openCount = data?.openCount ?? 0;
    const resolvedCount = data?.resolvedCount ?? 0;

    const isExpanded = (thread: WikiDiscussionThread, idx: number): boolean => {
        if (thread.id in expandedIds) {
            return expandedIds[thread.id];
        }
        return idx === 0 && thread.status === "open";
    };

    const toggleExpand = (threadId: number, currentOpen: boolean) => {
        setExpandedIds((prev) => ({...prev, [threadId]: !currentOpen}));
    };

    const handleCreateThread = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmittingThread) return;

        setIsSubmittingThread(true);
        setComposerError(null);
        try {
            const res = await fetch(`/api/wiki/${encodeURIComponent(slug)}/discussions`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    title: newTitle.trim(),
                    body: newBody.trim(),
                    nickname: nickname.trim(),
                    website: honeypot,
                }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                setComposerError(body?.error || UI_TEXT.WIKI.DISCUSSION.CREATE_FAILED_STATUS(res.status));
                return;
            }
            if (nickname.trim()) {
                onSaveNickname(nickname.trim());
            }
            const createdId = body?.thread?.id as number | undefined;
            setNewTitle("");
            setNewBody("");
            setNewBodyPreview(false);
            setIsComposerOpen(false);
            if (createdId) {
                setExpandedIds((prev) => ({...prev, [createdId]: true}));
            }
            await mutate();
        } catch (err) {
            setComposerError(
                err instanceof Error ? err.message : UI_TEXT.WIKI.DISCUSSION.CREATE_FAILED_NETWORK,
            );
        } finally {
            setIsSubmittingThread(false);
        }
    };

    const handleAddReply = async (threadId: number) => {
        const replyText = (replyInputs[threadId] ?? "").trim();
        if (!replyText || submittingReplyId !== null) return;

        setSubmittingReplyId(threadId);
        setThreadErrors((prev) => {
            const next = {...prev};
            delete next[threadId];
            return next;
        });

        try {
            const res = await fetch(
                `/api/wiki/${encodeURIComponent(slug)}/discussions/${threadId}/comments`,
                {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        body: replyText,
                        nickname: nickname.trim(),
                        website: honeypot,
                    }),
                },
            );
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                setThreadErrors((prev) => ({
                    ...prev,
                    [threadId]: body?.error || UI_TEXT.WIKI.DISCUSSION.REPLY_FAILED_STATUS(res.status),
                }));
                return;
            }
            if (nickname.trim()) {
                onSaveNickname(nickname.trim());
            }
            setReplyInputs((prev) => ({...prev, [threadId]: ""}));
            await mutate();
        } catch (err) {
            setThreadErrors((prev) => ({
                ...prev,
                [threadId]:
                    err instanceof Error ? err.message : UI_TEXT.WIKI.DISCUSSION.REPLY_FAILED_ERROR,
            }));
        } finally {
            setSubmittingReplyId(null);
        }
    };

    const handleToggleStatus = async (thread: WikiDiscussionThread) => {
        if (updatingStatusId !== null) return;
        const nextStatus: WikiDiscussionStatus =
            thread.status === "open" ? "resolved" : "open";

        setUpdatingStatusId(thread.id);
        setThreadErrors((prev) => {
            const next = {...prev};
            delete next[thread.id];
            return next;
        });

        try {
            const res = await fetch(
                `/api/wiki/${encodeURIComponent(slug)}/discussions/${thread.id}`,
                {
                    method: "PATCH",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        status: nextStatus,
                        nickname: nickname.trim(),
                    }),
                },
            );
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                setThreadErrors((prev) => ({
                    ...prev,
                    [thread.id]: body?.error || UI_TEXT.WIKI.DISCUSSION.STATUS_FAILED_STATUS(res.status),
                }));
                return;
            }
            if (nickname.trim()) {
                onSaveNickname(nickname.trim());
            }
            await mutate();
        } catch (err) {
            setThreadErrors((prev) => ({
                ...prev,
                [thread.id]:
                    err instanceof Error ? err.message : UI_TEXT.WIKI.DISCUSSION.STATUS_FAILED_ERROR,
            }));
        } finally {
            setUpdatingStatusId(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Top Controls: Filters + Nickname + New Thread Button */}
            <div
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-3.5 sm:p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                    {(
                        [
                            {id: "all", label: UI_TEXT.WIKI.DISCUSSION.TAB_ALL(openCount + resolvedCount)},
                            {id: "open", label: UI_TEXT.WIKI.DISCUSSION.TAB_OPEN(openCount)},
                            {id: "resolved", label: UI_TEXT.WIKI.DISCUSSION.TAB_RESOLVED(resolvedCount)},
                        ] as const
                    ).map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setStatusFilter(tab.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                                statusFilter === tab.id
                                    ? "bg-[#003876] dark:bg-sky-600 text-white shadow-xs"
                                    : "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.12]"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 ml-auto">
                    <div className="relative flex items-center">
                        <User className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none"/>
                        <input
                            type="text"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            maxLength={24}
                            aria-label={UI_TEXT.WIKI.DISCUSSION.NICKNAME_ARIA}
                            placeholder={UI_TEXT.WIKI.DISCUSSION.NICKNAME_PLACEHOLDER}
                            className="w-32 sm:w-36 pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setIsComposerOpen((v) => !v);
                            setComposerError(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xs transition cursor-pointer"
                    >
                        <MessageSquarePlus className="w-3.5 h-3.5"/>
                        <span>{isComposerOpen ? UI_TEXT.WIKI.DISCUSSION.CLOSE_COMPOSER : UI_TEXT.WIKI.DISCUSSION.NEW_TOPIC}</span>
                    </button>
                </div>
            </div>

            {/* New Thread Composer */}
            {isComposerOpen && (
                <form
                    onSubmit={handleCreateThread}
                    className="rounded-2xl border border-emerald-200 dark:border-emerald-800/70 bg-white dark:bg-slate-900/95 p-4 sm:p-5 shadow-sm space-y-3.5"
                >
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">
                            {UI_TEXT.WIKI.DISCUSSION.COMPOSER_TITLE}
                        </h3>
                        <button
                            type="button"
                            onClick={() => setNewBodyPreview((v) => !v)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                            {newBodyPreview ? UI_TEXT.WIKI.DISCUSSION.EDIT_TAB : UI_TEXT.WIKI.DISCUSSION.PREVIEW_TAB}
                        </button>
                    </div>

                    {/* Honeypot */}
                    <div className="sr-only" aria-hidden="true">
                        <input
                            type="text"
                            name="website"
                            tabIndex={-1}
                            autoComplete="off"
                            value={honeypot}
                            onChange={(e) => setHoneypot(e.target.value)}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="wiki-discussion-title"
                            className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                        >
                            {UI_TEXT.WIKI.DISCUSSION.TITLE_LABEL}
                        </label>
                        <input
                            id="wiki-discussion-title"
                            type="text"
                            required
                            minLength={2}
                            maxLength={120}
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder={UI_TEXT.WIKI.DISCUSSION.TITLE_PLACEHOLDER}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="wiki-discussion-body"
                            className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                        >
                            {UI_TEXT.WIKI.DISCUSSION.BODY_LABEL}
                        </label>
                        {newBodyPreview ? (
                            <div
                                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 min-h-[120px]">
                                {newBody.trim() ? (
                                    <WikiMarkdownRenderer markdown={newBody}/>
                                ) : (
                                    <p className="text-xs text-slate-400">{UI_TEXT.WIKI.DISCUSSION.EMPTY_PREVIEW}</p>
                                )}
                            </div>
                        ) : (
                            <textarea
                                id="wiki-discussion-body"
                                required
                                minLength={2}
                                maxLength={4000}
                                rows={4}
                                value={newBody}
                                onChange={(e) => setNewBody(e.target.value)}
                                placeholder={UI_TEXT.WIKI.DISCUSSION.BODY_PLACEHOLDER}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                            />
                        )}
                    </div>

                    {composerError && (
                        <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                            {composerError}
                        </p>
                    )}

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setIsComposerOpen(false)}
                            className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                            {UI_TEXT.COMMON.CANCEL}
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmittingThread}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition cursor-pointer disabled:opacity-50"
                        >
                            <Send className="w-3.5 h-3.5"/>
                            <span>{isSubmittingThread ? UI_TEXT.WIKI.DISCUSSION.SUBMITTING : UI_TEXT.WIKI.DISCUSSION.SUBMIT_BTN}</span>
                        </button>
                    </div>
                </form>
            )}

            {/* Thread List */}
            {isLoading && !data ? (
                <div
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-8 text-center text-xs font-semibold text-slate-500">
                    {UI_TEXT.WIKI.DISCUSSION.LOADING}
                </div>
            ) : error ? (
                <div
                    className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-5 text-xs font-bold text-rose-700 dark:text-rose-200">
                    {UI_TEXT.WIKI.DISCUSSION.LOAD_FAILED(error.message)}
                </div>
            ) : threads.length === 0 ? (
                <div
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-10 text-center space-y-2.5">
                    <MessageSquare className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600"/>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {statusFilter === "all"
                            ? UI_TEXT.WIKI.DISCUSSION.EMPTY_ALL
                            : UI_TEXT.WIKI.DISCUSSION.EMPTY_FILTERED}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {threads.map((thread, idx) => {
                        const expanded = isExpanded(thread, idx);
                        const isResolved = thread.status === "resolved";
                        const replyText = replyInputs[thread.id] ?? "";
                        const threadErr = threadErrors[thread.id];

                        return (
                            <div
                                key={thread.id}
                                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 overflow-hidden shadow-sm"
                            >
                                <button
                                    type="button"
                                    onClick={() => toggleExpand(thread.id, expanded)}
                                    className="w-full px-4 py-3.5 flex items-start justify-between gap-3 text-left hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition cursor-pointer"
                                >
                                    <div className="min-w-0 space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-black ${
                                                    isResolved
                                                        ? "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                                                        : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                                }`}
                                            >
                                                {isResolved ? (
                                                    <CheckCircle2 className="w-3 h-3"/>
                                                ) : (
                                                    <MessageSquare className="w-3 h-3"/>
                                                )}
                                                {isResolved ? UI_TEXT.WIKI.DISCUSSION.STATUS_RESOLVED : UI_TEXT.WIKI.DISCUSSION.STATUS_OPEN}
                                            </span>
                                            <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white break-words">
                                                {thread.title}
                                            </h4>
                                        </div>

                                        <div
                                            className="flex flex-wrap items-center gap-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                            <span className="inline-flex items-center gap-1">
                                                <User className="w-3 h-3"/>
                                                {thread.author.nickname}
                                            </span>
                                            <span className="inline-flex items-center gap-1">
                                                <Clock className="w-3 h-3"/>
                                                {formatDiscussionTime(thread.lastCommentAt)}
                                            </span>
                                            <span>{UI_TEXT.WIKI.DISCUSSION.COMMENT_COUNT(thread.commentCount)}</span>
                                            {isResolved && thread.resolvedBy && (
                                                <span className="text-slate-400 dark:text-slate-500">
                                                    {UI_TEXT.WIKI.DISCUSSION.RESOLVED_BY(thread.resolvedBy.nickname)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <span className="p-1 text-slate-400 shrink-0">
                                        {expanded ? (
                                            <ChevronUp className="w-4 h-4"/>
                                        ) : (
                                            <ChevronDown className="w-4 h-4"/>
                                        )}
                                    </span>
                                </button>

                                {expanded && (
                                    <div
                                        className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4 space-y-3">
                                        <div className="space-y-2.5">
                                            {thread.comments.map((comment, cIdx) => (
                                                <div
                                                    key={comment.id}
                                                    className={`rounded-xl border p-3 ${
                                                        cIdx === 0
                                                            ? "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                                            : "border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 ml-2 sm:ml-4"
                                                    }`}
                                                >
                                                    <div
                                                        className="flex flex-wrap items-center justify-between gap-2 mb-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                                        <span
                                                            className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200">
                                                            <User className="w-3 h-3"/>
                                                            {comment.author.nickname}
                                                            {cIdx === 0 && (
                                                                <span
                                                                    className="ml-1 px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-950 text-[10px] font-black text-sky-700 dark:text-sky-300">
                                                                    {UI_TEXT.WIKI.DISCUSSION.AUTHOR_BADGE}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span>{formatDiscussionTime(comment.createdAt)}</span>
                                                    </div>
                                                    <div className="text-xs sm:text-[13px]">
                                                        <WikiMarkdownRenderer
                                                            markdown={comment.body}
                                                            onOpenWikiSlug={onOpenWikiSlug}
                                                            onSelectRoute={onSelectRoute}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {threadErr && (
                                            <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                                                {threadErr}
                                            </p>
                                        )}

                                        <div
                                            className="pt-2 border-t border-slate-200/70 dark:border-slate-800 space-y-2.5">
                                            {!isResolved && (
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <textarea
                                                        rows={2}
                                                        maxLength={4000}
                                                        value={replyText}
                                                        onChange={(e) =>
                                                            setReplyInputs((prev) => ({
                                                                ...prev,
                                                                [thread.id]: e.target.value,
                                                            }))
                                                        }
                                                        placeholder={UI_TEXT.WIKI.DISCUSSION.REPLY_PLACEHOLDER}
                                                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                                                    />
                                                    <button
                                                        type="button"
                                                        disabled={
                                                            !replyText.trim() || submittingReplyId !== null
                                                        }
                                                        onClick={() => void handleAddReply(thread.id)}
                                                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#003876] hover:bg-[#00295a] dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-black transition cursor-pointer disabled:opacity-50 shrink-0 self-end sm:self-stretch"
                                                    >
                                                        <Send className="w-3.5 h-3.5"/>
                                                        <span>
                                                            {submittingReplyId === thread.id
                                                                ? UI_TEXT.WIKI.DISCUSSION.REPLY_SUBMITTING
                                                                : UI_TEXT.WIKI.DISCUSSION.REPLY_BTN}
                                                        </span>
                                                    </button>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[11px] font-medium text-slate-400">
                                                    {isResolved
                                                        ? UI_TEXT.WIKI.DISCUSSION.RESOLVED_HINT
                                                        : UI_TEXT.WIKI.DISCUSSION.OPEN_HINT}
                                                </span>
                                                <button
                                                    type="button"
                                                    disabled={updatingStatusId !== null}
                                                    onClick={() => void handleToggleStatus(thread)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50 shrink-0"
                                                >
                                                    {isResolved ? (
                                                        <>
                                                            <RotateCcw className="w-3 h-3"/>
                                                            <span>{UI_TEXT.WIKI.DISCUSSION.REOPEN_BTN}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600"/>
                                                            <span>{UI_TEXT.WIKI.DISCUSSION.MARK_RESOLVED_BTN}</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
