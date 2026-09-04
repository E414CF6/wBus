import {generateUserTag, getRandomNickname} from "@/data/nicknames";
import {validateAndSanitizeContent} from "@shared/lib/security";
import {createClient} from "@shared/supabase/server";
import {type CommentItem, type CommentRow, commentToRow, rowToComment} from "./types";

/**
 * Fetch comments directly from Supabase Postgres
 */
export async function getComments(_forceFresh = false, limit = 50): Promise<CommentItem[]> {
    try {
        const supabase = await createClient();
        let query = supabase
            .from("comments")
            .select("*")
            .order("created_at", {ascending: false});

        if (limit > 0) {
            query = query.limit(limit);
        }

        const {data, error} = await query;

        if (error) {
            console.error("[Comments] Supabase select error:", error.message);
            return [];
        }

        if (data && Array.isArray(data)) {
            return data.map((r) => rowToComment(r as CommentRow));
        }
    } catch (err) {
        console.error("[Comments] Failed to load comments from Supabase:", err);
    }
    return [];
}

/**
 * Add a new comment / thread / reply to Supabase Postgres with security checks and IP hashing
 */
export async function addComment(params: {
    author?: string;
    content: string;
    parentId?: string;
    replyToAuthor?: string;
    authorTag?: string;
    replyToAuthorTag?: string;
    ipHash?: string;
}): Promise<CommentItem> {
    // 1. Content validation & Profanity / Spam filter
    const validation = validateAndSanitizeContent(params.content, params.author);
    if (!validation.isValid) {
        throw new Error(validation.error || "부적절한 내용이 감지되어 등록할 수 없습니다.");
    }

    const rawTag = params.authorTag ? params.authorTag.replace(/^#+/, "").trim() : generateUserTag();
    const generatedTag = rawTag || generateUserTag();
    const cleanReplyToAuthorTag = params.replyToAuthorTag ? params.replyToAuthorTag.replace(/^#+/, "").trim() : undefined;
    const finalAuthor = validation.sanitizedAuthor || getRandomNickname();

    const newComment: CommentItem = {
        id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        author: finalAuthor,
        authorTag: generatedTag,
        content: validation.sanitizedContent,
        createdAt: new Date().toISOString(),
        likes: 0,
        parentId: params.parentId,
        replyToAuthor: params.replyToAuthor,
        replyToAuthorTag: cleanReplyToAuthorTag,
        ipHash: params.ipHash,
    };

    try {
        const supabase = await createClient();
        const row = commentToRow(newComment);
        const {error} = await supabase.from("comments").insert(row);
        if (error) {
            console.error("[Comments] Supabase insert error:", error.message);
            throw new Error(`스퀘어 글 저장 실패: ${error.message}`);
        }
    } catch (err) {
        console.error("[Comments] Failed to save comment:", err);
        throw err;
    }

    return newComment;
}

/**
 * Increment likes on a comment in Supabase Postgres
 * Tries atomic RPC first; gracefully falls back to read-modify-write if RPC is not yet created.
 */
export async function likeComment(id: string): Promise<CommentItem | null> {
    try {
        const supabase = await createClient();

        // 1. Try atomic Supabase RPC increment first to prevent race condition lost updates
        try {
            const {data: rpcData, error: rpcErr} = await supabase.rpc("increment_comment_likes", {
                comment_id: id,
            });
            if (!rpcErr && rpcData) {
                const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
                if (row && typeof row === "object" && "id" in row) {
                    return rowToComment(row as CommentRow);
                }
            }
        } catch {
            // RPC not deployed in Supabase yet, proceed to graceful fallback
        }

        // 2. Graceful fallback: Read-Modify-Write
        const {data: current, error: getErr} = await supabase
            .from("comments")
            .select("*")
            .eq("id", id)
            .single();

        if (getErr || !current) {
            console.warn("[Comments] Comment not found for like:", id);
            return null;
        }

        const nextLikes = ((current as CommentRow).likes || 0) + 1;
        const {data, error} = await supabase
            .from("comments")
            .update({likes: nextLikes})
            .eq("id", id)
            .select()
            .single();

        if (error || !data) {
            console.error("[Comments] Supabase like update error:", error?.message);
            return null;
        }

        return rowToComment(data as CommentRow);
    } catch (err) {
        console.error("[Comments] Failed to like comment in Supabase:", err);
        return null;
    }
}

/**
 * Soft-delete a comment in Supabase Postgres
 */
export async function deleteComment(id: string, userTag?: string, ipHash?: string): Promise<CommentItem | null> {
    try {
        const supabase = await createClient();
        let query = supabase
            .from("comments")
            .update({
                is_deleted: true, content: "삭제된 메시지입니다.",
            })
            .eq("id", id);

        if (userTag) {
            const cleanTag = userTag.replace(/^#+/, "").trim();
            query = query.in("author_tag", [cleanTag, `#${cleanTag}`]);
        } else if (ipHash) {
            query = query.eq("ip_hash", ipHash);
        }

        const {data, error} = await query.select().single();
        if (error || !data) {
            console.warn("[Comments] Comment not found or unauthorized for delete:", id, userTag);
            return null;
        }

        return rowToComment(data as CommentRow);
    } catch (err) {
        console.error("[Comments] Failed to delete comment in Supabase:", err);
        return null;
    }
}
