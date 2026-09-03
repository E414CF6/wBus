"use client";

import {
    Activity,
    ArrowUpRight,
    Dices,
    Flame,
    Hash,
    Heart,
    MessageCircle,
    ShieldCheck,
    Sparkles,
    User,
    X,
} from "lucide-react";
import React, {useEffect, useState} from "react";
import {createPortal} from "react-dom";
import {UI_TEXT} from "@shared/config/locale";
import type {RankedThread, TrendingTag} from "./types";
import {getAvatarGradient} from "./utils/avatarUtils";
import {renderRichContent} from "./utils/textParser";

export type ModalTab = "OVERVIEW" | "TRENDING" | "HOT_THREADS";
export {getAvatarGradient} from "./utils/avatarUtils";

interface SquareProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: ModalTab;
    authorName: string;
    userTag: string;
    onRerollNickname: () => void;
    myTotalPostsCount: number;
    likedCount: number;
    onSelectMyPosts: () => void;
    trendingTags: TrendingTag[];
    selectedHashtag: string | null;
    onSelectHashtag: (tag: string) => void;
    topRankedThreads: RankedThread[];
    onSelectThread: (threadId: string) => void;
}

export const SquareProfileModal: React.FC<SquareProfileModalProps> = ({
                                                                          isOpen,
                                                                          onClose,
                                                                          initialTab = "OVERVIEW",
                                                                          authorName,
                                                                          userTag,
                                                                          onRerollNickname,
                                                                          myTotalPostsCount,
                                                                          likedCount,
                                                                          onSelectMyPosts,
                                                                          trendingTags,
                                                                          selectedHashtag,
                                                                          onSelectHashtag,
                                                                          topRankedThreads,
                                                                          onSelectThread,
                                                                      }) => {
    const [tab, setTab] = useState<ModalTab>(initialTab);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setTab(initialTab);
        }
    }, [isOpen, initialTab]);

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <div
            className="fixed inset-0 z-9999 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 dark:bg-black/80 backdrop-blur-md animate-fadeIn pointer-events-auto"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg max-h-[85vh] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-[#111622] transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div
                    className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div
                            className={`w-9 h-9 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(
                                authorName,
                                userTag
                            )} text-white flex items-center justify-center font-black text-sm shadow-xs`}
                        >
                            {authorName.charAt(0) || "U"}
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                                    {authorName}
                                </h3>
                                {userTag && (
                                    <span
                                        className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 font-mono text-xs font-bold">
                                        #{userTag.replace(/^#+/, "")}
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-emerald-500"/>
                                <span>{UI_TEXT.CHAT.ENCRYPTED_PROFILE}</span>
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer"
                        aria-label={UI_TEXT.COMMON.CLOSE}
                    >
                        <X className="h-4 w-4"/>
                    </button>
                </div>

                {/* Sub Tab Navigation */}
                <div
                    className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-white/5 flex items-center gap-1.5 overflow-x-auto custom-scrollbar-hidden">
                    <button
                        onClick={() => setTab("OVERVIEW")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                            tab === "OVERVIEW"
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        }`}
                    >
                        <User className="w-3.5 h-3.5"/>
                        <span>{UI_TEXT.CHAT.MY_PROFILE}</span>
                    </button>
                    <button
                        onClick={() => setTab("TRENDING")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                            tab === "TRENDING"
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        }`}
                    >
                        <Activity className="w-3.5 h-3.5"/>
                        <span>{UI_TEXT.CHAT.REALTIME_TREND}</span>
                    </button>
                    <button
                        onClick={() => setTab("HOT_THREADS")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                            tab === "HOT_THREADS"
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        }`}
                    >
                        <Flame className="w-3.5 h-3.5"/>
                        <span>{UI_TEXT.CHAT.POPULAR_THREADS}</span>
                    </button>
                </div>

                {/* Modal Content */}
                <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-4 flex-1 min-h-0">
                    {tab === "OVERVIEW" && (
                        <div className="space-y-4 animate-fadeIn">
                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-3">
                                <div
                                    onClick={onSelectMyPosts}
                                    className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-500/20 cursor-pointer hover:border-indigo-500/40 transition-all group"
                                >
                                    <div
                                        className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-1">
                                        <MessageCircle className="w-4 h-4"/>
                                        <ArrowUpRight
                                            className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity"/>
                                    </div>
                                    <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                                        {myTotalPostsCount}
                                    </div>
                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                        {UI_TEXT.CHAT.MY_POSTS_AND_REPLIES}
                                    </div>
                                </div>

                                <div
                                    className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-500/20">
                                    <div className="text-rose-600 dark:text-rose-400 mb-1">
                                        <Heart className="w-4 h-4 fill-current"/>
                                    </div>
                                    <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                                        {likedCount}
                                    </div>
                                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                        {UI_TEXT.CHAT.MY_LIKED_STORIES}
                                    </div>
                                </div>
                            </div>

                            {/* Nickname Reroll Box */}
                            <div
                                className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 space-y-2">
                                <div
                                    className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center justify-between">
                                    <span>{UI_TEXT.CHAT.CHANGE_NICKNAME}</span>
                                    <button
                                        onClick={onRerollNickname}
                                        className="px-2.5 py-1 rounded-xl bg-white dark:bg-[#181f2e] border border-slate-200 dark:border-white/10 hover:border-indigo-500 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                                    >
                                        <Dices className="w-3.5 h-3.5"/>
                                        <span>{UI_TEXT.CHAT.RANDOM_GENERATE}</span>
                                    </button>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                    {UI_TEXT.CHAT.CHANGE_NICKNAME_DESC}
                                </p>
                            </div>
                        </div>
                    )}

                    {tab === "TRENDING" && (
                        <div className="space-y-3 animate-fadeIn">
                            <div
                                className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500"/>
                                <span>{UI_TEXT.CHAT.HOT_KEYWORDS}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {trendingTags.map((tag) => (
                                    <button
                                        key={tag.tag}
                                        onClick={() => {
                                            onSelectHashtag(tag.tag);
                                            onClose();
                                        }}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                                            selectedHashtag === tag.tag
                                                ? "bg-indigo-600 text-white shadow-xs"
                                                : "bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600"
                                        }`}
                                    >
                                        <Hash className="w-3 h-3 opacity-60"/>
                                        <span>{tag.tag.replace("#", "")}</span>
                                        <span className="text-[10px] opacity-70 font-mono">
                                            {tag.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {tab === "HOT_THREADS" && (
                        <div className="space-y-2.5 animate-fadeIn">
                            {topRankedThreads.map((item, idx) => (
                                <div
                                    key={item.thread.id}
                                    onClick={() => {
                                        onSelectThread(item.thread.id);
                                        onClose();
                                    }}
                                    className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 hover:border-indigo-500/40 transition-all cursor-pointer space-y-1.5"
                                >
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono font-black text-[10px] flex items-center justify-center">
                                                {idx + 1}
                                            </span>
                                            <span className="font-bold text-slate-700 dark:text-slate-300">
                                                {item.thread.author}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                            <span className="flex items-center gap-0.5 text-rose-500">
                                                <Heart className="w-2.5 h-2.5 fill-current"/>
                                                {item.thread.likes || 0}
                                            </span>
                                            <span className="flex items-center gap-0.5 text-indigo-500">
                                                <MessageCircle className="w-2.5 h-2.5"/>
                                                {item.replyCount}
                                            </span>
                                        </div>
                                    </div>
                                    <div
                                        className="text-xs text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed">
                                        {renderRichContent(item.thread.content)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
