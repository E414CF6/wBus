"use client";

import {createPortal} from "react-dom";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {
    ArrowUp,
    Check,
    CheckCircle2,
    Clock,
    Copy,
    Dices,
    MessageSquare,
    RotateCw,
    Search,
    Send,
    Sparkles,
    ThumbsUp,
    X,
} from "lucide-react";

import {CommentItem} from "@/types/comment";
import {formatRelativeTime} from "@lib/timeUtils";
import {getRandomNickname} from "@/data/nicknames";

interface CommentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    comments: CommentItem[];
    onAddComment: (data: {
        author?: string;
        content: string;
        routeNo?: string;
        category?: string;
    }) => Promise<void>;
    onLikeComment?: (id: string) => Promise<void>;
    onRefresh: (force?: boolean) => Promise<void>;
    isRefreshing?: boolean;
    initialRouteTag?: string;
}


const PRESET_CHIPS = [
    {label: "🚌 지금 만차예요", text: "지금 버스 만차예요! 뒤차 타시는 걸 추천해요.", category: "제보"},
    {label: "📍 학관 출발했어요", text: "방금 학생회관 정류장 지나서 출발했습니다.", category: "제보"},
    {label: "⏳ 5분 지연 중", text: "도로 정체로 예정보다 5분 정도 지연되고 있어요.", category: "제보"},
    {label: "✨ 좌석 여유 있어요", text: "현재 좌석 여유 많고 쾌적하게 운행 중입니다.", category: "꿀팁"},
    {label: "🎒 분실물 문의", text: "혹시 버스 안에서 분실물 보신 분 계신가요?", category: "분실물"},
    {label: "👋 다들 좋은 하루 보내세요", text: "오늘도 다들 좋은 하루 보내세요!", category: "잡담"},
];

const CATEGORIES = ["ALL", "잡담", "제보", "꿀팁", "질문", "분실물"] as const;

