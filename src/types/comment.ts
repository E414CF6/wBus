export type CommentCategory = "ALL" | "INFO" | "TIP" | "QUESTION" | "LOST" | "CHAT";

export interface CommentItem {
    id: string;
    author: string;
    content: string;
    createdAt: string;
    routeNo?: string;
    category?: "제보" | "꿀팁" | "질문" | "분실물" | "잡담" | string;
    likes?: number;
    ipHash?: string;
    parentId?: string;
    replyToAuthor?: string;
    authorTag?: string;
    replyToAuthorTag?: string;
    isDeleted?: boolean;
}

export interface CommentRow {
    id: string;
    author: string;
    author_tag: string | null;
    content: string;
    category: string | null;
    created_at: string;
    route_no: string | null;
    likes: number | null;
    parent_id: string | null;
    reply_to_author: string | null;
    reply_to_author_tag: string | null;
    is_deleted: boolean | null;
    ip_hash: string | null;
}

export function rowToComment(row: CommentRow): CommentItem {
    return {
        id: row.id,
        author: row.author,
        authorTag: row.author_tag ?? undefined,
        content: row.content,
        category: (row.category as CommentItem["category"]) ?? undefined,
        createdAt: row.created_at,
        routeNo: row.route_no ?? undefined,
        likes: row.likes ?? 0,
        parentId: row.parent_id ?? undefined,
        replyToAuthor: row.reply_to_author ?? undefined,
        replyToAuthorTag: row.reply_to_author_tag ?? undefined,
        isDeleted: row.is_deleted ?? false,
        ipHash: row.ip_hash ?? undefined,
    };
}

export function commentToRow(c: CommentItem): CommentRow {
    return {
        id: c.id,
        author: c.author,
        author_tag: c.authorTag || null,
        content: c.content,
        category: c.category || "잡담",
        created_at: c.createdAt,
        route_no: c.routeNo && c.routeNo !== "ALL" ? c.routeNo : null,
        likes: c.likes ?? 0,
        parent_id: c.parentId || null,
        reply_to_author: c.replyToAuthor || null,
        reply_to_author_tag: c.replyToAuthorTag || null,
        is_deleted: c.isDeleted ?? false,
        ip_hash: c.ipHash || null,
    };
}

export interface CommentsDataset {
    updatedAt: string;
    comments: CommentItem[];
}
