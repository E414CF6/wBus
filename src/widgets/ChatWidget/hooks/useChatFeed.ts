import type {CommentItem} from "@entities/comment";
import {useCallback, useMemo, useRef, useState} from "react";
import type {ChatFeedTab, RankedThread, TrendingTag} from "../types";

interface UseChatFeedProps {
    comments: CommentItem[];
    userTag: string;
    myCommentIds: Set<string>;
}

export function useChatFeed({comments, userTag, myCommentIds}: UseChatFeedProps) {
    const [activeTab, setActiveTab] = useState<ChatFeedTab>("LATEST");
    const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Hashtag selection toggle
    const handleHashtagClick = useCallback((tag: string) => {
        if (!tag) {
            setSelectedHashtag(null);
            return;
        }
        setSelectedHashtag((prev) => (prev === tag ? null : tag));
    }, []);

    // Check if a comment belongs to current user
    const isMyComment = useCallback(
        (comment: CommentItem) => {
            if (myCommentIds.has(comment.id)) return true;
            if (userTag && comment.authorTag && userTag === comment.authorTag) return true;
            return false;
        },
        [myCommentIds, userTag]
    );

    // Count my total posts (threads + replies)
    const myTotalPostsCount = useMemo(() => {
        return comments.filter((c) => isMyComment(c)).length;
    }, [comments, isMyComment]);

    // Parent threads & reply map grouping
    const {parentThreads, repliesByThreadId} = useMemo(() => {
        const parents: CommentItem[] = [];
        const replies: Record<string, CommentItem[]> = {};

        for (const c of comments) {
            if (!c.parentId) {
                parents.push(c);
            } else {
                if (!replies[c.parentId]) {
                    replies[c.parentId] = [];
                }
                replies[c.parentId].push(c);
            }
        }

        for (const parentId in replies) {
            replies[parentId].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
        }

        return {parentThreads: parents, repliesByThreadId: replies};
    }, [comments]);

    // Extract dynamic trending hashtags from recent 50 comments
    const trendingTags = useMemo<TrendingTag[]>(() => {
        const counts = new Map<string, { count: number; recentTime: number }>();
        const recentSubset = comments.slice(0, 50);

        for (const c of recentSubset) {
            if (c.isDeleted) continue;
            const matches = c.content.match(/#[^\s#]+/g);
            if (matches) {
                const time = new Date(c.createdAt).getTime();
                for (const rawTag of matches) {
                    const tag = rawTag.trim();
                    const existing = counts.get(tag) || {count: 0, recentTime: 0};
                    counts.set(tag, {
                        count: existing.count + 1,
                        recentTime: Math.max(existing.recentTime, time),
                    });
                }
            }
        }

        const now = Date.now();
        const ranked: TrendingTag[] = [];
        for (const [tag, data] of counts.entries()) {
            const hoursAgo = Math.max(0.1, (now - data.recentTime) / (1000 * 60 * 60));
            const score = data.count / Math.pow(hoursAgo + 2, 1.2);
            ranked.push({tag, count: data.count, score});
        }

        return ranked.sort((a, b) => b.score - a.score).slice(0, 8);
    }, [comments]);

    // Compute top ranked threads
    const topRankedThreads = useMemo<RankedThread[]>(() => {
        const now = Date.now();
        const ranked: RankedThread[] = parentThreads.map((t) => {
            const rCount = repliesByThreadId[t.id]?.length || 0;
            const likes = t.likes || 0;
            const hoursAgo = Math.max(
                0.2,
                (now - new Date(t.createdAt).getTime()) / (1000 * 60 * 60)
            );
            const score = (likes * 2 + rCount * 3 + 1) / Math.pow(hoursAgo + 2, 1.5);
            return {thread: t, replyCount: rCount, score};
        });

        return ranked.sort((a, b) => b.score - a.score).slice(0, 5);
    }, [parentThreads, repliesByThreadId]);

    // Tab-filtered threads
    const filteredThreads = useMemo(() => {
        let threads = parentThreads;

        if (activeTab === "MINE") {
            threads = threads.filter((t) => {
                const isMyAuthor = isMyComment(t);
                const hasMyReply = (repliesByThreadId[t.id] || []).some((r) => isMyComment(r));
                return isMyAuthor || hasMyReply;
            });
        } else if (activeTab === "HOT") {
            threads = topRankedThreads.map((r) => r.thread);
        }

        if (selectedHashtag) {
            threads = threads.filter((t) => {
                const threadHasTag = t.content.includes(selectedHashtag);
                const repliesHasTag = (repliesByThreadId[t.id] || []).some((r) =>
                    r.content.includes(selectedHashtag)
                );
                return threadHasTag || repliesHasTag;
            });
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            threads = threads.filter((t) => {
                const inThread =
                    t.content.toLowerCase().includes(q) || t.author.toLowerCase().includes(q);
                const inReplies = (repliesByThreadId[t.id] || []).some(
                    (r) =>
                        r.content.toLowerCase().includes(q) ||
                        r.author.toLowerCase().includes(q)
                );
                return inThread || inReplies;
            });
        }

        return threads;
    }, [
        parentThreads,
        activeTab,
        selectedHashtag,
        searchQuery,
        topRankedThreads,
        isMyComment,
        repliesByThreadId,
    ]);

    return {
        activeTab,
        setActiveTab,
        selectedHashtag,
        setSelectedHashtag,
        searchQuery,
        setSearchQuery,
        isSearchOpen,
        setIsSearchOpen,
        searchInputRef,
        handleHashtagClick,
        trendingTags,
        topRankedThreads,
        parentThreads,
        repliesByThreadId,
        filteredThreads,
        isMyComment,
        myTotalPostsCount,
    };
}
