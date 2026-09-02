import React from "react";
import {Dices, Flame, Heart, MessageCircle, Sparkles, TrendingUp, User} from "lucide-react";
import {RankedThread, TrendingTag} from "../types";
import {getAvatarGradient} from "../utils/avatarUtils";

interface ChatSidebarProps {
    authorName: string;
    userTag: string;
    myTotalPostsCount: number;
    likedCount: number;
    trendingTags: TrendingTag[];
    selectedHashtag: string | null;
    topRankedThreads: RankedThread[];
    onRerollNickname: () => void;
    onHashtagClick: (tag: string) => void;
    onClearHashtag: () => void;
    onScrollToThread: (threadId: string) => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
                                                            authorName,
                                                            userTag,
                                                            myTotalPostsCount,
                                                            likedCount,
                                                            trendingTags,
                                                            selectedHashtag,
                                                            topRankedThreads,
                                                            onRerollNickname,
                                                            onHashtagClick,
                                                            onClearHashtag,
                                                            onScrollToThread,
                                                        }) => {
    return (
        <aside className="hidden lg:flex lg:col-span-4 flex-col gap-4 sticky top-4">
            {/* User Profile Card */}
            <div
                className="backdrop-blur-2xl bg-white/85 dark:bg-[#111622]/90 rounded-3xl p-4 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                    <span
                        className="text-[11px] font-black text-slate-400 tracking-wider uppercase flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-blue-500"/> 내 스퀘어 프로필
                    </span>
                    <span
                        className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                        {myTotalPostsCount > 0 ? "활동 중" : "참여 중"}
                    </span>
                </div>

                <div className="flex items-center gap-3 pt-1">
                    <div
                        className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(
                            authorName,
                            userTag
                        )} text-white flex items-center justify-center font-black text-lg shadow-md`}
                    >
                        {authorName.charAt(0) || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                            {authorName}
                        </p>
                        <p className="text-xs font-mono text-slate-400 dark:text-slate-500">
                            {userTag}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-white/5 text-center">
                    <div
                        className="p-2 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/5">
                        <p className="text-[10px] font-bold text-slate-400">내 작성 글</p>
                        <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                            {myTotalPostsCount}
                        </p>
                    </div>
                    <div
                        className="p-2 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/5">
                        <p className="text-[10px] font-bold text-slate-400">공감한 글</p>
                        <p className="text-sm font-black text-rose-500 mt-0.5">{likedCount}</p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onRerollNickname}
                    className="w-full py-2 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                >
                    <Dices className="w-3.5 h-3.5 text-blue-500"/>
                    <span>랜덤 닉네임 새로고침</span>
                </button>
            </div>

            {/* Real-time Trending Hashtags Card */}
            <div
                className="backdrop-blur-2xl bg-white/85 dark:bg-[#111622]/90 rounded-3xl p-4 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                        <TrendingUp className="w-4 h-4 text-blue-500"/>
                        <span>실시간 트렌드 해시태그</span>
                    </div>
                    {selectedHashtag && (
                        <button
                            onClick={onClearHashtag}
                            className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-white underline cursor-pointer"
                        >
                            초기화
                        </button>
                    )}
                </div>

                <div className="space-y-1.5 pt-1">
                    {trendingTags.length > 0 ? (
                        trendingTags.map((t, idx) => {
                            const isSelected = selectedHashtag === t.tag;
                            return (
                                <div
                                    key={t.tag}
                                    onClick={() => onHashtagClick(t.tag)}
                                    className={`flex items-center justify-between p-2 rounded-2xl transition-all cursor-pointer ${
                                        isSelected
                                            ? "bg-blue-600 text-white shadow-xs"
                                            : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300"
                                    }`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span
                                            className={`text-xs font-mono font-black ${
                                                isSelected
                                                    ? "text-white"
                                                    : idx === 0
                                                        ? "text-rose-500"
                                                        : idx === 1
                                                            ? "text-amber-500"
                                                            : "text-blue-500"
                                            }`}
                                        >
                                            #{idx + 1}
                                        </span>
                                        <span className="text-xs font-bold truncate">{t.tag}</span>
                                    </div>
                                    <span
                                        className={`text-[10px] font-mono ${
                                            isSelected ? "text-white/80" : "text-slate-400"
                                        }`}
                                    >
                                        {t.count}회 언급
                                    </span>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-xs text-slate-400 py-2 text-center">
                            아직 언급된 해시태그가 없습니다.
                        </p>
                    )}
                </div>
            </div>

            {/* Real-time Top Hot Discussions Card */}
            {topRankedThreads.length > 0 && (
                <div
                    className="backdrop-blur-2xl bg-white/85 dark:bg-[#111622]/90 rounded-3xl p-4 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-black text-rose-600 dark:text-rose-400">
                        <Flame className="w-4 h-4 fill-rose-500"/>
                        <span>지금 뜨거운 HOT 토론</span>
                    </div>

                    <div className="space-y-2 pt-1">
                        {topRankedThreads.map(({thread, replyCount}, idx) => (
                            <div
                                key={thread.id}
                                onClick={() => onScrollToThread(thread.id)}
                                className="p-2.5 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 hover:bg-white dark:hover:bg-white/5 cursor-pointer transition-all space-y-1.5"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span
                                        className={`px-1.5 py-0.2 rounded-md text-[9px] font-black ${
                                            idx === 0
                                                ? "bg-amber-400 text-slate-900"
                                                : idx === 1
                                                    ? "bg-slate-300 text-slate-900 dark:bg-slate-600 dark:text-white"
                                                    : "bg-amber-700/60 text-white"
                                        }`}
                                    >
                                        TOP {idx + 1}
                                    </span>
                                    <div className="flex items-center gap-2 text-[10px] font-mono">
                                        <span className="flex items-center gap-0.5 text-rose-500 font-bold">
                                            <Heart className="w-2.5 h-2.5 fill-rose-500"/>
                                            {thread.likes || 0}
                                        </span>
                                        <span className="flex items-center gap-0.5 text-blue-500 font-bold">
                                            <MessageCircle className="w-2.5 h-2.5"/>
                                            {replyCount}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed">
                                    {thread.content}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Community Manners & Clean Square Banner */}
            <div
                className="backdrop-blur-2xl bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 rounded-3xl p-4 border border-blue-500/20 shadow-xs space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-blue-700 dark:text-blue-300">
                    <Sparkles className="w-3.5 h-3.5"/>
                    <span>스퀘어 클린 가이드</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    스퀘어는 모두가 함께 만들어가는 실시간 광장입니다. 따뜻한 매너와 배려로 서로를 존중하며, 건전하고 즐거운 토론 문화를 만들어주세요. 부적절한 언어, 혐오 표현, 악성 댓글은
                    자제해주시고, 서로의 의견을 존중하는 열린 마음으로 소통해주시길 부탁드립니다.
                </p>
            </div>
        </aside>
    );
};
