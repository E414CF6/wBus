import React from "react";
import {CornerDownRight, Send, X} from "lucide-react";
import {ReplyTarget} from "../types";

interface InlineReplyComposerProps {
    replyTarget: ReplyTarget | null;
    defaultTargetAuthor: string;
    inlineReplyContent: string;
    isSubmittingReply: boolean;
    cooldown: number;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    onContentChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onCancel: () => void;
    onSubmit: () => Promise<void>;
}

export const InlineReplyComposer: React.FC<InlineReplyComposerProps> = ({
                                                                            replyTarget,
                                                                            defaultTargetAuthor,
                                                                            inlineReplyContent,
                                                                            isSubmittingReply,
                                                                            cooldown,
                                                                            textareaRef,
                                                                            onContentChange,
                                                                            onCancel,
                                                                            onSubmit,
                                                                        }) => {
    return (
        <div
            className="ml-5 sm:ml-6 pl-3 sm:pl-4 border-l-2 border-blue-500 dark:border-blue-400 pt-2 animate-slideDown">
            <div
                className="p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 space-y-2">
                <div
                    className="flex items-center justify-between text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    <div className="flex items-center gap-1">
                        <CornerDownRight className="w-3 h-3"/>
                        <span>
                            @{replyTarget?.author || defaultTargetAuthor}님에게 답글 작성
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5"/>
                    </button>
                </div>

                <textarea
                    ref={textareaRef}
                    value={inlineReplyContent}
                    onChange={onContentChange}
                    placeholder="답글 내용을 입력하세요..."
                    rows={2}
                    maxLength={300}
                    className="w-full bg-white dark:bg-black/20 rounded-xl p-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none resize-none font-medium border border-blue-200/60 dark:border-blue-800/40"
                />

                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">
                        {inlineReplyContent.length}/300
                    </span>
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={!inlineReplyContent.trim() || isSubmittingReply || cooldown > 0}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all cursor-pointer disabled:opacity-40"
                    >
                        <Send className="w-3 h-3"/>
                        <span>
                            {isSubmittingReply
                                ? "등록 중..."
                                : cooldown > 0
                                    ? `${cooldown}초 후`
                                    : "답글 등록"}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};
