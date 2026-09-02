"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    Ban,
    Clock,
    CornerDownRight,
    Dices,
    Heart,
    MessageCircle,
    MessageSquare,
    RotateCw,
    Search,
    Send,
    Share2,
    Sparkles,
    Trash2,
    X,
} from "lucide-react";

import {CommentItem} from "@/types/comment";
import {formatRelativeTime} from "@lib/timeUtils";
import {generateUserTag, getRandomNickname} from "@/data/nicknames";

interface ReplyTarget {
    id: string; // Root parent thread ID
    author: string;
    authorTag?: string;
    content: string;
}

interface ChatViewProps {
    comments: CommentItem[];
    onAddComment: (data: {
        author?: string;
        content: string;
        category?: string;
        parentId?: string;
        replyToAuthor?: string;
        authorTag?: string;
        replyToAuthorTag?: string;
    }) => Promise<void>;
    onLikeComment?: (id: string) => Promise<void>;
    onDeleteComment?: (id: string, authorTag?: string) => Promise<void>;
    onRefresh: (force?: boolean) => Promise<void>;
    isRefreshing?: boolean;
}

const CATEGORIES = [
    {id: "ALL", label: "전체"},
    {id: "잡담", label: "💬 일상·잡담"},
    {id: "제보", label: "📢 실시간 제보"},
    {id: "꿀팁", label: "💡 버스 꿀팁"},
    {id: "질문", label: "❓ 질문·문의"},
    {id: "분실물", label: "🎒 분실물"},
] as const;

const PRESET_CHIPS = [
    {label: "🚌 지금 만차예요", text: "지금 버스 만차예요! 뒤차 타시는 걸 추천해요.", category: "제보"},
    {label: "📍 학관 방금 출발", text: "방금 학생회관 정류장 지나서 출발했습니다.", category: "제보"},
    {label: "⏳ 5분 지연 중", text: "도로 정체로 예정보다 5분 정도 지연되고 있어요.", category: "제보"},
    {label: "✨ 좌석 여유 있어요", text: "현재 좌석 여유 많고 쾌적하게 운행 중입니다.", category: "꿀팁"},
    {label: "🎒 분실물 문의", text: "혹시 버스 안에서 분실물 보신 분 계신가요?", category: "분실물"},
    {label: "👋 좋은 하루 보내세요", text: "오늘도 다들 안전하고 좋은 하루 보내세요!", category: "잡담"},
];

function getAvatarGradient(name: string, tag = ""): string {
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

// Convert URLs in string into clickable links
function renderFormattedContent(content: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);

    return parts.map((part, index) => {
        if (part.match(urlRegex)) {
            return (
                <a
                    key={index}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline break-all font-semibold inline-flex items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                >
                    {part}
                </a>
            );
        }
        return part;
    });
}

