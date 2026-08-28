"use client";

import React, {useEffect, useMemo, useRef, useState} from "react";
import {
    ArrowDown,
    Check,
    CheckCircle2,
    Clock,
    Copy,
    CornerDownRight,
    Dices,
    MessageSquare,
    RotateCw,
    Search,
    Send,
    SlidersHorizontal,
    Sparkles,
    ThumbsUp,
    X,
} from "lucide-react";

import {CommentItem} from "@/types/comment";
import {formatRelativeTime} from "@lib/timeUtils";
import {generateUserTag, getRandomNickname} from "@/data/nicknames";

interface ReplyTarget {
    id: string; // Root parent comment ID
    author: string;
    authorTag?: string;
    content: string;
}

interface ChatViewProps {
    comments: CommentItem[];
    onAddComment: (data: {
        author?: string;
        content: string;
        routeNo?: string;
        category?: string;
        parentId?: string;
        replyToAuthor?: string;
        authorTag?: string;
        replyToAuthorTag?: string;
    }) => Promise<void>;
    onLikeComment?: (id: string) => Promise<void>;
    onRefresh: (force?: boolean) => Promise<void>;
    isRefreshing?: boolean;
    filterRoute?: string;
    onFilterRouteChange?: (route: string) => void;
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

function getAvatarGradient(name: string, tag: string = ""): string {
    const gradients = [
        "from-blue-500 to-indigo-600",
        "from-emerald-500 to-teal-600",
        "from-purple-500 to-pink-600",
        "from-amber-500 to-orange-600",
        "from-rose-500 to-red-600",
        "from-cyan-500 to-blue-600",
        "from-violet-500 to-purple-700",
        "from-lime-500 to-emerald-600",
    ];
    const combined = `${name}${tag}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        hash = combined.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % gradients.length;
    return gradients[idx];
}

export const ChatView: React.FC<ChatViewProps> = ({
                                                      comments,
                                                      onAddComment,
                                                      onLikeComment,
                                                      onRefresh,
                                                      isRefreshing = false,
                                                      filterRoute = "ALL",
                                                      onFilterRouteChange,
                                                  }) => {
    const [newContent, setNewContent] = useState("");
    const [newAuthor, setNewAuthor] = useState("");
    const [userTag, setUserTag] = useState<string>("");
    const [selectedRouteTag, setSelectedRouteTag] = useState<string>("ALL");
    const [selectedCategory, setSelectedCategory] = useState<string>("잡담");
    const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Filters
    const [filterCategory, setFilterCategory] = useState<string>("ALL");
    const [searchQuery, setSearchQuery] = useState<string>("");

    // States
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [commentSuccess, setCommentSuccess] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
    const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const [latestCreatedId, setLatestCreatedId] = useState<string | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({behavior, block: "end"});
        } else if (listContainerRef.current) {
            listContainerRef.current.scrollTo({
                top: listContainerRef.current.scrollHeight,
                behavior,
            });
        }
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isMenuOpen]);

    // Initialize nickname, user unique tag & liked comments on mount
    useEffect(() => {
        try {
            // 1. Nickname
            let savedNick = localStorage.getItem("wbus_chat_nickname");
            if (!savedNick || !savedNick.trim() || savedNick.trim() === "익명") {
                savedNick = getRandomNickname();
                localStorage.setItem("wbus_chat_nickname", savedNick);
            }
            setNewAuthor(savedNick);

            // 2. User Tag (e.g. #d67qe62)
            let savedTag = localStorage.getItem("wbus_user_tag");
            if (!savedTag || !savedTag.startsWith("#")) {
                savedTag = generateUserTag();
                localStorage.setItem("wbus_user_tag", savedTag);
            }
            setUserTag(savedTag);

            // 3. Liked comments
            const savedLikes = localStorage.getItem("wbus_liked_comments");
            if (savedLikes) {
                setLikedCommentIds(new Set(JSON.parse(savedLikes)));
            }
        } catch {
            setNewAuthor(getRandomNickname());
            setUserTag(generateUserTag());
        }

        setTimeout(() => {
            scrollToBottom("auto");
        }, 100);
    }, []);

    // Auto-refresh interval (every 15s)
    useEffect(() => {
        if (!autoRefresh) return;
        const timer = setInterval(() => {
            onRefresh(false).then(() => {
                setLastRefreshedAt(new Date());
            }).catch(() => {
            });
        }, 15000);

        return () => clearInterval(timer);
    }, [autoRefresh, onRefresh]);

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
        setIsMenuOpen(false);
        if (inputRef.current) {
            inputRef.current.focus();
        }
    };

    const handleStartReply = (comment: CommentItem, rootParentId?: string) => {
        setReplyingTo({
            id: rootParentId || comment.id,
            author: comment.author,
            authorTag: comment.authorTag,
            content: comment.content,
        });
        if (comment.routeNo) {
            setSelectedRouteTag(comment.routeNo);
        }
        if (inputRef.current) {
            inputRef.current.focus();
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const {scrollTop, scrollHeight, clientHeight} = e.currentTarget;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollBottom(!isNearBottom);
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
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

            const currentTag = userTag || generateUserTag();

            await onAddComment({
                author,
                authorTag: currentTag,
                content: contentTrimmed,
                routeNo: selectedRouteTag === "ALL" ? undefined : selectedRouteTag,
                category: selectedCategory,
                parentId: replyingTo?.id,
                replyToAuthor: replyingTo?.author,
                replyToAuthorTag: replyingTo?.authorTag,
            });

            setNewContent("");
            setReplyingTo(null);
            setIsMenuOpen(false);
            setCommentSuccess(true);
            setLastRefreshedAt(new Date());

            setTimeout(() => {
                scrollToBottom("smooth");
            }, 100);

            setTimeout(() => setCommentSuccess(false), 2500);
        } catch {
            // Handled in parent
        } finally {
            setIsSubmitting(false);
        }
    };

    // When comments update, mark latest comment and scroll if needed
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
        try {
            navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            // Ignore
        }
    };

    // Group comments into root threads and replies, sorted chronologically (Oldest -> Newest at bottom)
    const {rootComments, repliesByParent} = useMemo(() => {
        const roots: CommentItem[] = [];
        const replies: Record<string, CommentItem[]> = {};

        const commentIdSet = new Set(comments.map((c) => c.id));

        for (const c of comments) {
            if (c.parentId && commentIdSet.has(c.parentId)) {
                if (!replies[c.parentId]) {
                    replies[c.parentId] = [];
                }
                replies[c.parentId].push(c);
            } else {
                roots.push(c);
            }
        }

        // Sort roots chronologically: oldest on top, newest at bottom (Chat style)
        roots.sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        // Sort replies chronologically: oldest on top, newest at bottom
        for (const pid in replies) {
            replies[pid].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
        }

        return {rootComments: roots, repliesByParent: replies};
    }, [comments]);

    // Filter threads
    const filteredRoots = useMemo(() => {
        return rootComments.filter((root) => {
            const threadReplies = repliesByParent[root.id] || [];

            // Route filter
            if (filterRoute !== "ALL") {
                const matchesRoot = root.routeNo === filterRoute;
                const matchesReply = threadReplies.some((r) => r.routeNo === filterRoute);
                if (!matchesRoot && !matchesReply) return false;
            }

            // Category filter
            if (filterCategory !== "ALL") {
                const matchesRoot = root.category === filterCategory;
                const matchesReply = threadReplies.some((r) => r.category === filterCategory);
                if (!matchesRoot && !matchesReply) return false;
            }

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const inRoot =
                    root.content.toLowerCase().includes(q) ||
                    root.author.toLowerCase().includes(q) ||
                    (root.authorTag && root.authorTag.toLowerCase().includes(q));
                const inReplies = threadReplies.some(
                    (r) =>
                        r.content.toLowerCase().includes(q) ||
                        r.author.toLowerCase().includes(q) ||
                        (r.authorTag && r.authorTag.toLowerCase().includes(q))
                );
                if (!inRoot && !inReplies) return false;
            }

            return true;
        });
    }, [rootComments, repliesByParent, filterRoute, filterCategory, searchQuery]);

    return (
        <div className="w-full flex-1 min-h-0 flex flex-col gap-2.5 sm:gap-3 animate-fadeIn">
            {/* 1. Header Card with Title, Filters & Controls */}
            <div
                className="shrink-0 backdrop-blur-2xl bg-white/80 dark:bg-[#111622]/85 rounded-3xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-white/10 shadow-sm space-y-3">
                {/* Top Info Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div
                            className="w-9 h-9 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <MessageSquare className="w-5 h-5"/>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                    실시간 버스 톡
                                </h2>
                                <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black border border-emerald-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                                    LIVE
                                </span>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                                최근 24시간 동안 연세 미래캠 버스 탑승자들의 실시간 제보와 소통 피드입니다.
                            </p>
                        </div>
                    </div>

                    {/* Controls: Manual refresh */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleManualRefresh}
                            disabled={isRefreshing}
                            className="p-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-all cursor-pointer disabled:opacity-50"
                            title="새로고침"
                        >
                            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}/>
                        </button>
                    </div>
                </div>

                {/* Filter and Search Row */}
                <div
                    className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200/60 dark:border-white/5">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[200px] max-w-sm sm:max-w-md">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="내용, 닉네임 또는 #태그 검색..."
                            className="w-full pl-8 pr-8 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-white/5 border border-transparent focus:border-blue-500 text-slate-900 dark:text-white outline-none font-medium transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            >
                                <X className="w-3 h-3"/>
                            </button>
                        )}
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar py-0.5">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setFilterCategory(cat)}
                                className={`px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                                    filterCategory === cat
                                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                                        : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                {cat === "ALL" ? "전체 분류" : cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 2. Full-Width Message Feed Container (Screen-fitted responsive flex height) */}
            <div
                ref={listContainerRef}
                onScroll={handleScroll}
                className="flex-1 min-h-0 relative backdrop-blur-2xl bg-white/80 dark:bg-[#111622]/85 rounded-3xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col overflow-hidden"
            >
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4 pr-1 sm:pr-1.5">
                    {filteredRoots.length === 0 ? (
                        <div className="py-24 text-center space-y-3">
                            <div
                                className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 mx-auto flex items-center justify-center">
                                <MessageSquare className="w-6 h-6"/>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-black text-slate-700 dark:text-slate-300">
                                    등록된 메시지가 없습니다.
                                </p>
                                <p className="text-xs text-slate-400">
                                    하단 입력창에서 첫 번째 버스 제보를 남겨보세요!
                                </p>
                            </div>
                        </div>
                    ) : (
                        filteredRoots.map((comment) => {
                            const isLiked = likedCommentIds.has(comment.id);
                            const isLatest = comment.id === latestCreatedId;
                            const threadReplies = repliesByParent[comment.id] || [];

                            return (
                                <div key={comment.id} className="space-y-2.5">
                                    {/* Main Root Comment Card */}
                                    <div
                                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-300 ${
                                            isLatest
                                                ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800 animate-slideUp"
                                                : "bg-slate-50/60 dark:bg-white/[0.02] border-slate-200/70 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2.5">
                                            <div className="flex items-center gap-2.5">
                                                <div
                                                    className={`w-7 h-7 rounded-xl bg-gradient-to-tr ${getAvatarGradient(
                                                        comment.author,
                                                        comment.authorTag
                                                    )} text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0`}
                                                >
                                                    {comment.author.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span
                                                            className="font-extrabold text-xs text-slate-900 dark:text-white">
                                                            {comment.author}
                                                        </span>
                                                        {comment.authorTag && (
                                                            <span
                                                                className="text-[10px] font-mono font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/5 px-1 py-0.2 rounded">
                                                                {comment.authorTag}
                                                            </span>
                                                        )}
                                                        {comment.category && (
                                                            <span
                                                                className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                                                                    comment.category === "제보"
                                                                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                                                        : comment.category === "꿀팁"
                                                                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                                                            : comment.category === "분실물"
                                                                                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                                                                : "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                                                                }`}
                                                            >
                                                                {comment.category}
                                                            </span>
                                                        )}
                                                        {comment.routeNo && (
                                                            <span
                                                                className="px-1.5 py-0.2 rounded-md bg-blue-600/10 text-blue-600 dark:text-blue-400 text-[10px] font-black">
                                                                {comment.routeNo}번
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div
                                                        className="flex items-center gap-1 text-[10px] text-slate-400 font-medium mt-0.5">
                                                        <Clock className="w-2.5 h-2.5"/>
                                                        <span>{formatRelativeTime(comment.createdAt)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions: Reply, Like & Copy */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                {/* Reply Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartReply(comment)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-white dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/80 dark:border-white/5 text-[11px] font-bold transition-all cursor-pointer active:scale-95"
                                                    title="답글 달기"
                                                >
                                                    <CornerDownRight className="w-3 h-3 text-blue-500"/>
                                                    <span>답글</span>
                                                    {threadReplies.length > 0 && (
                                                        <span
                                                            className="text-[10px] text-blue-600 dark:text-blue-400 font-black">
                                                            {threadReplies.length}
                                                        </span>
                                                    )}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleLike(comment.id)}
                                                    disabled={isLiked}
                                                    className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-90 ${
                                                        isLiked
                                                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                                                            : "bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-white/5"
                                                    }`}
                                                    title="좋아요"
                                                >
                                                    <ThumbsUp
                                                        className={`w-3 h-3 ${isLiked ? "fill-current text-rose-500" : ""}`}/>
                                                    <span className="text-[11px] font-black">{comment.likes || 0}</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(comment.id, comment.content)}
                                                    className="p-1.5 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-white/5 transition-all cursor-pointer active:scale-90"
                                                    title="내용 복사"
                                                >
                                                    {copiedId === comment.id ? (
                                                        <Check className="w-3 h-3 text-emerald-500"/>
                                                    ) : (
                                                        <Copy className="w-3 h-3"/>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Message Body */}
                                        <p className="mt-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap break-words leading-relaxed pl-9">
                                            {comment.content}
                                        </p>
                                    </div>

                                    {/* Nested Replies List (Thread) */}
                                    {threadReplies.length > 0 && (
                                        <div
                                            className="ml-4 sm:ml-7 pl-3 border-l-2 border-blue-500/30 dark:border-blue-400/30 space-y-2">
                                            {threadReplies.map((reply) => {
                                                const isReplyLiked = likedCommentIds.has(reply.id);
                                                const isReplyLatest = reply.id === latestCreatedId;

                                                return (
                                                    <div
                                                        key={reply.id}
                                                        className={`p-3 rounded-2xl border transition-all duration-300 ${
                                                            isReplyLatest
                                                                ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 animate-slideUp"
                                                                : "bg-white/70 dark:bg-white/[0.03] border-slate-200/60 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10"
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    className={`w-6 h-6 rounded-lg bg-gradient-to-tr ${getAvatarGradient(
                                                                        reply.author,
                                                                        reply.authorTag
                                                                    )} text-white flex items-center justify-center font-black text-[10px] shadow-xs shrink-0`}
                                                                >
                                                                    {reply.author.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <div
                                                                        className="flex items-center gap-1.5 flex-wrap">
                                                                        <span
                                                                            className="font-extrabold text-xs text-slate-900 dark:text-white">
                                                                            {reply.author}
                                                                        </span>
                                                                        {reply.authorTag && (
                                                                            <span
                                                                                className="text-[9px] font-mono font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/5 px-1 py-0.2 rounded">
                                                                                {reply.authorTag}
                                                                            </span>
                                                                        )}
                                                                        {reply.replyToAuthor && (
                                                                            <span
                                                                                className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.2 rounded-md">
                                                                                <CornerDownRight
                                                                                    className="w-2.5 h-2.5"/>
                                                                                @{reply.replyToAuthor}
                                                                                {reply.replyToAuthorTag && (
                                                                                    <span
                                                                                        className="font-mono text-[9px] opacity-75">
                                                                                        {reply.replyToAuthorTag}
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div
                                                                        className="flex items-center gap-1 text-[9px] text-slate-400 font-medium mt-0.5">
                                                                        <Clock className="w-2.5 h-2.5"/>
                                                                        <span>{formatRelativeTime(reply.createdAt)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Reply Actions */}
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStartReply(reply, comment.id)}
                                                                    className="px-1.5 py-0.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 text-[10px] font-bold transition-all cursor-pointer active:scale-95"
                                                                    title="답글 달기"
                                                                >
                                                                    답글
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleLike(reply.id)}
                                                                    disabled={isReplyLiked}
                                                                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer active:scale-90 ${
                                                                        isReplyLiked
                                                                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                                                                            : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400"
                                                                    }`}
                                                                >
                                                                    <ThumbsUp
                                                                        className={`w-2.5 h-2.5 ${isReplyLiked ? "fill-current text-rose-500" : ""}`}/>
                                                                    <span>{reply.likes || 0}</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCopy(reply.id, reply.content)}
                                                                    className="p-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-all cursor-pointer active:scale-90"
                                                                    title="복사"
                                                                >
                                                                    {copiedId === reply.id ? (
                                                                        <Check
                                                                            className="w-2.5 h-2.5 text-emerald-500"/>
                                                                    ) : (
                                                                        <Copy className="w-2.5 h-2.5"/>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Reply Content */}
                                                        <p className="mt-1.5 text-xs text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap break-words leading-relaxed pl-8">
                                                            {reply.content}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}

                    {/* Anchor element to automatically scroll down to latest message */}
                    <div ref={messagesEndRef} className="h-1"/>
                </div>

                {/* Floating Scroll-to-Bottom Button (Appears when scrolled up) */}
                {showScrollBottom && (
                    <button
                        type="button"
                        onClick={() => scrollToBottom("smooth")}
                        className="sticky bottom-2 ml-auto z-20 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 dark:bg-blue-500 text-white text-xs font-black shadow-lg hover:shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer animate-fadeIn border border-white/20"
                        title="최신 메시지로 이동"
                    >
                        <ArrowDown className="w-3.5 h-3.5 animate-bounce"/>
                        <span>최신 메시지</span>
                    </button>
                )}
            </div>

            {/* 3. Bottom Compose Bar with Settings Popover */}
            <div className="shrink-0 relative w-full" ref={menuRef}>
                {/* Expandable Settings & Tools Popover Panel (Appears above input) */}
                {isMenuOpen && (
                    <div
                        className="absolute bottom-full mb-2 left-0 w-full sm:w-[420px] max-h-[60vh] overflow-y-auto custom-scrollbar backdrop-blur-2xl bg-white/95 dark:bg-[#151a27]/95 rounded-3xl p-4 sm:p-5 border border-slate-200/90 dark:border-white/15 shadow-2xl z-30 space-y-3.5 animate-slideUp">
                        {/* Popover Header */}
                        <div
                            className="flex items-center justify-between border-b border-slate-200/70 dark:border-white/10 pb-2.5">
                            <div className="flex items-center gap-2">
                                <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-blue-400"/>
                                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                    메시지 옵션 & 프리셋
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsMenuOpen(false)}
                                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                title="닫기"
                            >
                                <X className="w-4 h-4"/>
                            </button>
                        </div>

                        {/* 1. Nickname & User Tag */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                    닉네임 & 고유 식별 태그
                                </label>
                                <span
                                    className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.2 rounded-md">
                                    {userTag}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="text"
                                    value={newAuthor}
                                    onChange={(e) => handleAuthorChange(e.target.value)}
                                    placeholder="닉네임"
                                    maxLength={15}
                                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:border-blue-500 font-bold"
                                />
                                <button
                                    type="button"
                                    onClick={handleRandomNickname}
                                    className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200/70 dark:border-white/10 text-slate-600 dark:text-slate-300 transition-all cursor-pointer active:scale-95 shrink-0"
                                    title="랜덤 닉네임 생성"
                                >
                                    <Dices className="w-3.5 h-3.5"/>
                                </button>
                            </div>
                        </div>

                        {/* 2. Route Tag Selection */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                관련 버스 노선
                            </label>
                            <div className="grid grid-cols-4 gap-1">
                                {["ALL", "30", "34", "34-1"].map((tag) => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => setSelectedRouteTag(tag)}
                                        className={`py-1 rounded-xl font-black text-[11px] transition-all cursor-pointer ${
                                            selectedRouteTag === tag
                                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                                                : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
                                        }`}
                                    >
                                        {tag === "ALL" ? "공통" : `${tag}번`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3. Category Selection */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                글 카테고리
                            </label>
                            <div className="grid grid-cols-5 gap-1">
                                {["잡담", "제보", "꿀팁", "질문", "분실물"].map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                                            selectedCategory === cat
                                                ? "bg-blue-600 text-white shadow-xs font-black"
                                                : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 4. Preset Quick Chips */}
                        <div className="space-y-1">
                            <label
                                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                <Sparkles className="w-3 h-3"/>
                                <span>빠른 입력 칩 (클릭 시 자동 입력)</span>
                            </label>
                            <div className="flex flex-wrap gap-1">
                                {PRESET_CHIPS.map((chip, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handlePresetClick(chip)}
                                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-slate-200/60 dark:border-white/5 text-slate-700 dark:text-slate-300 text-[10px] font-bold transition-all cursor-pointer active:scale-95"
                                    >
                                        {chip.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Fixed Bottom Form Widget */}
                <form
                    onSubmit={handleSubmit}
                    className="backdrop-blur-2xl bg-white/85 dark:bg-[#111622]/90 rounded-3xl p-3 sm:p-4 border border-slate-200/80 dark:border-white/10 shadow-lg space-y-2.5"
                >
                    {/* Replying Banner (Appears when user clicks Reply) */}
                    {replyingTo && (
                        <div
                            className="flex items-center justify-between px-3 py-1.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/80 text-xs animate-fadeIn">
                            <div
                                className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-bold truncate">
                                <CornerDownRight className="w-3.5 h-3.5 shrink-0 text-blue-500"/>
                                <span
                                    className="font-black text-blue-600 dark:text-blue-400">@{replyingTo.author} {replyingTo.authorTag}</span>
                                <span className="text-slate-500 dark:text-slate-400 font-medium truncate text-[11px]">
                                    님에게 답글 작성 중: "{replyingTo.content.slice(0, 30)}{replyingTo.content.length > 30 ? "..." : ""}"
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReplyingTo(null)}
                                className="p-1 rounded-xl hover:bg-blue-200/60 dark:hover:bg-blue-900/60 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0 ml-2"
                                title="답글 취소"
                            >
                                <X className="w-3.5 h-3.5"/>
                            </button>
                        </div>
                    )}

                    {/* Input Control Row */}
                    <div className="flex items-center gap-2">
                        {/* Options / Settings Menu Toggle Button */}
                        <button
                            type="button"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer active:scale-95 shrink-0 border ${
                                isMenuOpen
                                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                    : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-white/10"
                            }`}
                            title="작성 옵션 메뉴 (닉네임/노선/카테고리/프리셋)"
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5"/>
                            <span className="hidden sm:inline">메뉴</span>
                            {/* Current Setting Indicators */}
                            <span
                                className="hidden md:inline-flex items-center gap-1 pl-1 border-l border-current/20 text-[10px] font-extrabold opacity-85">
                                <span>{newAuthor}</span>
                                <span>·</span>
                                <span>{selectedCategory}</span>
                                <span>·</span>
                                <span>{selectedRouteTag === "ALL" ? "공통" : `${selectedRouteTag}번`}</span>
                            </span>
                        </button>

                        {/* Main Input Text Field */}
                        <div className="relative flex-1">
                            <input
                                ref={inputRef}
                                type="text"
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                                placeholder={
                                    replyingTo
                                        ? `@${replyingTo.author} 님에게 답글을 입력하세요...`
                                        : "메시지를 입력하세요..."
                                }
                                maxLength={1000}
                                className="w-full pl-3.5 pr-14 py-2 text-xs sm:text-sm rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium transition-all"
                            />
                            <span
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none font-mono">
                                {newContent.length}/1000
                            </span>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={!newContent.trim() || isSubmitting}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 active:scale-95 disabled:cursor-not-allowed shadow-sm"
                        >
                            <Send className="w-3.5 h-3.5"/>
                            <span>{isSubmitting ? "전송 중..." : replyingTo ? "답글" : "전송"}</span>
                        </button>
                    </div>

                    {commentSuccess && (
                        <div
                            className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold animate-fadeIn pt-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5"/>
                            <span>메시지가 등록되었습니다!</span>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};
