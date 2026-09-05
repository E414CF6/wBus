import React, {useCallback, useEffect, useRef, useState} from "react";

import {generateUserTag, getRandomNickname} from "@data/nicknames";

import type {CommentItem} from "@entities/comment";

import type {ReplyTarget} from "../types";

interface UseChatActionsProps {
    authorName: string;
    userTag: string;
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
}

export function useChatActions({
                                   authorName, userTag, onAddComment, onLikeComment, onDeleteComment,
                               }: UseChatActionsProps) {
    const [composerContent, setComposerContent] = useState("");
    const [isComposerExpanded, setIsComposerExpanded] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    // Toast Notification
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

    const showToast = useCallback((msg: string) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToastMessage(msg);
        toastTimerRef.current = setTimeout(() => {
            setToastMessage(null);
        }, 3200);
    }, []);

    // Cooldown countdown timer
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => {
            setCooldown((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    // Track liked comment IDs in localStorage
    const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(() => {
        if (typeof window !== "undefined") {
            try {
                const stored = localStorage.getItem("wbus_liked_comments");
                if (stored) return new Set(JSON.parse(stored));
            } catch {
                // Storage error
            }
        }
        return new Set();
    });

    // Track my created comment IDs in localStorage
    const [myCommentIds, setMyCommentIds] = useState<Set<string>>(() => {
        if (typeof window !== "undefined") {
            try {
                const stored = localStorage.getItem("wbus_my_comments");
                if (stored) return new Set(JSON.parse(stored));
            } catch {
                // Storage error
            }
        }
        return new Set();
    });

    const addMyCommentId = useCallback((id: string) => {
        setMyCommentIds((prev) => {
            const next = new Set(prev).add(id);
            try {
                localStorage.setItem("wbus_my_comments", JSON.stringify(Array.from(next)));
            } catch {
                // Storage error
            }
            return next;
        });
    }, []);

    // Inline Nested Reply State
    const [activeReplyParentId, setActiveReplyParentId] = useState<string | null>(null);
    const [inlineReplyTarget, setInlineReplyTarget] = useState<ReplyTarget | null>(null);
    const [inlineReplyContent, setInlineReplyContent] = useState("");
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const inlineReplyTextareaRef = useRef<HTMLTextAreaElement>(null);

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setComposerContent(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
        }
    };

    const handleInlineReplyTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInlineReplyContent(e.target.value);
        if (inlineReplyTextareaRef.current) {
            inlineReplyTextareaRef.current.style.height = "auto";
            inlineReplyTextareaRef.current.style.height = `${Math.min(inlineReplyTextareaRef.current.scrollHeight, 120)}px`;
        }
    };

    const handleInsertHashtag = (tag: string) => {
        setComposerContent((prev) => {
            const space = prev.length > 0 && !prev.endsWith(" ") ? " " : "";
            return `${prev}${space}${tag} `;
        });
        setIsComposerExpanded(true);
        setTimeout(() => textareaRef.current?.focus(), 50);
    };

    // Post Root Thread
    const handlePostThread = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = composerContent.trim();
        if (!trimmed || isSubmitting || cooldown > 0) return;

        setIsSubmitting(true);
        try {
            await onAddComment({
                author: authorName.trim() || getRandomNickname(),
                authorTag: userTag || generateUserTag(),
                content: trimmed,
            });

            setComposerContent("");
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }
            setIsComposerExpanded(false);
            setCooldown(3);
            showToast("스퀘어 광장에 글이 등록되었습니다.");
        } catch (err) {
            console.error("Failed to post thread:", err);
            showToast(err instanceof Error ? err.message : "글 등록 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Start inline reply
    const handleStartReply = (targetComment: CommentItem, rootThreadId: string) => {
        setActiveReplyParentId(rootThreadId);
        setInlineReplyTarget({
            id: targetComment.id,
            author: targetComment.author,
            authorTag: targetComment.authorTag,
            content: targetComment.content,
        });
        setInlineReplyContent("");
        setTimeout(() => {
            inlineReplyTextareaRef.current?.focus();
        }, 80);
    };

    // Cancel inline reply
    const handleCancelReply = () => {
        setActiveReplyParentId(null);
        setInlineReplyTarget(null);
        setInlineReplyContent("");
    };

    // Submit inline reply
    const handlePostReply = async () => {
        if (!activeReplyParentId || !inlineReplyTarget) return;
        const trimmed = inlineReplyContent.trim();
        if (!trimmed || isSubmittingReply || cooldown > 0) return;

        setIsSubmittingReply(true);
        try {
            await onAddComment({
                author: authorName.trim() || getRandomNickname(),
                authorTag: userTag || generateUserTag(),
                content: trimmed,
                parentId: activeReplyParentId,
                replyToAuthor: inlineReplyTarget.author,
                replyToAuthorTag: inlineReplyTarget.authorTag,
            });

            setInlineReplyContent("");
            setActiveReplyParentId(null);
            setInlineReplyTarget(null);
            setCooldown(3);
            showToast("답글이 등록되었습니다.");
        } catch (err) {
            console.error("Failed to post reply:", err);
            showToast(err instanceof Error ? err.message : "답글 등록 중 오류가 발생했습니다.");
        } finally {
            setIsSubmittingReply(false);
        }
    };

    // Like Action
    const handleLike = useCallback(async (id: string) => {
        if (!onLikeComment || likedCommentIds.has(id)) return;

        setLikedCommentIds((prev) => {
            const next = new Set(prev).add(id);
            try {
                localStorage.setItem("wbus_liked_comments", JSON.stringify(Array.from(next)));
            } catch {
                // Storage error
            }
            return next;
        });

        try {
            await onLikeComment(id);
        } catch (err) {
            console.error("Failed to like:", err);
        }
    }, [likedCommentIds, onLikeComment]);

    // Delete Action
    const handleDelete = useCallback(async (id: string) => {
        if (!onDeleteComment) return;
        if (!window.confirm("정말 이 글을 삭제하시겠습니까?")) return;

        setDeletingId(id);
        try {
            await onDeleteComment(id, userTag);
            showToast("글이 삭제되었습니다.");
        } catch (err) {
            console.error("Failed to delete:", err);
            showToast("삭제할 수 없습니다.");
        } finally {
            setDeletingId(null);
        }
    }, [onDeleteComment, userTag, showToast]);

    // Share Action
    const handleShare = (thread: CommentItem) => {
        const shareUrl = `${window.location.origin}/square#thread-${thread.id}`;
        if (navigator.share) {
            navigator
                .share({
                    title: `wBus 스퀘어 - ${thread.author}`, text: thread.content, url: shareUrl,
                })
                .catch(() => {
                });
        } else {
            navigator.clipboard.writeText(shareUrl).then(() => {
                showToast("글 링크가 클립보드에 복사되었습니다.");
            });
        }
    };

    // Scroll to Thread
    const handleScrollToThread = (threadId: string) => {
        const el = document.getElementById(`thread-${threadId}`);
        if (el) {
            el.scrollIntoView({behavior: "smooth", block: "center"});
            el.classList.add("ring-2", "ring-indigo-500", "ring-offset-2");
            setTimeout(() => {
                el.classList.remove("ring-2", "ring-indigo-500", "ring-offset-2");
            }, 2000);
        }
    };

    return {
        composerContent,
        isComposerExpanded,
        setIsComposerExpanded,
        isSubmitting,
        cooldown,
        textareaRef,
        handleTextareaChange,
        handleInsertHashtag,
        handlePostThread,
        showToast,
        toastMessage,
        likedCommentIds,
        myCommentIds,
        addMyCommentId,
        activeReplyParentId,
        deletingId,
        inlineReplyTarget,
        inlineReplyContent,
        isSubmittingReply,
        inlineReplyTextareaRef,
        handleLike,
        handleStartReply,
        handleCancelReply,
        handlePostReply,
        handleInlineReplyTextareaChange,
        handleDelete,
        handleShare,
        handleScrollToThread,
    };
}