export const ChatView: React.FC<ChatViewProps> = ({
                                                      comments,
                                                      onAddComment,
                                                      onLikeComment,
                                                      onDeleteComment,
                                                      onRefresh,
                                                      isRefreshing = false,
                                                  }) => {
    // Identity State
    const [authorName, setAuthorName] = useState("");
    const [userTag, setUserTag] = useState("");

    // Composer State
    const [composerContent, setComposerContent] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("잡담");
    const [isComposerExpanded, setIsComposerExpanded] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cooldown, setCooldown] = useState<number>(0);

    // Active Inline Reply State
    const [activeReplyParentId, setActiveReplyParentId] = useState<string | null>(null);
    const [inlineReplyContent, setInlineReplyContent] = useState("");
    const [inlineReplyTarget, setInlineReplyTarget] = useState<ReplyTarget | null>(null);
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);

    // Filter & Search State
    const [filterCategory, setFilterCategory] = useState<string>("ALL");
    const [searchQuery, setSearchQuery] = useState<string>("");

    // User Interaction Memory
    const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());
    const [myCommentIds, setMyCommentIds] = useState<Set<string>>(new Set());
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const inlineReplyTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Show temporary toast notification
    const showToast = useCallback((msg: string) => {
        setToastMessage(msg);
        setTimeout(() => {
            setToastMessage((prev) => (prev === msg ? null : prev));
        }, 3000);
    }, []);

    // Cooldown countdown timer (Anti-flood)
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => {
            setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    // Initialize user nickname, tag & saved likes
    useEffect(() => {
        try {
            let savedNick = localStorage.getItem("wbus_chat_nickname");
            if (!savedNick || !savedNick.trim() || savedNick.trim() === "익명") {
                savedNick = getRandomNickname();
                localStorage.setItem("wbus_chat_nickname", savedNick);
            }
            setAuthorName(savedNick);

            let savedTag = localStorage.getItem("wbus_user_tag");
            if (!savedTag || !savedTag.startsWith("#")) {
                savedTag = generateUserTag();
                localStorage.setItem("wbus_user_tag", savedTag);
            }
            setUserTag(savedTag);

            const savedLikes = localStorage.getItem("wbus_liked_comments");
            if (savedLikes) {
                setLikedCommentIds(new Set(JSON.parse(savedLikes)));
            }

            const savedMy = localStorage.getItem("wbus_my_comments");
            if (savedMy) {
                setMyCommentIds(new Set(JSON.parse(savedMy)));
            }
        } catch {
            setAuthorName(getRandomNickname());
            setUserTag(generateUserTag());
        }
    }, []);

    // Re-roll random nickname
    const handleRerollNickname = () => {
        const next = getRandomNickname(authorName);
        setAuthorName(next);
        try {
            localStorage.setItem("wbus_chat_nickname", next);
            showToast(`닉네임이 '${next}'(으)로 변경되었습니다`);
        } catch {
            // Ignore
        }
    };

    // Auto-expand textarea height
    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setComposerContent(e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
    };

    const handleInlineReplyTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInlineReplyContent(e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
    };

    const handlePresetSelect = (preset: typeof PRESET_CHIPS[number]) => {
        setComposerContent(preset.text);
        setSelectedCategory(preset.category);
        setIsComposerExpanded(true);
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    };

    // Submit root thread
    const handlePostThread = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (cooldown > 0) {
            showToast(`보안 및 도배 방지를 위해 ${cooldown}초 후에 다시 작성할 수 있습니다.`);
            return;
        }
        const content = composerContent.trim();
        if (!content || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const finalAuthor = authorName.trim() || getRandomNickname();
            const finalTag = userTag || generateUserTag();

            await onAddComment({
                author: finalAuthor,
                authorTag: finalTag,
                content,
                category: selectedCategory,
            });

            setComposerContent("");
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }
            setIsComposerExpanded(false);
            setCooldown(3);
            showToast("스퀘어에 새로운 글이 등록되었습니다 ✨");
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : "글 작성에 실패했습니다. 잠시 후 다시 시도해주세요.";
            showToast(errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Open inline reply box for a thread
    const handleStartReply = (targetComment: CommentItem, rootThreadId: string) => {
        if (activeReplyParentId === rootThreadId && inlineReplyTarget?.id === targetComment.id) {
            setActiveReplyParentId(null);
            setInlineReplyTarget(null);
            setInlineReplyContent("");
            return;
        }

        setActiveReplyParentId(rootThreadId);
        setInlineReplyTarget({
            id: targetComment.id,
            author: targetComment.author,
            authorTag: targetComment.authorTag,
            content: targetComment.isDeleted ? "삭제된 메시지" : targetComment.content,
        });
        setInlineReplyContent("");

        setTimeout(() => {
            if (inlineReplyTextareaRef.current) {
                inlineReplyTextareaRef.current.focus();
            }
        }, 60);
    };

    // Submit reply to thread
    const handlePostReply = async (rootThreadId: string) => {
        if (cooldown > 0) {
            showToast(`보안 및 도배 방지를 위해 ${cooldown}초 후에 다시 작성할 수 있습니다.`);
            return;
        }
        const content = inlineReplyContent.trim();
        if (!content || isSubmittingReply) return;

        setIsSubmittingReply(true);
        try {
            const finalAuthor = authorName.trim() || getRandomNickname();
            const finalTag = userTag || generateUserTag();

            await onAddComment({
                author: finalAuthor,
                authorTag: finalTag,
                content,
                parentId: rootThreadId,
                replyToAuthor: inlineReplyTarget?.author,
                replyToAuthorTag: inlineReplyTarget?.authorTag,
                category: selectedCategory,
            });

            setInlineReplyContent("");
            setActiveReplyParentId(null);
            setInlineReplyTarget(null);
            setCooldown(3);
            showToast("답글이 등록되었습니다 💬");
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : "답글 작성에 실패했습니다.";
            showToast(errorMsg);
        } finally {
            setIsSubmittingReply(false);
        }
    };

    // Like thread / reply
    const handleLike = async (id: string) => {
        if (likedCommentIds.has(id)) return;

        const next = new Set(likedCommentIds);
        next.add(id);
        setLikedCommentIds(next);
        try {
            localStorage.setItem("wbus_liked_comments", JSON.stringify(Array.from(next)));
        } catch {
            // Ignore
        }

        if (onLikeComment) {
            try {
                await onLikeComment(id);
            } catch (err: unknown) {
                const errorMsg = err instanceof Error ? err.message : "공감 처리에 실패했습니다.";
                showToast(errorMsg);
            }
        }
    };

    // Delete thread / reply
    const handleDelete = async (id: string) => {
        if (!window.confirm("이 글(스레드)을 삭제하시겠습니까?")) return;

        if (onDeleteComment) {
            setDeletingId(id);
            try {
                await onDeleteComment(id, userTag);
                showToast("글이 삭제되었습니다");
            } catch (err: unknown) {
                const errorMsg = err instanceof Error ? err.message : "삭제 권한이 없거나 이미 삭제된 글입니다.";
                showToast(errorMsg);
            } finally {
                setDeletingId(null);
            }
        }
    };

    // Share / Copy content
    const handleShare = async (comment: CommentItem) => {
        const shareText = `[wBus 스퀘어]\n${comment.author}: ${comment.content}\nhttps://wbus.app/chat`;
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(shareText);
                showToast("내용이 클립보드에 복사되었습니다 📋");
            }
        } catch {
            showToast("복사 실패");
        }
    };

    const isMyComment = (comment: CommentItem) => {
        if (userTag && comment.authorTag && comment.authorTag === userTag) return true;
        if (myCommentIds.has(comment.id)) return true;
        return false;
    };

    // Organize root threads and their child replies
    const {rootThreads, repliesByThreadId} = useMemo(() => {
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

        // Newest threads first
        roots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Replies in ascending order
        for (const pid in replies) {
            replies[pid].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
        }

        return {rootThreads: roots, repliesByThreadId: replies};
    }, [comments]);

    // Filter threads by search and category
    const filteredThreads = useMemo(() => {
        return rootThreads.filter((root) => {
            const threadReplies = repliesByThreadId[root.id] || [];

            // 1. Category filter
            if (filterCategory !== "ALL") {
                const matchRoot = root.category === filterCategory;
                const matchReply = threadReplies.some((r) => r.category === filterCategory);
                if (!matchRoot && !matchReply) return false;
            }

            // 2. Search query
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
    }, [rootThreads, repliesByThreadId, filterCategory, searchQuery]);

    return (
        <div className="w-full flex-1 min-h-0 flex flex-col gap-3 relative animate-fadeIn">
            {/* Toast Notification */}
            {toastMessage && (
                <div
                    className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 text-xs font-black shadow-2xl backdrop-blur-md animate-slideDown flex items-center gap-2 border border-white/10 max-w-[90vw] text-center">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 dark:text-amber-500 shrink-0"/>
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* 1. Square Header & Filter Controls Bar */}
            <div
                className="shrink-0 backdrop-blur-2xl bg-white/80 dark:bg-[#111622]/85 rounded-3xl p-3 sm:p-4 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
                {/* Header Title & Live Status */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div
                            className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-xs">
                            <MessageSquare className="w-4 h-4"/>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                    스퀘어
                                </h2>
                                <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black border border-emerald-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                                    Live Agora
                                </span>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                                Community Square
                            </p>
                        </div>
                    </div>

                    {/* Refresh Button */}
                    <button
                        type="button"
                        onClick={() => onRefresh(true)}
                        disabled={isRefreshing}
                        className="p-2 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                        title="새로고침"
                    >
                        <RotateCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-blue-500" : ""}`}/>
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative w-full">
                    <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="닉네임, 내용, #태그 검색..."
                        className="w-full pl-9 pr-8 py-2 text-xs rounded-2xl bg-slate-100/80 dark:bg-white/5 border border-transparent focus:border-blue-500 text-slate-900 dark:text-white outline-none font-medium transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5"/>
                        </button>
                    )}
                </div>

                {/* Category Filter Pills */}
                <div
                    className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5 border-t border-slate-100 dark:border-white/5 pt-2">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setFilterCategory(cat.id)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                filterCategory === cat.id
                                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                                    : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. Top Square Composer Card ("스퀘어에 새로운 이야기 남기기...") */}
            <div
                className="shrink-0 backdrop-blur-2xl bg-white/90 dark:bg-[#111622]/90 rounded-3xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-white/10 shadow-xs transition-all">
                {/* Author Info Bar with Re-roll */}
                <div
                    className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-2">
                        <div
                            className={`w-7 h-7 rounded-xl bg-gradient-to-tr ${getAvatarGradient(
                                authorName,
                                userTag
                            )} text-white flex items-center justify-center font-black text-xs shadow-xs`}
                        >
                            {authorName.charAt(0)}
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-slate-900 dark:text-white">
                                    {authorName}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                                    {userTag}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleRerollNickname}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 text-[11px] font-bold transition-all cursor-pointer active:scale-95"
                        title="랜덤 닉네임 새로고침"
                    >
                        <Dices className="w-3.5 h-3.5 text-blue-500"/>
                        <span>닉네임 변경</span>
                    </button>
                </div>

                {/* Textarea Composer */}
                <div className="space-y-2.5">
                    <textarea
                        ref={textareaRef}
                        value={composerContent}
                        onChange={handleTextareaChange}
                        onFocus={() => setIsComposerExpanded(true)}
                        placeholder="스퀘어에 새로운 이야기를 남겨보세요... (실시간 버스 제보, 질문, 일상 등)"
                        rows={isComposerExpanded ? 3 : 2}
                        maxLength={500}
                        className="w-full bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none resize-none font-medium leading-relaxed"
                    />

                    {/* Quick Template Chips */}
                    {isComposerExpanded && (
                        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
                            {PRESET_CHIPS.map((chip, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handlePresetSelect(chip)}
                                    className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[11px] font-bold border border-blue-200/60 dark:border-blue-800/40 transition-all cursor-pointer whitespace-nowrap"
                                >
                                    {chip.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Category Selector + Submit Button */}
                    <div
                        className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                        <div className="flex flex-wrap items-center gap-1">
                            {CATEGORIES.filter((c) => c.id !== "ALL").map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                                        selectedCategory === cat.id
                                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                            : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                                    }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>

                        {/* Submit Action */}
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-mono font-semibold text-slate-400">
                                {composerContent.length}/500
                            </span>
                            <button
                                type="button"
                                onClick={() => handlePostThread()}
                                disabled={!composerContent.trim() || isSubmitting || cooldown > 0}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-black transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none shadow-xs"
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
            </div>

            {/* 3. Square Threads Feed Container (Scrollable) */}
            <div
                className="flex-1 min-h-0 backdrop-blur-2xl bg-white/80 dark:bg-[#111622]/85 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs overflow-y-auto custom-scrollbar p-3.5 sm:p-4 space-y-4">
                {filteredThreads.length === 0 ? (
                    <div className="py-20 text-center space-y-3">
                        <div
                            className="w-12 h-12 rounded-3xl bg-slate-100 dark:bg-white/5 text-slate-400 mx-auto flex items-center justify-center">
                            <MessageCircle className="w-6 h-6"/>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-black text-slate-700 dark:text-slate-300">
                                등록된 이야기가 없습니다.
                            </p>
                            <p className="text-xs text-slate-400">
                                상단 입력창에서 첫 번째 스퀘어 글을 남겨보세요!
                            </p>
                        </div>
                    </div>
                ) : (
                    filteredThreads.map((thread) => {
                        const threadReplies = repliesByThreadId[thread.id] || [];
                        const isLiked = likedCommentIds.has(thread.id);
                        const isReplyOpen = activeReplyParentId === thread.id;

                        return (
                            <div
                                key={thread.id}
                                className="p-3.5 sm:p-4 rounded-3xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-all space-y-3"
                            >
                                {/* Root Thread Card with Visual Connector Rail */}
                                <div className="flex items-start gap-3">
                                    {/* Avatar & Continuous Thread Line */}
                                    <div className="flex flex-col items-center self-stretch shrink-0">
                                        <div
                                            className={`w-8 h-8 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(
                                                thread.author,
                                                thread.authorTag
                                            )} text-white flex items-center justify-center font-black text-xs shadow-xs`}
                                        >
                                            {thread.isDeleted ? (
                                                <Ban className="w-4 h-4 text-slate-300"/>
                                            ) : (
                                                thread.author.charAt(0)
                                            )}
                                        </div>
                                        {/* Connecting Thread Rail Line if there are replies or active composer */}
                                        {(threadReplies.length > 0 || isReplyOpen) && (
                                            <div
                                                className="w-0.5 flex-1 bg-slate-200 dark:bg-white/10 my-1 rounded-full"/>
                                        )}
                                    </div>

                                    {/* Thread Content Area */}
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                        {/* Author, Tag, Badges & Timestamp */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span
                                                    className={`text-xs font-black ${
                                                        thread.isDeleted
                                                            ? "text-slate-400 dark:text-slate-500"
                                                            : "text-slate-900 dark:text-white"
                                                    }`}
                                                >
                                                    {thread.author}
                                                </span>
                                                {thread.authorTag && (
                                                    <span
                                                        className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                                                        {thread.authorTag}
                                                    </span>
                                                )}
                                                {!thread.isDeleted && thread.category && (
                                                    <span
                                                        className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                                                            thread.category === "제보"
                                                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                                                : thread.category === "꿀팁"
                                                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                                                    : thread.category === "분실물"
                                                                        ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                                                        : "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                                                        }`}
                                                    >
                                                        {thread.category}
                                                    </span>
                                                )}
                                            </div>

                                            <div
                                                className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
                                                <Clock className="w-3 h-3"/>
                                                <span>{formatRelativeTime(thread.createdAt)}</span>
                                            </div>
                                        </div>

                                        {/* Thread Body */}
                                        {thread.isDeleted ? (
                                            <p className="text-xs text-slate-400 dark:text-slate-500 italic flex items-center gap-1 select-none">
                                                <Ban className="w-3 h-3 opacity-60"/>
                                                <span>삭제된 글입니다.</span>
                                            </p>
                                        ) : (
                                            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap break-words leading-relaxed">
                                                {renderFormattedContent(thread.content)}
                                            </p>
                                        )}

                                        {/* Action Bar */}
                                        {!thread.isDeleted && (
                                            <div className="flex items-center gap-1.5 pt-1">
                                                {/* Like Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleLike(thread.id)}
                                                    disabled={isLiked}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer active:scale-90 ${
                                                        isLiked
                                                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                                            : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400"
                                                    }`}
                                                >
                                                    <Heart
                                                        className={`w-3.5 h-3.5 ${
                                                            isLiked ? "fill-rose-500 text-rose-500" : ""
                                                        }`}
                                                    />
                                                    <span>{thread.likes || 0}</span>
                                                </button>

                                                {/* Reply Trigger */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartReply(thread, thread.id)}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                                                        isReplyOpen
                                                            ? "bg-blue-600 text-white"
                                                            : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"
                                                    }`}
                                                >
                                                    <MessageCircle className="w-3.5 h-3.5"/>
                                                    <span>답글</span>
                                                    {threadReplies.length > 0 && (
                                                        <span className="font-mono text-[11px]">
                                                            {threadReplies.length}
                                                        </span>
                                                    )}
                                                </button>

                                                {/* Share Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleShare(thread)}
                                                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-all cursor-pointer active:scale-90"
                                                    title="글 공유 / 복사"
                                                >
                                                    <Share2 className="w-3.5 h-3.5"/>
                                                </button>

                                                {/* Delete Button (If Author) */}
                                                {isMyComment(thread) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(thread.id)}
                                                        disabled={deletingId === thread.id}
                                                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer active:scale-90 disabled:opacity-50"
                                                        title="글 삭제"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5"/>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Thread Nested Replies (Children) */}
                                {threadReplies.length > 0 && (
                                    <div
                                        className="ml-5 sm:ml-6 pl-3 sm:pl-4 border-l-2 border-slate-200 dark:border-white/10 space-y-2.5 pt-1">
                                        {threadReplies.map((reply) => {
                                            const isReplyLiked = likedCommentIds.has(reply.id);

                                            return (
                                                <div
                                                    key={reply.id}
                                                    className="p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 space-y-1.5 transition-all"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <div
                                                                className={`w-5 h-5 rounded-lg bg-gradient-to-tr ${getAvatarGradient(
                                                                    reply.author,
                                                                    reply.authorTag
                                                                )} text-white flex items-center justify-center font-black text-[10px] shadow-xs`}
                                                            >
                                                                {reply.author.charAt(0)}
                                                            </div>
                                                            <span
                                                                className="text-xs font-extrabold text-slate-900 dark:text-white">
                                                                {reply.author}
                                                            </span>
                                                            {reply.authorTag && (
                                                                <span
                                                                    className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
                                                                    {reply.authorTag}
                                                                </span>
                                                            )}
                                                            {reply.replyToAuthor && (
                                                                <span
                                                                    className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded">
                                                                    @{reply.replyToAuthor}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <span className="text-[9px] text-slate-400 font-medium">
                                                            {formatRelativeTime(reply.createdAt)}
                                                        </span>
                                                    </div>

                                                    {/* Reply Body */}
                                                    {reply.isDeleted ? (
                                                        <p className="text-xs text-slate-400 dark:text-slate-500 italic flex items-center gap-1">
                                                            <Ban className="w-3 h-3 opacity-60"/>
                                                            <span>삭제된 답글입니다.</span>
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap break-words leading-relaxed pl-6">
                                                            {renderFormattedContent(reply.content)}
                                                        </p>
                                                    )}

                                                    {/* Reply Action Row */}
                                                    {!reply.isDeleted && (
                                                        <div
                                                            className="flex items-center justify-between gap-2 pt-1 pl-6">
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleLike(reply.id)}
                                                                    disabled={isReplyLiked}
                                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                                                        isReplyLiked
                                                                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                                                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                                    }`}
                                                                >
                                                                    <Heart
                                                                        className={`w-3 h-3 ${
                                                                            isReplyLiked
                                                                                ? "fill-rose-500 text-rose-500"
                                                                                : ""
                                                                        }`}
                                                                    />
                                                                    <span>{reply.likes || 0}</span>
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleStartReply(reply, thread.id)
                                                                    }
                                                                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer"
                                                                >
                                                                    답글
                                                                </button>
                                                            </div>

                                                            {isMyComment(reply) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDelete(reply.id)}
                                                                    disabled={deletingId === reply.id}
                                                                    className="p-1 text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                                                                    title="답글 삭제"
                                                                >
                                                                    <Trash2 className="w-3 h-3"/>
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Inline Reply Composer Box */}
                                {isReplyOpen && (
                                    <div
                                        className="ml-5 sm:ml-6 pl-3 sm:pl-4 border-l-2 border-blue-500 dark:border-blue-400 pt-2 animate-slideDown">
                                        <div
                                            className="p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 space-y-2">
                                            <div
                                                className="flex items-center justify-between text-[11px] font-bold text-blue-600 dark:text-blue-400">
                                                <div className="flex items-center gap-1">
                                                    <CornerDownRight className="w-3 h-3"/>
                                                    <span>
                                                        @{inlineReplyTarget?.author || thread.author}님에게 답글 작성
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveReplyParentId(null);
                                                        setInlineReplyTarget(null);
                                                    }}
                                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                                                >
                                                    <X className="w-3.5 h-3.5"/>
                                                </button>
                                            </div>

                                            <textarea
                                                ref={inlineReplyTextareaRef}
                                                value={inlineReplyContent}
                                                onChange={handleInlineReplyTextareaChange}
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
                                                    onClick={() => handlePostReply(thread.id)}
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
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