function getAvatarGradient(name: string): string {
    const gradients = [
        "from-blue-500 to-indigo-600",
        "from-emerald-500 to-teal-600",
        "from-purple-500 to-pink-600",
        "from-amber-500 to-orange-600",
        "from-rose-500 to-red-600",
        "from-cyan-500 to-blue-600",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % gradients.length;
    return gradients[idx];
}

export const CommentsModal: React.FC<CommentsModalProps> = ({
                                                                isOpen,
                                                                onClose,
                                                                comments,
                                                                onAddComment,
                                                                onLikeComment,
                                                                onRefresh,
                                                                isRefreshing = false,
                                                                initialRouteTag,
                                                            }) => {
    const [mounted, setMounted] = useState(false);
    const [newContent, setNewContent] = useState("");
    const [newAuthor, setNewAuthor] = useState("");
    const [selectedRouteTag, setSelectedRouteTag] = useState<string>("ALL");
    const [selectedCategory, setSelectedCategory] = useState<string>("잡담");

    // Filters
    const [filterRouteTag, setFilterRouteTag] = useState<string>("ALL");
    const [filterCategory, setFilterCategory] = useState<string>("ALL");
    const [searchQuery, setSearchQuery] = useState<string>("");

    // States
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [commentSuccess, setCommentSuccess] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
    const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [latestCreatedId, setLatestCreatedId] = useState<string | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
        // Load saved nickname & liked comments
        try {
            let savedNick = localStorage.getItem("wbus_chat_nickname");
            if (!savedNick || !savedNick.trim() || savedNick.trim() === "익명") {
                savedNick = getRandomNickname();
                localStorage.setItem("wbus_chat_nickname", savedNick);
            }
            setNewAuthor(savedNick);
            const savedLikes = localStorage.getItem("wbus_liked_comments");
            if (savedLikes) {
                setLikedCommentIds(new Set(JSON.parse(savedLikes)));
            }
        } catch {
            setNewAuthor(getRandomNickname());
        }
    }, []);

    // Set initial route tag if provided
    useEffect(() => {
        if (initialRouteTag) {
            setFilterRouteTag(initialRouteTag);
            setSelectedRouteTag(initialRouteTag);
        }
    }, [initialRouteTag]);

    // Handle ESC key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // Auto-refresh interval (every 15s when modal is open)
    useEffect(() => {
        if (!isOpen || !autoRefresh) return;
        const timer = setInterval(() => {
            onRefresh(false).then(() => {
                setLastRefreshedAt(new Date());
            }).catch(() => {
            });
        }, 15000);

        return () => clearInterval(timer);
    }, [isOpen, autoRefresh, onRefresh]);

    const handleManualRefresh = async () => {
        await onRefresh(true);
        setLastRefreshedAt(new Date());
    };

    const handleRandomNickname = () => {
        const name = getRandomNickname(newAuthor);
        setNewAuthor(name);
        try {
            localStorage.setItem("wbus_chat_nickname", name);
        } catch {
            // Ignore
        }
    };

    const handleAuthorChange = (val: string) => {
        setNewAuthor(val);
        try {
            localStorage.setItem("wbus_chat_nickname", val);
        } catch {
            // Ignore
        }
    };

    const handlePresetClick = (preset: typeof PRESET_CHIPS[number]) => {
        setNewContent(preset.text);
        setSelectedCategory(preset.category);
        if (inputRef.current) {
            inputRef.current.focus();
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const top = e.currentTarget.scrollTop;
        setShowScrollTop(top > 80);
    };

    const scrollToTop = () => {
        if (listContainerRef.current) {
            listContainerRef.current.scrollTo({
                top: 0,
                behavior: "smooth",
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const contentTrimmed = newContent.trim();
        if (!contentTrimmed || isSubmitting) return;

        setIsSubmitting(true);
        try {
            let author = newAuthor.trim();
            if (!author || author === "익명") {
                author = getRandomNickname();
                setNewAuthor(author);
                try {
                    localStorage.setItem("wbus_chat_nickname", author);
                } catch {
                    // Ignore
                }
            }

            await onAddComment({
                author,
                content: contentTrimmed,
                routeNo: selectedRouteTag === "ALL" ? undefined : selectedRouteTag,
                category: selectedCategory,
            });
            setNewContent("");
            setCommentSuccess(true);
            setLastRefreshedAt(new Date());

            // Scroll smoothly to top to watch the new message animate into place
            scrollToTop();

            setTimeout(() => setCommentSuccess(false), 2500);
        } catch {
            // Handled in parent
        } finally {
            setIsSubmitting(false);
        }
    };

    // When comments update, mark top comment as latest for highlight animation
    useEffect(() => {
        if (comments.length > 0) {
            setLatestCreatedId(comments[0].id);
        }
    }, [comments]);

    const handleLike = async (id: string) => {
        if (likedCommentIds.has(id)) return;

        const nextSet = new Set(likedCommentIds);
        nextSet.add(id);
        setLikedCommentIds(nextSet);
        try {
            localStorage.setItem("wbus_liked_comments", JSON.stringify(Array.from(nextSet)));
        } catch {
            // Ignore
        }

        if (onLikeComment) {
            await onLikeComment(id);
        }
    };

    const handleCopy = (id: string, text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        }).catch(() => {
        });
    };

    // Filter displayed comments (only 24h recent comments are passed in)
    const displayedComments = useMemo(() => {
        return comments.filter((c) => {
            // Route filter
            if (filterRouteTag !== "ALL" && c.routeNo !== filterRouteTag) {
                return false;
            }
            // Category filter
            if (filterCategory !== "ALL" && c.category !== filterCategory) {
                return false;
            }
            // Search keyword
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchContent = c.content.toLowerCase().includes(q);
                const matchAuthor = c.author.toLowerCase().includes(q);
                const matchRoute = c.routeNo ? c.routeNo.toLowerCase().includes(q) : false;
                if (!matchContent && !matchAuthor && !matchRoute) return false;
            }
            return true;
        });
    }, [comments, filterRouteTag, filterCategory, searchQuery]);

    const getCategoryBadgeClass = (category?: string) => {
        switch (category) {
            case "잡담":
                return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25";
            case "제보":
                return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25";
            case "꿀팁":
                return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25";
            case "질문":
                return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25";
            case "분실물":
                return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25";
            default:
                return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
        }
    };

    const getRouteBadgeClass = (routeNo?: string) => {
        switch (routeNo) {
            case "30":
                return "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30";
            case "34":
                return "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/30";
            case "34-1":
                return "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/30";
            default:
                return "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10";
        }
    };

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/65 dark:bg-black/80 backdrop-blur-md animate-fadeIn select-none"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl h-[92dvh] sm:h-[86vh] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-[#121620] transition-colors duration-300 relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. Modal Top Header */}
                <div
                    className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.03] flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 rounded-2xl bg-blue-600/15 text-blue-600 dark:text-blue-400 shrink-0">
                            <MessageSquare className="w-5 h-5"/>
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                                    Live Chat
                                </h2>
                            </div>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 truncate">
                                <Clock className="w-3 h-3 text-blue-500 shrink-0"/>
                                <span className="text-[10px] text-slate-400 font-mono">
                                    {lastRefreshedAt.toLocaleTimeString("ko-KR", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        second: "2-digit",
                                    })}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Header Action Controls: Refresh & Close */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={handleManualRefresh}
                            disabled={isRefreshing}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-black transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                            title="댓글 새로고침"
                        >
                            <RotateCw
                                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-600" : ""}`}
                            />
                            <span className="hidden xs:inline">새로고침</span>
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer active:scale-95"
                            aria-label="닫기"
                        >
                            <X className="w-4 h-4"/>
                        </button>
                    </div>
                </div>

                {/* 2. Sub-Header: Search Bar & Filters */}
                <div
                    className="p-3 sm:px-5 sm:py-2.5 bg-white/60 dark:bg-[#121620]/60 border-b border-slate-200/70 dark:border-white/5 space-y-2 shrink-0 text-xs">
                    {/* Search Input */}
                    <div className="relative w-full">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="작성자, 내용, 노선 검색..."
                            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-slate-100/90 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 font-medium"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            >
                                <X className="w-3 h-3"/>
                            </button>
                        )}
                    </div>

                    {/* Filter Pills Bar: Route and Category */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                        {/* Route Filter Pills */}
                        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
                            {["ALL", "30", "34", "34-1"].map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => setFilterRouteTag(tag)}
                                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                                        filterRouteTag === tag
                                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs font-black"
                                            : "bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                                    }`}
                                >
                                    {tag === "ALL" ? "전체 노선" : `${tag}번`}
                                </button>
                            ))}
                        </div>

                        {/* Category Filter Pills */}
                        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setFilterCategory(cat)}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer shrink-0 ${
                                        filterCategory === cat
                                            ? "bg-blue-600 text-white font-black"
                                            : "bg-slate-100/70 dark:bg-white/5 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                                    }`}
                                >
                                    {cat === "ALL" ? "모든 분류" : cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 3. Scrollable Comments List (Relative container for scroll-to-top button) */}
                <div className="flex-1 relative overflow-hidden flex flex-col">
                    <div
                        ref={listContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto custom-scrollbar p-3.5 sm:p-5 space-y-2.5"
                    >
                        {displayedComments.length === 0 ? (
                            <div
                                className="py-14 text-center space-y-2 rounded-2xl bg-slate-50/50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/10">
                                <MessageSquare className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600"/>
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                    {searchQuery || filterRouteTag !== "ALL" || filterCategory !== "ALL"
                                        ? "조건에 일치하는 댓글이 없습니다."
                                        : "최근 24시간 동안 등록된 실시간 메모가 없습니다. 아래에서 첫 메시지를 남겨보세요!"}
                                </p>
                            </div>
                        ) : (
                            displayedComments.map((item, idx) => {
                                const isLiked = likedCommentIds.has(item.id);
                                const isCopied = copiedId === item.id;
                                const isNewest = item.id === latestCreatedId && idx === 0;

                                return (
                                    <div
                                        key={item.id}
                                        className={`p-3.5 rounded-2xl border flex items-start gap-3 shadow-2xs hover:border-slate-300 dark:hover:border-white/10 transition-all group ${
                                            isNewest
                                                ? "animate-slideUp bg-blue-50/90 dark:bg-[#192235] border-blue-300 dark:border-blue-500/40 ring-1 ring-blue-400/30"
                                                : "bg-slate-50/90 dark:bg-[#161a26] border-slate-200/80 dark:border-white/5"
                                        }`}
                                    >
                                        {/* Author Initial Avatar */}
                                        <div
                                            className={`w-8 h-8 rounded-xl bg-gradient-to-br ${getAvatarGradient(
                                                item.author
                                            )} text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0 select-none uppercase`}
                                        >
                                            {item.author.charAt(0)}
                                        </div>

                                        {/* Body Content */}
                                        <div className="min-w-0 flex-1">
                                            {/* Meta line */}
                                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                                <span className="text-xs font-black text-slate-900 dark:text-white">
                                                    {item.author}
                                                </span>

                                                {/* Category Badge */}
                                                {item.category && (
                                                    <span
                                                        className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold border ${getCategoryBadgeClass(
                                                            item.category
                                                        )}`}
                                                    >
                                                        {item.category}
                                                    </span>
                                                )}

                                                {/* Route Badge */}
                                                {item.routeNo && (
                                                    <span
                                                        className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold border ${getRouteBadgeClass(
                                                            item.routeNo
                                                        )}`}
                                                    >
                                                        {item.routeNo}번
                                                    </span>
                                                )}

                                                {/* Relative Time */}
                                                <span
                                                    className="text-[10px] text-slate-400 font-medium"
                                                    title={new Date(item.createdAt).toLocaleString("ko-KR")}
                                                >
                                                    · {formatRelativeTime(item.createdAt)}
                                                </span>
                                            </div>

                                            {/* Text Content */}
                                            <p className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 leading-relaxed break-words font-medium">
                                                {item.content}
                                            </p>

                                            {/* Action bar under comment */}
                                            <div className="flex items-center gap-2 mt-2 pt-1">
                                                {/* Upvote / Like Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleLike(item.id)}
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer active:scale-90 ${
                                                        isLiked
                                                            ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-500/30 font-black"
                                                            : "bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200/80 dark:border-white/5 hover:text-rose-600 dark:hover:text-rose-400"
                                                    }`}
                                                    title={isLiked ? "공감함" : "도움돼요 / 공감"}
                                                >
                                                    <ThumbsUp
                                                        className={`w-3 h-3 ${isLiked ? "fill-rose-500 text-rose-500" : ""}`}
                                                    />
                                                    <span>{item.likes || 0}</span>
                                                </button>

                                                {/* Copy Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(item.id, item.content)}
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                                    title="내용 복사"
                                                >
                                                    {isCopied ? (
                                                        <>
                                                            <Check className="w-3 h-3 text-emerald-500"/>
                                                            <span className="text-emerald-500">복사됨</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3 h-3"/>
                                                            <span>복사</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Floating 'Scroll to Top' Button (Appears when scrolled down) */}
                    {showScrollTop && (
                        <button
                            type="button"
                            onClick={scrollToTop}
                            className="absolute bottom-3 right-4 z-20 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-900/90 dark:bg-white/90 text-white dark:text-slate-900 text-xs font-black shadow-lg hover:shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer animate-fadeIn border border-white/20 dark:border-black/10"
                            title="최신 메시지로 이동 (맨 위로)"
                        >
                            <ArrowUp className="w-3.5 h-3.5"/>
                            <span>위로 가기</span>
                        </button>
                    )}
                </div>

                {/* 4. Bottom Message Compose Widget (Fixed at bottom) */}
                <form
                    onSubmit={handleSubmit}
                    className="p-3 sm:p-4 bg-slate-50/95 dark:bg-[#151924] border-t border-slate-200/80 dark:border-white/10 space-y-2.5 shrink-0"
                >
                    {/* Top Row of Form: Nickname + Category Selector + Route Selector */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        {/* Nickname Input with Random Generator Button */}
                        <div className="flex items-center gap-1.5">
                            <input
                                type="text"
                                value={newAuthor}
                                onChange={(e) => handleAuthorChange(e.target.value)}
                                placeholder="닉네임"
                                maxLength={15}
                                className="w-28 sm:w-32 px-2.5 py-1 text-xs rounded-xl bg-white dark:bg-[#1c2230] border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 font-bold"
                            />
                            <button
                                type="button"
                                onClick={handleRandomNickname}
                                className="p-1.5 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-300 transition-all cursor-pointer active:scale-95"
                                title="랜덤 닉네임 생성"
                            >
                                <Dices className="w-3.5 h-3.5"/>
                            </button>
                        </div>

                        {/* Category Select (Default: "잡담") */}
                        <div className="flex items-center gap-1">
                            {["잡담", "제보", "꿀팁", "질문", "분실물"].map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                                        selectedCategory === cat
                                            ? "bg-blue-600 text-white shadow-xs font-black"
                                            : "bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-white/5"
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Route Tag Selector */}
                        <div className="flex items-center gap-1 text-[11px]">
                            {["ALL", "30", "34", "34-1"].map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => setSelectedRouteTag(tag)}
                                    className={`px-2 py-0.5 rounded-lg font-black text-[11px] transition-all cursor-pointer ${
                                        selectedRouteTag === tag
                                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs"
                                            : "bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-white/5"
                                    }`}
                                >
                                    {tag === "ALL" ? "공통" : `${tag}번`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preset Chips Row */}
                    <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
                        <span
                            className="text-[10px] font-bold text-blue-600 dark:text-blue-400 shrink-0 flex items-center gap-0.5">
                            <Sparkles className="w-3 h-3"/>
                            <span>빠른 입력:</span>
                        </span>
                        {PRESET_CHIPS.map((chip, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handlePresetClick(chip)}
                                className="px-2 py-0.5 rounded-lg bg-white dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-slate-200/70 dark:border-white/10 text-slate-700 dark:text-slate-300 text-[10px] font-bold shrink-0 transition-all cursor-pointer active:scale-95"
                            >
                                {chip.label}
                            </button>
                        ))}
                    </div>

                    {/* Main Input Row */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <input
                                ref={inputRef}
                                type="text"
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                                placeholder="메시지를 입력하세요..."
                                maxLength={1000}
                                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#1c2230] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium shadow-2xs"
                            />
                            <span
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none font-mono">
                                {newContent.length}/1000
                            </span>
                        </div>
                        <button
                            type="submit"
                            disabled={!newContent.trim() || isSubmitting}
                            className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white text-xs font-black transition-all cursor-pointer shrink-0 active:scale-95 disabled:cursor-not-allowed shadow-sm"
                        >
                            <Send className="w-3.5 h-3.5"/>
                            <span>{isSubmitting ? "전송 중..." : "전송"}</span>
                        </button>
                    </div>

                    {commentSuccess && (
                        <div
                            className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold animate-fadeIn">
                            <CheckCircle2 className="w-3.5 h-3.5"/>
                            <span>메시지가 성공적으로 전송되었습니다!</span>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
