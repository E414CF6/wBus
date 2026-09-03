import React from "react";
import {Dices, Hash, Send} from "lucide-react";
import {QUICK_HASHTAGS} from "../types";
import {getAvatarGradient} from "../utils/avatarUtils";

interface ChatComposerProps {
    authorName: string;
    userTag: string;
    composerContent: string;
    isComposerExpanded: boolean;
    isSubmitting: boolean;
    cooldown: number;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    onTextareaChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onExpand: () => void;
    onInsertHashtag: (tag: string) => void;
    onRerollNickname: () => void;
    onOpenProfileModal: () => void;
    onSubmit: (e?: React.FormEvent) => Promise<void>;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
                                                              authorName,
                                                              userTag,
                                                              composerContent,
                                                              isComposerExpanded,
                                                              isSubmitting,
                                                              cooldown,
                                                              textareaRef,
                                                              onTextareaChange,
                                                              onExpand,
                                                              onInsertHashtag,
                                                              onRerollNickname,
                                                              onOpenProfileModal,
                                                              onSubmit,
                                                          }) => {
    return (
        <div
            className="p-3.5 sm:p-4 rounded-3xl bg-slate-50/90 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5 shadow-xs transition-all space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div
                    onClick={onOpenProfileModal}
                    className="flex items-center gap-2 cursor-pointer group"
                    title="내 스퀘어 프로필 열기"
                >
                    <div
                        className={`w-7 h-7 rounded-xl bg-gradient-to-tr ${getAvatarGradient(
                            authorName,
                            userTag
                        )} text-white flex items-center justify-center font-black text-xs shadow-xs group-hover:scale-105 transition-transform`}
                    >
                        {authorName.charAt(0) || "?"}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span
                            className="text-xs font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {authorName}
                        </span>
                        {userTag && (
                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                                #{userTag.replace(/^#+/, "")}
                            </span>
                        )}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onRerollNickname}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 text-[11px] font-bold border border-slate-200/60 dark:border-white/5 transition-all cursor-pointer active:scale-95"
                    title="랜덤 닉네임 새로고침"
                >
                    <Dices className="w-3.5 h-3.5 text-blue-500"/>
                    <span>닉네임 변경</span>
                </button>
            </div>

            <textarea
                ref={textareaRef}
                value={composerContent}
                onChange={onTextareaChange}
                onFocus={onExpand}
                placeholder="무슨 일이 일어나고 있나요?"
                rows={isComposerExpanded ? 3 : 2}
                maxLength={1000}
                className="w-full bg-white dark:bg-black/20 rounded-2xl p-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none resize-none font-medium leading-relaxed border border-slate-200/60 dark:border-white/5 focus:border-blue-500 transition-colors"
            />

            {/* Quick Hashtag Insertion Chips */}
            {isComposerExpanded && (
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
                    <span className="text-[10px] font-bold text-slate-400 shrink-0 flex items-center gap-0.5">
                        <Hash className="w-3 h-3"/> 추천 태그:
                    </span>
                    {QUICK_HASHTAGS.map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => onInsertHashtag(tag)}
                            className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[11px] font-bold border border-blue-200/60 dark:border-blue-800/40 transition-all cursor-pointer whitespace-nowrap"
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            )}

            {/* Submit Row */}
            <div className="flex items-center justify-end gap-2 pt-1">
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono font-semibold text-slate-400">
                        {composerContent.length}/1000
                    </span>
                    <button
                        type="button"
                        onClick={() => onSubmit()}
                        disabled={!composerContent.trim() || isSubmitting || cooldown > 0}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white text-xs font-black transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none shadow-xs"
                    >
                        <Send className="w-3.5 h-3.5"/>
                        <span>
                            {isSubmitting
                                ? "게시 중..."
                                : cooldown > 0
                                    ? `${cooldown}초 후 가능`
                                    : "게시하기"}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};
