"use client";

import React, {useEffect, useState} from "react";
import {createPortal} from "react-dom";
import {Dices, Flame, Hash, Heart, MessageCircle, ShieldCheck, Sparkles, TrendingUp, User, X,} from "lucide-react";
import {CommentItem} from "@/types/comment";

export function getAvatarGradient(name: string, tag = ""): string {
    const gradients = [
        "from-blue-500 to-indigo-600",
        "from-emerald-500 to-teal-600",
        "from-purple-500 to-pink-600",
        "from-amber-500 to-orange-600",
        "from-rose-500 to-red-600",
        "from-cyan-500 to-blue-600",
        "from-violet-500 to-purple-700",
        "from-teal-500 to-emerald-600",
    ];
    const combined = `${name}${tag}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        hash = combined.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % gradients.length;
    return gradients[idx];
}

interface SquareProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    authorName: string;
    userTag: string;
    onRerollNickname: () => void;
    myTotalPostsCount: number;
    likedCount: number;
    onSelectMyPosts: () => void;
    trendingTags: Array<{ tag: string; count: number; score: number }>;
    selectedHashtag: string | null;
    onSelectHashtag: (tag: string) => void;
    topRankedThreads: Array<{
        thread: CommentItem;
        replyCount: number;
        score: number;
    }>;
    onSelectThread: (threadId: string) => void;
}

type ModalTab = "OVERVIEW" | "HOT" | "TREND" | "GUIDE";

export const SquareProfileModal: React.FC<SquareProfileModalProps> = ({
                                                                          isOpen,
                                                                          onClose,
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
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<ModalTab>("OVERVIEW");

    useEffect(() => {
        setMounted(true);
    }, []);

    // Prevent background scrolling when modal is open
    useEffect(() => {
        if (!isOpen) return;
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalStyle;
        };
    }, [isOpen]);

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3.5 sm:p-4 animate-fadeIn">
            {/* Backdrop Blur Overlay */}
            <div
                className="fixed inset-0 bg-black/65 backdrop-blur-md transition-opacity duration-300"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Main Modal Dialog Container */}
            <div
                className="relative w-full max-w-lg h-[82dvh] max-h-[82dvh] bg-white/95 dark:bg-[#12131a]/95 backdrop-blur-3xl border border-black/10 dark:border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.35)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.85)] rounded-[28px] sm:rounded-[32px] overflow-hidden flex flex-col z-10 animate-scaleUp"
                role="dialog"
                aria-modal="true"
                aria-label="스퀘어 프로필 및 레이더"
            >
                {/* Header Bar */}
                <div
                    className="flex items-center justify-between px-4 sm:px-6 pt-4 pb-3 border-b border-black/5 dark:border-white/5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white shadow-md shadow-blue-500/25">
                            <User className="w-5 h-5"/>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                    내 프로필
                                </h2>
                            </div>
                            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                                익명 활동 통계 & 레이더
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
                        aria-label="닫기"
                    >
                        <X className="w-5 h-5"/>
                    </button>
                </div>

                {/* Navigation Sub-Tabs */}
                <div
                    className="flex items-center gap-1 px-4 sm:px-6 py-2 border-b border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] shrink-0 overflow-x-auto custom-scrollbar">
                    <button
                        type="button"
                        onClick={() => setActiveTab("OVERVIEW")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                            activeTab === "OVERVIEW"
                                ? "bg-white dark:bg-white/15 text-blue-600 dark:text-white shadow-xs font-black"
                                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                        }`}
                    >
                        내 프로필
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("HOT")}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                            activeTab === "HOT"
                                ? "bg-rose-500 text-white shadow-xs font-black"
                                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                        }`}
                    >
                        <Flame className="w-3.5 h-3.5"/>
                        <span>HOT 토론 ({topRankedThreads.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("TREND")}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                            activeTab === "TREND"
                                ? "bg-blue-600 text-white shadow-xs font-black"
                                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                        }`}
                    >
                        <TrendingUp className="w-3.5 h-3.5"/>
                        <span>트렌드 ({trendingTags.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("GUIDE")}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                            activeTab === "GUIDE"
                                ? "bg-indigo-600 text-white shadow-xs font-black"
                                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                        }`}
                    >
                        <Sparkles className="w-3.5 h-3.5"/>
                        <span>클린 가이드</span>
                    </button>
                </div>

                {/* Modal Scrollable Content Body */}
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
                    {/* 1. OVERVIEW TAB: Profile & Stats */}
                    {activeTab === "OVERVIEW" && (
                        <div className="space-y-4 animate-fadeIn">
                            {/* Profile Identity Card */}
                            <div
                                className="p-4 rounded-3xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 space-y-4 shadow-xs">
                                <div className="flex items-center gap-3.5">
                                    <div
                                        className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(
                                            authorName,
                                            userTag
                                        )} text-white flex items-center justify-center font-black text-xl shadow-lg shrink-0`}
                                    >
                                        {authorName.charAt(0) || "?"}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-base font-black text-slate-900 dark:text-white truncate">
                                                {authorName}
                                            </p>
                                            <span
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20 shrink-0">
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                                                {myTotalPostsCount > 0 ? "활동 중" : "참여 중"}
                                            </span>
                                        </div>
                                        <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                                            고유 식별 태그: <strong
                                            className="text-slate-700 dark:text-slate-300">{userTag}</strong>
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={onRerollNickname}
                                    className="w-full py-2.5 rounded-2xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200/80 dark:border-white/10 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 shadow-xs"
                                >
                                    <Dices className="w-4 h-4 text-blue-500"/>
                                    <span>랜덤 닉네임 새로고침</span>
                                </button>
                            </div>

                            {/* User Activity Stats */}
                            <div className="grid grid-cols-2 gap-3">
                                <div
                                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 space-y-1 text-center flex flex-col justify-between">
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400">내가 쓴 글/답글</p>
                                        <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                                            {myTotalPostsCount}
                                            <span className="text-xs font-semibold text-slate-400 ml-0.5">개</span>
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onSelectMyPosts}
                                        className="mt-2 py-1 px-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[11px] font-black transition-all cursor-pointer"
                                    >
                                        내 글 모아보기 →
                                    </button>
                                </div>

                                <div
                                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 space-y-1 text-center flex flex-col justify-between">
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400">공감(좋아요)한 글</p>
                                        <p className="text-xl font-black text-rose-500 mt-1">
                                            {likedCount}
                                            <span className="text-xs font-semibold text-slate-400 ml-0.5">개</span>
                                        </p>
                                    </div>
                                    <div className="mt-2 py-1 px-2 text-[11px] font-semibold text-slate-400">
                                        스퀘어 소통 중
                                    </div>
                                </div>
                            </div>

                            {/* Quick Radar Preview Cards */}
                            <div
                                className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Flame className="w-4 h-4 text-rose-500"/>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        실시간 HOT 토론 <strong>{topRankedThreads.length}개</strong> 진행 중
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("HOT")}
                                    className="text-xs font-black text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                >
                                    보기 →
                                </button>
                            </div>

                            <div
                                className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-indigo-500"/>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        실시간 트렌드 태그 <strong>{trendingTags.length}개</strong>
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("TREND")}
                                    className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                >
                                    보기 →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 2. HOT DISCUSSIONS TAB */}
                    {activeTab === "HOT" && (
                        <div className="space-y-3 animate-fadeIn">
                            <div className="flex items-center justify-between">
                                <div
                                    className="flex items-center gap-1.5 text-xs font-black text-rose-600 dark:text-rose-400">
                                    <Flame className="w-4 h-4 fill-rose-500"/>
                                    <span>실시간 HOT 토론 (TOP {topRankedThreads.length})</span>
                                </div>
                                <span className="text-[11px] text-slate-400 font-medium">
                                    탭하여 해당 스레드로 바로 이동
                                </span>
                            </div>

                            {topRankedThreads.length > 0 ? (
                                <div className="space-y-2.5">
                                    {topRankedThreads.map(({thread, replyCount}, idx) => (
                                        <div
                                            key={thread.id}
                                            onClick={() => {
                                                onSelectThread(thread.id);
                                                onClose();
                                            }}
                                            className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10 hover:border-blue-500 dark:hover:border-blue-500 cursor-pointer transition-all space-y-2 active:scale-[0.99] shadow-xs"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span
                                                    className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                                        idx === 0
                                                            ? "bg-amber-400 text-slate-900"
                                                            : idx === 1
                                                                ? "bg-slate-300 text-slate-900 dark:bg-slate-600 dark:text-white"
                                                                : "bg-amber-700/60 text-white"
                                                    }`}
                                                >
                                                    TOP {idx + 1}
                                                </span>
                                                <div className="flex items-center gap-3 text-xs font-mono">
                                                    <span className="flex items-center gap-1 text-rose-500 font-bold">
                                                        <Heart className="w-3 h-3 fill-rose-500"/>
                                                        {thread.likes || 0}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-blue-500 font-bold">
                                                        <MessageCircle className="w-3 h-3"/>
                                                        {replyCount}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed">
                                                {thread.content}
                                            </p>
                                            <div
                                                className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-white/5 text-[10px] text-slate-400">
                                                <span>작성자: {thread.author}</span>
                                                <span className="text-blue-500 font-bold">스레드로 이동 →</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                                    <p className="font-bold">현재 진행 중인 HOT 토론이 없습니다.</p>
                                    <p className="text-[11px]">첫 번째 화제의 글을 작성해보세요!</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 3. TRENDING HASHTAGS TAB */}
                    {activeTab === "TREND" && (
                        <div className="space-y-3 animate-fadeIn">
                            <div className="flex items-center justify-between">
                                <div
                                    className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                                    <TrendingUp className="w-4 h-4 text-blue-500"/>
                                    <span>실시간 트렌드 해시태그 (TOP {trendingTags.length})</span>
                                </div>
                                {selectedHashtag && (
                                    <button
                                        type="button"
                                        onClick={() => onSelectHashtag("")}
                                        className="text-[11px] text-blue-500 hover:underline cursor-pointer font-bold"
                                    >
                                        필터 해제
                                    </button>
                                )}
                            </div>

                            {trendingTags.length > 0 ? (
                                <div className="space-y-1.5">
                                    {trendingTags.map((t, idx) => {
                                        const isSelected = selectedHashtag === t.tag;
                                        return (
                                            <div
                                                key={t.tag}
                                                onClick={() => {
                                                    onSelectHashtag(t.tag);
                                                    onClose();
                                                }}
                                                className={`flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer ${
                                                    isSelected
                                                        ? "bg-blue-600 text-white shadow-md font-bold"
                                                        : "bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-white/5"
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
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
                                                    className={`text-[11px] font-mono ${
                                                        isSelected ? "text-white/80" : "text-slate-400"
                                                    }`}
                                                >
                                                    {t.count}회 언급
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                                    <p className="font-bold">아직 언급된 해시태그가 없습니다.</p>
                                    <p className="text-[11px]">#태그를 사용하여 글을 작성해보세요!</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 4. CLEAN SQUARE GUIDE TAB */}
                    {activeTab === "GUIDE" && (
                        <div className="space-y-3 animate-fadeIn">
                            <div
                                className="p-4 rounded-3xl bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 border border-blue-500/20 space-y-3">
                                <div
                                    className="flex items-center gap-2 text-sm font-black text-blue-700 dark:text-blue-300">
                                    <Sparkles className="w-4 h-4"/>
                                    <span>스퀘어 클린 가이드 & 이용 수칙</span>
                                </div>
                                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                    wBus 스퀘어는 원주시민과 버스 이용자 모두가 실시간으로 소통하는 열린 광장입니다.
                                </p>
                            </div>

                            <div className="space-y-2 text-xs">
                                <div
                                    className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 space-y-1">
                                    <p className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500"/>
                                        <span>따뜻한 매너와 상호 존중</span>
                                    </p>
                                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                                        서로를 존중하는 언어로 건전하고 유익한 커뮤니티 문화를 만들어주세요. 비방, 욕설, 혐오 표현은 제재 대상이 될 수 있습니다.
                                    </p>
                                </div>

                                <div
                                    className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 space-y-1">
                                    <p className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <Hash className="w-3.5 h-3.5 text-blue-500"/>
                                        <span>해시태그와 실시간 정보 공유</span>
                                    </p>
                                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                                        #실시간 #셔틀지연 #분실물 등 유용한 태그를 함께 남겨주시면 다른 이용자들에게 큰 도움이 됩니다.
                                    </p>
                                </div>

                                <div
                                    className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 space-y-1">
                                    <p className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <Dices className="w-3.5 h-3.5 text-indigo-500"/>
                                        <span>익명성과 개인정보 보호</span>
                                    </p>
                                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                                        모든 닉네임은 무작위 익명으로 생성되며 언제든 새로고침할 수 있습니다. 개인정보(전화번호, 계좌 등) 공유는 금지됩니다.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Bar */}
                <div
                    className="px-4 sm:px-6 py-3 border-t border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between shrink-0">
                    <span className="text-[11px] text-slate-400 font-medium">
                        wBus Square
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black hover:opacity-90 transition-opacity cursor-pointer active:scale-95"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
