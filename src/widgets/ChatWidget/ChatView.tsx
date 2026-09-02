"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    Ban,
    Clock,
    CornerDownRight,
    Dices,
    Flame,
    Hash,
    Heart,
    MessageCircle,
    MessageSquare,
    RotateCw,
    Search,
    Send,
    Share2,
    Sparkles,
    Trash2,
    TrendingUp,
    User,
    X,
} from "lucide-react";

import {CommentItem} from "@/types/comment";
import {formatRelativeTime} from "@lib/timeUtils";
import {generateUserTag, getRandomNickname} from "@/data/nicknames";
import {getAvatarGradient, ModalTab, SquareProfileModal} from "./SquareProfileModal";

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

interface TrendingTag {
    tag: string;
    count: number;
    score: number;
}

const QUICK_HASHTAGS = [
    "#실시간",
    "#버스상황",
    "#셔틀지연",
    "#좌석여유",
    "#분실물",
    "#학관",
    "#질문",
    "#일상",
];

// Convert URLs, Hashtags, and Mentions into interactive rich elements
function renderRichContent(content: string, onHashtagClick?: (tag: string) => void) {
    const tokenRegex = /(https?:\/\/[^\s]+|#[a-zA-Z0-9_\uac00-\ud7a3]+|@[a-zA-Z0-9_\uac00-\ud7a3]+)/g;
    const parts = content.split(tokenRegex);

    return parts.map((part, index) => {
        if (!part) return null;

        // 1. External URL
        if (part.startsWith("http://") || part.startsWith("https://")) {
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

        // 2. Hashtag (#tag)
        if (part.startsWith("#") && part.length > 1) {
            return (
                <span
                    key={index}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onHashtagClick) {
                            onHashtagClick(part);
                        }
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-extrabold cursor-pointer hover:underline transition-colors inline-block bg-blue-50/60 dark:bg-blue-950/40 px-1.5 py-0.5 rounded-lg text-[13px] sm:text-sm mx-0.5"
                    role="button"
                    tabIndex={0}
                >
                    {part}
                </span>
            );
        }

        // 3. Mention (@user)
        if (part.startsWith("@") && part.length > 1) {
            return (
                <span
                    key={index}
                    className="text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded-md text-[13px] sm:text-sm mx-0.5"
                >
                    {part}
                </span>
            );
        }

        // Regular Text
        return <span key={index}>{part}</span>;
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

    // Modal State
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [profileModalInitialTab, setProfileModalInitialTab] = useState<ModalTab>("OVERVIEW");

    // Feed Tab & Filter State (Generic Community Stream)
    const [activeTab, setActiveTab] = useState<"LATEST" | "HOT" | "MINE">("LATEST");
    const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Composer State
    const [composerContent, setComposerContent] = useState("");
    const [isComposerExpanded, setIsComposerExpanded] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cooldown, setCooldown] = useState<number>(0);

    // Active Inline Reply State
    const [activeReplyParentId, setActiveReplyParentId] = useState<string | null>(null);
    const [inlineReplyContent, setInlineReplyContent] = useState("");
    const [inlineReplyTarget, setInlineReplyTarget] = useState<ReplyTarget | null>(null);
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);

    // User Interaction Memory
    const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());
    const [myCommentIds, setMyCommentIds] = useState<Set<string>>(new Set());
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const inlineReplyTextareaRef = useRef<HTMLTextAreaElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Show temporary toast notification
    const showToast = useCallback((msg: string) => {
        setToastMessage(msg);
        setTimeout(() => {
            setToastMessage((prev) => (prev === msg ? null : prev));
        }, 3000);
    }, []);

    // Scroll to specific thread with highlight effect
    const handleScrollToThread = useCallback((threadId: string) => {
        const el = document.getElementById(`thread-${threadId}`);
        if (el) {
            el.scrollIntoView({behavior: "smooth", block: "center"});
            el.classList.add("ring-2", "ring-rose-500", "ring-offset-2", "dark:ring-offset-slate-900");
            setTimeout(() => {
                el.classList.remove("ring-2", "ring-rose-500", "ring-offset-2", "dark:ring-offset-slate-900");
            }, 2500);
        }
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
        e.target.style.height = `${Math.min(e.target.scrollHeight, 220)}px`;
    };

    const handleInlineReplyTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInlineReplyContent(e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
    };

    // Insert quick hashtag to composer
    const handleInsertHashtag = (tag: string) => {
        setIsComposerExpanded(true);
        setComposerContent((prev) => {
            const trimmed = prev.trim();
            if (!trimmed) return `${tag} `;
            if (trimmed.includes(tag)) return prev;
            return `${trimmed} ${tag} `;
        });
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    };

    // Filter by hashtag
    const handleHashtagClick = (tag: string) => {
        if (!tag) {
            setSelectedHashtag(null);
            return;
        }
        setSelectedHashtag((prev) => (prev === tag ? null : tag));
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
            });

            setComposerContent("");
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }
            setIsComposerExpanded(false);
            setCooldown(3);
            showToast("새로운 글이 등록되었습니다!");
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

    const isMyComment = useCallback(
        (comment: CommentItem) => {
            if (userTag && comment.authorTag && comment.authorTag === userTag) return true;
            if (myCommentIds.has(comment.id)) return true;
            return false;
        },
        [userTag, myCommentIds]
    );

    // Organize root threads and their child replies
    const {rootThreads, repliesByThreadId, myTotalPostsCount} = useMemo(() => {
        const roots: CommentItem[] = [];
        const replies: Record<string, CommentItem[]> = {};
        const commentIdSet = new Set(comments.map((c) => c.id));
        let myCount = 0;

        for (const c of comments) {
            if (userTag && c.authorTag === userTag) {
                myCount++;
            }
            if (c.parentId && commentIdSet.has(c.parentId)) {
                if (!replies[c.parentId]) {
                    replies[c.parentId] = [];
                }
                replies[c.parentId].push(c);
            } else {
                roots.push(c);
            }
        }

        // Replies in ascending order
        for (const pid in replies) {
            replies[pid].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
        }

        return {rootThreads: roots, repliesByThreadId: replies, myTotalPostsCount: myCount};
    }, [comments, userTag]);

    // Compute Real-time Trending Hashtags & Ranking
    const {trendingTags, topRankedThreads} = useMemo(() => {
        const tagMap: Record<string, { count: number; score: number }> = {};
        const hashtagRegex = /#[a-zA-Z0-9_\uac00-\ud7a3]+/g;

        // 1. Analyze all comments for hashtag extraction and ranking
        for (const comment of comments) {
            if (comment.isDeleted) continue;
            const matches = comment.content.match(hashtagRegex);
            if (matches) {
                const uniqueInPost = Array.from(new Set(matches));
                for (const rawTag of uniqueInPost) {
                    const tag = rawTag.trim();
                    if (!tagMap[tag]) {
                        tagMap[tag] = {count: 0, score: 0};
                    }
                    tagMap[tag].count += 1;
                    tagMap[tag].score += 3 + (comment.likes || 0) * 2;
                }
            }
        }

        // Convert to sorted array
        const sortedTags: TrendingTag[] = Object.entries(tagMap)
            .map(([tag, data]) => ({tag, count: data.count, score: data.score}))
            .sort((a, b) => b.score - a.score || b.count - a.count)
            .slice(0, 8);

        // 2. Compute Top Ranked / Hot Threads (Likes + Replies weighting)
        const scoredThreads = rootThreads
            .filter((root) => !root.isDeleted)
            .map((root) => {
                const replyList = repliesByThreadId[root.id] || [];
                const replyLikes = replyList.reduce((acc, r) => acc + (r.likes || 0), 0);
                const score = (root.likes || 0) * 3 + replyList.length * 4 + replyLikes * 2;
                return {
                    thread: root,
                    replyCount: replyList.length,
                    score,
                };
            })
            .sort((a, b) => b.score - a.score);

        return {
            trendingTags: sortedTags,
            topRankedThreads: scoredThreads.slice(0, 4),
        };
    }, [comments, rootThreads, repliesByThreadId]);

    // Filter and Sort Threads based on active tab, hashtag, and search
    const filteredThreads = useMemo(() => {
        const list = rootThreads.filter((root) => {
            const threadReplies = repliesByThreadId[root.id] || [];

            // 1. My Posts tab filter
            if (activeTab === "MINE") {
                const isRootMine = isMyComment(root);
                const isAnyReplyMine = threadReplies.some((r) => isMyComment(r));
                if (!isRootMine && !isAnyReplyMine) return false;
            }

            // 2. Hashtag filter
            if (selectedHashtag) {
                const tagLower = selectedHashtag.toLowerCase();
                const inRoot = root.content.toLowerCase().includes(tagLower);
                const inReplies = threadReplies.some((r) => r.content.toLowerCase().includes(tagLower));
                if (!inRoot && !inReplies) return false;
            }

            // 3. Search query
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

        // Sort by Tab Mode
        if (activeTab === "HOT") {
            return list.sort((a, b) => {
                const aReplies = repliesByThreadId[a.id]?.length || 0;
                const bReplies = repliesByThreadId[b.id]?.length || 0;
                const aScore = (a.likes || 0) * 3 + aReplies * 4;
                const bScore = (b.likes || 0) * 3 + bReplies * 4;
                return bScore - aScore || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
        }

        // Default: Latest First
        return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [rootThreads, repliesByThreadId, selectedHashtag, searchQuery, activeTab, isMyComment]);

    return (
        <div className="w-full flex-1 min-h-0 flex flex-col relative animate-fadeIn">
            {/* Toast Notification */}
            {toastMessage && (
                <div
                    className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 text-xs font-black shadow-2xl backdrop-blur-md animate-slideDown flex items-center gap-2 border border-white/10 max-w-[90vw] text-center"
                >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 dark:text-amber-500 shrink-0"/>
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Profile & Radar Modal */}
            <SquareProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                initialTab={profileModalInitialTab}
                authorName={authorName}
                userTag={userTag}
                onRerollNickname={handleRerollNickname}
                myTotalPostsCount={myTotalPostsCount}
                likedCount={likedCommentIds.size}
                onSelectMyPosts={() => {
                    setActiveTab("MINE");
                    setIsProfileModalOpen(false);
                }}
                trendingTags={trendingTags}
                selectedHashtag={selectedHashtag}
                onSelectHashtag={handleHashtagClick}
                topRankedThreads={topRankedThreads}
                onSelectThread={handleScrollToThread}
            />

            {/* Main Responsive Grid Layout (Main Feed Stream + Desktop Radar Sidebar) */}
            <div className="w-full flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">

                {/* ========================================================================= */}
                {/* 1. PRIMARY TIMELINE COLUMN (Left / Center)                               */}
                {/* ========================================================================= */}
                <div className="lg:col-span-8 flex flex-col gap-3 min-h-0 h-full">

                    {/* Header Controls Bar */}
                    <div
                        className="shrink-0 backdrop-blur-2xl bg-white/80 dark:bg-[#111622]/85 rounded-3xl p-3 sm:p-4 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3"
                    >
                        <div className="flex items-center justify-between gap-2">
                            {/* Title & Live Status */}
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                    className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-xs shrink-0"
                                >
                                    <MessageSquare className="w-4 h-4"/>
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                            스퀘어
                                        </h2>
                                        <span
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black border border-emerald-500/20 shrink-0"
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                                            Live Agora
                                        </span>
                                    </div>
                                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                        실시간 소통 & 제보 광장
                                    </p>
                                </div>
                            </div>

                            {/* Feed Mode Tabs & Action Icons */}
                            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                                <div
                                    className="flex items-center p-0.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/5"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("LATEST")}
                                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                            activeTab === "LATEST"
                                                ? "bg-white dark:bg-white/15 text-blue-600 dark:text-white shadow-xs"
                                                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                                        }`}
                                    >
                                        최신순
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("HOT")}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                            activeTab === "HOT"
                                                ? "bg-rose-500 text-white shadow-xs"
                                                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                                        }`}
                                    >
                                        <Flame className="w-3 h-3"/>
                                        <span>인기</span>
                                        {topRankedThreads.length > 0 && (
                                            <span
                                                className={`text-[10px] font-mono font-bold px-1 py-0.2 rounded-full ${
                                                    activeTab === "HOT"
                                                        ? "bg-white/20 text-white"
                                                        : "bg-rose-500/10 text-rose-500 dark:text-rose-400"
                                                }`}
                                            >
                                                {topRankedThreads.length}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("MINE")}
                                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                            activeTab === "MINE"
                                                ? "bg-indigo-600 text-white shadow-xs"
                                                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                                        }`}
                                    >
                                        내 글
                                    </button>
                                </div>

                                {/* Search Toggle */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSearchOpen(!isSearchOpen);
                                        if (!isSearchOpen) {
                                            setTimeout(() => searchInputRef.current?.focus(), 100);
                                        }
                                    }}
                                    className={`p-2 rounded-2xl transition-all cursor-pointer active:scale-95 ${
                                        isSearchOpen || searchQuery
                                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                                            : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"
                                    }`}
                                    title="검색"
                                >
                                    <Search className="w-4 h-4"/>
                                </button>

                                {/* Refresh Button */}
                                <button
                                    type="button"
                                    onClick={() => onRefresh(true)}
                                    disabled={isRefreshing}
                                    className="p-2 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                                    title="새로고침"
                                >
                                    <RotateCw
                                        className={`w-4 h-4 ${isRefreshing ? "animate-spin text-blue-500" : ""}`}
                                    />
                                </button>

                                {/* Profile & Radar Trigger Button */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProfileModalInitialTab("OVERVIEW");
                                        setIsProfileModalOpen(true);
                                    }}
                                    className="flex items-center gap-1.5 p-1 sm:px-2 sm:py-1 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-all cursor-pointer border border-slate-200/50 dark:border-white/5 active:scale-95"
                                    title="내 프로필 및 레이더 열기"
                                >
                                    <div
                                        className={`w-6 h-6 rounded-xl bg-gradient-to-tr ${getAvatarGradient(
                                            authorName,
                                            userTag
                                        )} text-white flex items-center justify-center font-black text-[11px] shadow-xs shrink-0`}
                                    >
                                        {authorName.charAt(0) || "?"}
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Search Input Accordion */}
                        {isSearchOpen && (
                            <div className="relative w-full pt-1 animate-slideDown">
                                <Search
                                    className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="닉네임, #해시태그, 키워드 검색..."
                                    className="w-full pl-9 pr-8 py-2 text-xs rounded-2xl bg-slate-100/90 dark:bg-white/5 border border-transparent focus:border-blue-500 text-slate-900 dark:text-white outline-none font-medium transition-all shadow-inner"
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
                        )}

                        {/* Mobile Only: Horizontal Trending Hashtags Strip */}
                        <div className="lg:hidden pt-2 border-t border-slate-100 dark:border-white/5">
                            {/* Hashtags Strip */}
                            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
                                <span
                                    className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5 shrink-0">
                                    <TrendingUp className="w-3 h-3 text-blue-500"/> 트렌드:
                                </span>
                                {trendingTags.length > 0 ? (
                                    trendingTags.map((t, idx) => (
                                        <button
                                            key={t.tag}
                                            type="button"
                                            onClick={() => handleHashtagClick(t.tag)}
                                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
                                                selectedHashtag === t.tag
                                                    ? "bg-blue-600 text-white shadow-xs"
                                                    : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-blue-600"
                                            }`}
                                        >
                                            <span className="text-[9px] font-mono opacity-60">#{idx + 1}</span>
                                            <span>{t.tag}</span>
                                            <span className="text-[9px] font-mono opacity-70">({t.count})</span>
                                        </button>
                                    ))
                                ) : (
                                    <span className="text-[10px] text-slate-400">#해시태그로 글을 작성해보세요</span>
                                )}
                            </div>
                        </div>

                        {/* Active Hashtag Filter Banner */}
                        {selectedHashtag && (
                            <div
                                className="flex items-center justify-between p-2 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 animate-slideDown"
                            >
                                <div className="flex items-center gap-1.5 text-xs font-bold">
                                    <Hash className="w-3.5 h-3.5"/>
                                    <span><strong>{selectedHashtag}</strong> 태그가 포함된 스레드 모아보기</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedHashtag(null)}
                                    className="p-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer"
                                    title="필터 해제"
                                >
                                    <X className="w-3.5 h-3.5"/>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Timeline Stream Box (Scrollable) */}
                    <div
                        className="flex-1 min-h-0 backdrop-blur-2xl bg-white/80 dark:bg-[#111622]/85 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs overflow-y-auto custom-scrollbar p-3.5 sm:p-5 space-y-4"
                    >
                        {/* Inline Seamless Composer Card */}
                        <div
                            className="p-3.5 sm:p-4 rounded-3xl bg-slate-50/90 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5 shadow-xs transition-all space-y-3"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div
                                    onClick={() => setIsProfileModalOpen(true)}
                                    className="flex items-center gap-2 cursor-pointer group"
                                    title="내 스퀘어 프로필 열기"
                                >
                                    <div
                                        className={`w-7 h-7 rounded-xl bg-gradient-to-tr ${getAvatarGradient(
                                            authorName,
                                            userTag
                                        )} text-white flex items-center justify-center font-black text-xs shadow-xs group-hover:scale-105 transition-transform`}
                                    >
                                        {authorName.charAt(0)}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className="text-xs font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {authorName}
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                                            {userTag}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleRerollNickname}
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
                                onChange={handleTextareaChange}
                                onFocus={() => setIsComposerExpanded(true)}
                                placeholder="무슨 일이 일어나고 있나요?"
                                rows={isComposerExpanded ? 3 : 2}
                                maxLength={1000}
                                className="w-full bg-white dark:bg-black/20 rounded-2xl p-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none resize-none font-medium leading-relaxed border border-slate-200/60 dark:border-white/5 focus:border-blue-500 transition-colors"
                            />

                            {/* Quick Hashtag Insertion Chips */}
                            {isComposerExpanded && (
                                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
                                    <span
                                        className="text-[10px] font-bold text-slate-400 shrink-0 flex items-center gap-0.5"
                                    >
                                        <Hash className="w-3 h-3"/> 추천 태그:
                                    </span>
                                    {QUICK_HASHTAGS.map((tag) => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => handleInsertHashtag(tag)}
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
                                        {composerContent.length}/500
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handlePostThread()}
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

                        {/* Thread Cards Feed */}
                        {filteredThreads.length === 0 ? (
                            <div className="py-20 text-center space-y-3">
                                <div
                                    className="w-12 h-12 rounded-3xl bg-slate-100 dark:bg-white/5 text-slate-400 mx-auto flex items-center justify-center"
                                >
                                    <MessageCircle className="w-6 h-6"/>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-black text-slate-700 dark:text-slate-300">
                                        {selectedHashtag
                                            ? `${selectedHashtag} 관련 이야기가 없습니다.`
                                            : activeTab === "MINE"
                                                ? "내가 작성한 글이 아직 없습니다."
                                                : "등록된 이야기가 없습니다."}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {selectedHashtag ? (
                                            <button
                                                onClick={() => setSelectedHashtag(null)}
                                                className="text-blue-500 font-bold underline cursor-pointer"
                                            >
                                                모든 스레드 보기
                                            </button>
                                        ) : (
                                            "상단 입력창에서 첫 번째 스퀘어 이야기를 남겨보세요!"
                                        )}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            filteredThreads.map((thread) => {
                                const threadReplies = repliesByThreadId[thread.id] || [];
                                const isLiked = likedCommentIds.has(thread.id);
                                const isReplyOpen = activeReplyParentId === thread.id;
                                const isMine = isMyComment(thread);

                                return (
                                    <div
                                        id={`thread-${thread.id}`}
                                        key={thread.id}
                                        className="p-3.5 sm:p-4 rounded-3xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-all space-y-3 scroll-mt-20 shadow-xs"
                                    >
                                        {/* Root Thread Header & Body with Thread Rail */}
                                        <div className="flex items-start gap-3">
                                            {/* Avatar & Continuous Thread Connector Rail */}
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
                                                {(threadReplies.length > 0 || isReplyOpen) && (
                                                    <div
                                                        className="w-0.5 flex-1 bg-slate-200 dark:bg-white/10 my-1 rounded-full"
                                                    />
                                                )}
                                            </div>

                                            {/* Thread Main Content */}
                                            <div className="flex-1 min-w-0 space-y-1.5">
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
                                                                className="text-[10px] font-mono text-slate-400 dark:text-slate-500"
                                                            >
                                                                {thread.authorTag}
                                                            </span>
                                                        )}
                                                        {isMine && (
                                                            <span
                                                                className="px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-extrabold border border-blue-500/20"
                                                            >
                                                                내 글
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div
                                                        className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0"
                                                    >
                                                        <Clock className="w-3 h-3"/>
                                                        <span>{formatRelativeTime(thread.createdAt)}</span>
                                                    </div>
                                                </div>

                                                {/* Thread Body with Rich Hashtags */}
                                                {thread.isDeleted ? (
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 italic flex items-center gap-1 select-none">
                                                        <Ban className="w-3 h-3 opacity-60"/>
                                                        <span>삭제된 글입니다.</span>
                                                    </p>
                                                ) : (
                                                    <div
                                                        className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap break-words leading-relaxed"
                                                    >
                                                        {renderRichContent(thread.content, handleHashtagClick)}
                                                    </div>
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
                                                        {isMine && (
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
                                                className="ml-5 sm:ml-6 pl-3 sm:pl-4 border-l-2 border-slate-200 dark:border-white/10 space-y-2.5 pt-1"
                                            >
                                                {threadReplies.map((reply) => {
                                                    const isReplyLiked = likedCommentIds.has(reply.id);
                                                    const isReplyMine = isMyComment(reply);

                                                    return (
                                                        <div
                                                            key={reply.id}
                                                            className="p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 space-y-1.5 transition-all shadow-2xs"
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
                                                                        className="text-xs font-extrabold text-slate-900 dark:text-white"
                                                                    >
                                                                        {reply.author}
                                                                    </span>
                                                                    {reply.authorTag && (
                                                                        <span
                                                                            className="text-[9px] font-mono text-slate-400 dark:text-slate-500"
                                                                        >
                                                                            {reply.authorTag}
                                                                        </span>
                                                                    )}
                                                                    {isReplyMine && (
                                                                        <span
                                                                            className="px-1 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[8px] font-extrabold"
                                                                        >
                                                                            내 글
                                                                        </span>
                                                                    )}
                                                                    {reply.replyToAuthor && (
                                                                        <span
                                                                            className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded"
                                                                        >
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
                                                                <div
                                                                    className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap break-words leading-relaxed pl-6"
                                                                >
                                                                    {renderRichContent(reply.content, handleHashtagClick)}
                                                                </div>
                                                            )}

                                                            {/* Reply Actions */}
                                                            {!reply.isDeleted && (
                                                                <div
                                                                    className="flex items-center justify-between gap-2 pt-1 pl-6"
                                                                >
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

                                                                    {isReplyMine && (
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
                                                className="ml-5 sm:ml-6 pl-3 sm:pl-4 border-l-2 border-blue-500 dark:border-blue-400 pt-2 animate-slideDown"
                                            >
                                                <div
                                                    className="p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 space-y-2"
                                                >
                                                    <div
                                                        className="flex items-center justify-between text-[11px] font-bold text-blue-600 dark:text-blue-400"
                                                    >
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

                {/* ========================================================================= */}
                {/* 2. DESKTOP RADAR & IDENTITY SIDEBAR (Right Column, lg:block)             */}
                {/* ========================================================================= */}
                <aside className="hidden lg:flex lg:col-span-4 flex-col gap-4 sticky top-4">

                    {/* User Profile Card */}
                    <div
                        className="backdrop-blur-2xl bg-white/85 dark:bg-[#111622]/90 rounded-3xl p-4 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3"
                    >
                        <div className="flex items-center justify-between">
                            <span
                                className="text-[11px] font-black text-slate-400 tracking-wider uppercase flex items-center gap-1"
                            >
                                <User className="w-3.5 h-3.5 text-blue-500"/> 내 스퀘어 프로필
                            </span>
                            <span
                                className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20"
                            >
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
                                {authorName.charAt(0)}
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

                        <div
                            className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-white/5 text-center"
                        >
                            <div
                                className="p-2 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/5"
                            >
                                <p className="text-[10px] font-bold text-slate-400">내 작성 글</p>
                                <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{myTotalPostsCount}</p>
                            </div>
                            <div
                                className="p-2 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/5"
                            >
                                <p className="text-[10px] font-bold text-slate-400">공감한 글</p>
                                <p className="text-sm font-black text-rose-500 mt-0.5">{likedCommentIds.size}</p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleRerollNickname}
                            className="w-full py-2 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                        >
                            <Dices className="w-3.5 h-3.5 text-blue-500"/>
                            <span>랜덤 닉네임 새로고침</span>
                        </button>
                    </div>

                    {/* Real-time Trending Hashtags Card */}
                    <div
                        className="backdrop-blur-2xl bg-white/85 dark:bg-[#111622]/90 rounded-3xl p-4 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3"
                    >
                        <div className="flex items-center justify-between">
                            <div
                                className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white"
                            >
                                <TrendingUp className="w-4 h-4 text-blue-500"/>
                                <span>실시간 트렌드 해시태그</span>
                            </div>
                            {selectedHashtag && (
                                <button
                                    onClick={() => setSelectedHashtag(null)}
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
                                            onClick={() => handleHashtagClick(t.tag)}
                                            className={`flex items-center justify-between p-2 rounded-2xl transition-all cursor-pointer ${
                                                isSelected
                                                    ? "bg-blue-600 text-white shadow-xs"
                                                    : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={`text-xs font-mono font-black ${
                                                    isSelected
                                                        ? "text-white"
                                                        : idx === 0
                                                            ? "text-rose-500"
                                                            : idx === 1
                                                                ? "text-amber-500"
                                                                : "text-blue-500"
                                                }`}>
                                                    #{idx + 1}
                                                </span>
                                                <span className="text-xs font-bold truncate">{t.tag}</span>
                                            </div>
                                            <span
                                                className={`text-[10px] font-mono ${isSelected ? "text-white/80" : "text-slate-400"}`}
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
                            className="backdrop-blur-2xl bg-white/85 dark:bg-[#111622]/90 rounded-3xl p-4 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3"
                        >
                            <div
                                className="flex items-center gap-1.5 text-xs font-black text-rose-600 dark:text-rose-400"
                            >
                                <Flame className="w-4 h-4 fill-rose-500"/>
                                <span>지금 뜨거운 HOT 토론</span>
                            </div>

                            <div className="space-y-2 pt-1">
                                {topRankedThreads.map(({thread, replyCount}, idx) => (
                                    <div
                                        key={thread.id}
                                        onClick={() => handleScrollToThread(thread.id)}
                                        className="p-2.5 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 hover:bg-white dark:hover:bg-white/5 cursor-pointer transition-all space-y-1.5"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-black ${
                                                idx === 0
                                                    ? "bg-amber-400 text-slate-900"
                                                    : idx === 1
                                                        ? "bg-slate-300 text-slate-900 dark:bg-slate-600 dark:text-white"
                                                        : "bg-amber-700/60 text-white"
                                            }`}>
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
                        className="backdrop-blur-2xl bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 rounded-3xl p-4 border border-blue-500/20 shadow-xs space-y-2"
                    >
                        <div className="flex items-center gap-1.5 text-xs font-black text-blue-700 dark:text-blue-300">
                            <Sparkles className="w-3.5 h-3.5"/>
                            <span>스퀘어 클린 가이드</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                            스퀘어는 모두가 함께 만들어가는 실시간 광장입니다. 따뜻한 매너와 배려로 서로를 존중하며, 건전하고 즐거운 토론 문화를 만들어주세요. 부적절한 언어, 혐오 표현,
                            악성 댓글은 자제해주시고, 서로의 의견을 존중하는 열린 마음으로 소통해주시길 부탁드립니다.
                        </p>
                    </div>

                </aside>

            </div>
        </div>
    );
};
