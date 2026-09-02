import type {CommentItem} from "@entities/comment";
import {formatRelativeTime} from "@shared/lib/timeUtils";
import {Ban, Clock, Heart, MessageCircle, Share2, Trash2} from "lucide-react";
import React from "react";
import type {ReplyTarget} from "../types";
import {getAvatarGradient} from "../utils/avatarUtils";
import {renderRichContent} from "../utils/textParser";
import {InlineReplyComposer} from "./InlineReplyComposer";
import {ThreadReplies} from "./ThreadReplies";

interface ThreadCardProps {
    thread: CommentItem;
    replies: CommentItem[];
    isLiked: boolean;
    isMine: boolean;
    isReplyOpen: boolean;
    deletingId: string | null;
    likedCommentIds: Set<string>;
    inlineReplyTarget: ReplyTarget | null;
    inlineReplyContent: string;
    isSubmittingReply: boolean;
    cooldown: number;
    inlineReplyTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
    isMyComment: (comment: CommentItem) => boolean;
    onLike: (id: string) => Promise<void>;
    onStartReply: (targetComment: CommentItem, rootThreadId: string) => void;
    onCancelReply: () => void;
    onPostReply: () => Promise<void>;
    onInlineReplyContentChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onDelete: (id: string) => Promise<void>;
    onShare: (thread: CommentItem) => void;
    onHashtagClick?: (tag: string) => void;
}

export const ThreadCard: React.FC<ThreadCardProps> = ({
                                                          thread,
                                                          replies,
                                                          isLiked,
                                                          isMine,
                                                          isReplyOpen,
                                                          deletingId,
                                                          likedCommentIds,
                                                          inlineReplyTarget,
                                                          inlineReplyContent,
                                                          isSubmittingReply,
                                                          cooldown,
                                                          inlineReplyTextareaRef,
                                                          isMyComment,
                                                          onLike,
                                                          onStartReply,
                                                          onCancelReply,
                                                          onPostReply,
                                                          onInlineReplyContentChange,
                                                          onDelete,
                                                          onShare,
                                                          onHashtagClick,
                                                      }) => {
    return (
        <div
            id={`thread-${thread.id}`}
            className={`p-4 rounded-3xl border transition-all ${
                thread.isDeleted
                    ? "bg-slate-50/50 dark:bg-white/[0.01] border-slate-200/50 dark:border-white/5 opacity-60"
                    : "bg-white dark:bg-[#151b28] border-slate-200/80 dark:border-white/5 shadow-xs hover:border-indigo-500/30 dark:hover:border-indigo-500/30"
            }`}
        >
            {/* Thread Header */}
            <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div
                        className={`w-9 h-9 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(
                            thread.author,
                            thread.authorTag
                        )} text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0`}
                    >
                        {thread.author.charAt(0) || "U"}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                                {thread.author}
                            </span>
                            {thread.authorTag && (
                                <span
                                    className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 font-mono text-[10px] font-bold">
                                    #{thread.authorTag}
                                </span>
                            )}
                            {isMine && (
                                <span
                                    className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black border border-indigo-200 dark:border-indigo-500/30">
                                    내 글
                                </span>
                            )}
                        </div>
                        <div
                            className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3"/>
                            <span>{formatRelativeTime(thread.createdAt)}</span>
                        </div>
                    </div>
                </div>

                {/* Actions: Share & Delete */}
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={() => onShare(thread)}
                        title="공유"
                        className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                        <Share2 className="w-3.5 h-3.5"/>
                    </button>
                    {isMine && !thread.isDeleted && (
                        <button
                            onClick={() => onDelete(thread.id)}
                            disabled={deletingId === thread.id}
                            title="삭제"
                            className="p-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                            <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                    )}
                </div>
            </div>

            {/* Content Body */}
            <div
                className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed mb-3 break-words whitespace-pre-wrap pl-11">
                {thread.isDeleted ? (
                    <span className="italic text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Ban className="w-3.5 h-3.5"/>
                        삭제된 글입니다.
                    </span>
                ) : (
                    renderRichContent(thread.content, onHashtagClick)
                )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-white/5 pt-2 pl-11">
                <div className="flex items-center gap-2">
                    {/* Like Button */}
                    <button
                        onClick={() => onLike(thread.id)}
                        disabled={isLiked || thread.isDeleted}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            isLiked
                                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-black"
                                : "hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-slate-400"
                        }`}
                    >
                        <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-current" : ""}`}/>
                        <span className="font-mono">{thread.likes || 0}</span>
                    </button>

                    {/* Direct Reply Start */}
                    {!thread.isDeleted && (
                        <button
                            onClick={() => onStartReply(thread, thread.id)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                            <MessageCircle className="w-3.5 h-3.5"/>
                            <span className="font-mono">{replies.length}</span>
                            <span className="text-[10px] hidden sm:inline">답글</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Inline Nested Reply Form */}
            {inlineReplyTarget && isReplyOpen && (
                <InlineReplyComposer
                    replyTarget={inlineReplyTarget}
                    defaultTargetAuthor={thread.author}
                    inlineReplyContent={inlineReplyContent}
                    isSubmittingReply={isSubmittingReply}
                    cooldown={cooldown}
                    textareaRef={inlineReplyTextareaRef}
                    onContentChange={onInlineReplyContentChange}
                    onCancel={onCancelReply}
                    onSubmit={onPostReply}
                />
            )}

            {/* Nested Replies List */}
            {replies.length > 0 && (
                <ThreadReplies
                    replies={replies}
                    rootThreadId={thread.id}
                    likedCommentIds={likedCommentIds}
                    deletingId={deletingId}
                    isMyComment={isMyComment}
                    onLike={onLike}
                    onStartReply={onStartReply}
                    onDelete={onDelete}
                    onHashtagClick={onHashtagClick || (() => {
                    })}
                />
            )}
        </div>
    );
};
