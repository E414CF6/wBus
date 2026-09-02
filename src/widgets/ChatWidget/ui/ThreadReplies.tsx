import type {CommentItem} from "@entities/comment";
import {formatRelativeTime} from "@shared/lib/timeUtils";
import {Ban, Heart, MessageCircle, Trash2} from "lucide-react";
import React from "react";
import {getAvatarGradient} from "../utils/avatarUtils";
import {renderRichContent} from "../utils/textParser";

interface ThreadRepliesProps {
    replies: CommentItem[];
    rootThreadId: string;
    likedCommentIds: Set<string>;
    deletingId: string | null;
    isMyComment: (comment: CommentItem) => boolean;
    onLike: (id: string) => Promise<void>;
    onStartReply: (targetComment: CommentItem, rootThreadId: string) => void;
    onDelete: (id: string) => Promise<void>;
    onHashtagClick: (tag: string) => void;
}

export const ThreadReplies: React.FC<ThreadRepliesProps> = ({
                                                                replies,
                                                                rootThreadId,
                                                                likedCommentIds,
                                                                deletingId,
                                                                isMyComment,
                                                                onLike,
                                                                onStartReply,
                                                                onDelete,
                                                                onHashtagClick,
                                                            }) => {
    return (
        <div className="mt-3 pl-6 sm:pl-10 space-y-2 border-l-2 border-slate-100 dark:border-white/5 animate-fadeIn">
            {replies.map((reply) => {
                const isReplyLiked = likedCommentIds.has(reply.id);
                const isReplyMine = isMyComment(reply);

                return (
                    <div
                        key={reply.id}
                        id={`comment-${reply.id}`}
                        className={`p-3 rounded-2xl border transition-all ${
                            reply.isDeleted
                                ? "bg-slate-50/50 dark:bg-white/[0.01] border-slate-200/40 dark:border-white/5 opacity-50"
                                : "bg-slate-50/80 dark:bg-white/[0.02] border-slate-200/60 dark:border-white/5"
                        }`}
                    >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                                <div
                                    className={`w-6 h-6 rounded-xl bg-gradient-to-tr ${getAvatarGradient(
                                        reply.author,
                                        reply.authorTag
                                    )} text-white flex items-center justify-center font-black text-[11px] shrink-0`}
                                >
                                    {reply.author.charAt(0) || "U"}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                                        {reply.author}
                                    </span>
                                    {reply.authorTag && (
                                        <span className="text-[10px] font-mono text-slate-400">
                                            #{reply.authorTag}
                                        </span>
                                    )}
                                    {isReplyMine && (
                                        <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400">
                                            (내 댓글)
                                        </span>
                                    )}
                                    <span className="text-[10px] text-slate-400">
                                        {formatRelativeTime(reply.createdAt)}
                                    </span>
                                </div>
                            </div>

                            {/* Reply delete button */}
                            {isReplyMine && !reply.isDeleted && (
                                <button
                                    onClick={() => onDelete(reply.id)}
                                    disabled={deletingId === reply.id}
                                    className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                >
                                    <Trash2 className="w-3 h-3"/>
                                </button>
                            )}
                        </div>

                        {/* Reply content & target author mention */}
                        <div
                            className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed pl-8 break-words whitespace-pre-wrap">
                            {reply.isDeleted ? (
                                <span className="italic text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                    <Ban className="w-3 h-3"/>
                                    삭제된 답글입니다.
                                </span>
                            ) : (
                                <>
                                    {reply.replyToAuthor && (
                                        <span className="text-indigo-600 dark:text-indigo-400 font-bold mr-1.5">
                                            @{reply.replyToAuthor}
                                        </span>
                                    )}
                                    {renderRichContent(reply.content, onHashtagClick)}
                                </>
                            )}
                        </div>

                        {/* Reply actions */}
                        <div className="flex items-center justify-between pt-1.5 pl-8 mt-1">
                            <button
                                onClick={() => onLike(reply.id)}
                                disabled={isReplyLiked || reply.isDeleted}
                                className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                    isReplyLiked
                                        ? "text-rose-600 dark:text-rose-400 font-black"
                                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                }`}
                            >
                                <Heart
                                    className={`w-3 h-3 ${isReplyLiked ? "fill-current" : ""}`}
                                />
                                <span className="font-mono">{reply.likes || 0}</span>
                            </button>

                            {!reply.isDeleted && (
                                <button
                                    onClick={() => onStartReply(reply, rootThreadId)}
                                    className="text-[11px] font-bold text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer flex items-center gap-1"
                                >
                                    <MessageCircle className="w-3 h-3"/>
                                    <span>답글</span>
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
