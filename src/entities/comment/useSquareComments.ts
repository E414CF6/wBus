"use client";

import {useCallback, useEffect, useState} from "react";
import {createClient} from "@shared/supabase/client";
import {type CommentItem, type CommentRow, rowToComment} from "./types";

export interface AddCommentInput {
    author?: string;
    content: string;
    parentId?: string;
    replyToAuthor?: string;
    authorTag?: string;
    replyToAuthorTag?: string;
}

export interface UseSquareCommentsReturn {
    comments: CommentItem[];
    isRefreshing: boolean;
    refreshComments: () => Promise<void>;
    addComment: (data: AddCommentInput) => Promise<void>;
    likeComment: (id: string) => Promise<void>;
    deleteComment: (id: string, authorTag?: string) => Promise<void>;
}

export function useSquareComments(): UseSquareCommentsReturn {
    const [comments, setComments] = useState<CommentItem[]>([]);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

    const fetchComments = useCallback(async (force = false) => {
        setIsRefreshing(true);
        try {
            const res = await fetch(
                `/api/comments?force=${force ? "true" : "false"}&t=${Date.now()}`,
                {
                    cache: "no-store",
                    headers: {"Cache-Control": "no-cache"},
                }
            );
            const json = await res.json();
            if (json.success && Array.isArray(json.comments)) {
                setComments(json.comments);
            }
        } catch (err) {
            console.warn("[useSquareComments] Failed to fetch comments:", err);
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    // Initial fetch and Realtime subscription
    useEffect(() => {
        let isCancelled = false;

        const loadInitial = async () => {
            setIsRefreshing(true);
            try {
                const res = await fetch(`/api/comments?force=false&t=${Date.now()}`, {
                    cache: "no-store",
                    headers: {"Cache-Control": "no-cache"},
                });
                const json = await res.json();
                if (!isCancelled && json.success && Array.isArray(json.comments)) {
                    setComments(json.comments);
                }
            } catch (err) {
                if (!isCancelled) {
                    console.warn("[useSquareComments] Initial fetch error:", err);
                }
            } finally {
                if (!isCancelled) {
                    setIsRefreshing(false);
                }
            }
        };

        void loadInitial();

        let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
        try {
            const supabase = createClient();
            channel = supabase
                .channel("comments_live_channel")
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "comments",
                    },
                    (payload) => {
                        if (payload.eventType === "INSERT") {
                            const newComment = rowToComment(payload.new as CommentRow);
                            setComments((prev) => {
                                if (prev.some((c) => c.id === newComment.id)) return prev;
                                return [newComment, ...prev];
                            });
                        } else if (payload.eventType === "UPDATE") {
                            const updated = rowToComment(payload.new as CommentRow);
                            setComments((prev) =>
                                prev.map((c) => (c.id === updated.id ? updated : c))
                            );
                        } else if (payload.eventType === "DELETE") {
                            const deletedId = (payload.old as { id: string })?.id;
                            if (deletedId) {
                                setComments((prev) =>
                                    prev.filter((c) => c.id !== deletedId)
                                );
                            }
                        }
                    }
                )
                .subscribe();
        } catch (err) {
            console.warn("[useSquareComments] Supabase Realtime subscription error:", err);
        }

        return () => {
            isCancelled = true;
            if (channel) {
                try {
                    const supabase = createClient();
                    supabase.removeChannel(channel);
                } catch {
                    // Ignore cleanup error
                }
            }
        };
    }, []);

    const addComment = useCallback(async (data: AddCommentInput) => {
        const res = await fetch("/api/comments", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!json.success) {
            throw new Error(json.error || "스퀘어 글 등록에 실패했습니다.");
        }
        if (json.comment) {
            setComments((prev) => {
                if (prev.some((c) => c.id === json.comment.id)) return prev;
                return [json.comment, ...prev];
            });
            try {
                const saved = localStorage.getItem("wbus_my_comments");
                const list: string[] = saved ? JSON.parse(saved) : [];
                if (!list.includes(json.comment.id)) {
                    list.push(json.comment.id);
                    localStorage.setItem("wbus_my_comments", JSON.stringify(list));
                }
            } catch {
                // Ignore
            }
        }
    }, []);

    const likeComment = useCallback(async (id: string) => {
        try {
            const res = await fetch("/api/comments", {
                method: "PATCH",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({id, action: "like"}),
            });
            const json = await res.json();
            if (json.success && json.comment) {
                setComments((prev) =>
                    prev.map((c) => (c.id === id ? json.comment : c))
                );
            }
        } catch (err) {
            console.warn("[useSquareComments] Failed to like comment:", err);
        }
    }, []);

    const deleteComment = useCallback(async (id: string, authorTag?: string) => {
        try {
            const params = new URLSearchParams({id});
            if (authorTag) params.set("authorTag", authorTag);
            const res = await fetch(`/api/comments?${params.toString()}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (json.success) {
                setComments((prev) =>
                    prev.map((c) =>
                        c.id === id ? json.comment || {...c, isDeleted: true} : c
                    )
                );
            } else {
                throw new Error(json.error || "스퀘어 글 삭제에 실패했습니다.");
            }
        } catch (err) {
            console.warn("[useSquareComments] Failed to delete comment:", err);
            throw err;
        }
    }, []);

    const refreshComments = useCallback(() => fetchComments(true), [fetchComments]);

    return {
        comments,
        isRefreshing,
        refreshComments,
        addComment,
        likeComment,
        deleteComment,
    };
}
