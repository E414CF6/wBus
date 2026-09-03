export interface CommentItem {
    id: string;
    author: string;
    content: string;
    createdAt: string;
    authorTag?: string;
    likes?: number;
    parentId?: string;
    replyToAuthor?: string;
    replyToAuthorTag?: string;
    isDeleted?: boolean;
    ipHash?: string;
}

export interface CommentRow {
    id: string;
    author: string;
    author_tag: string | null;
    content: string;
    created_at: string;
    likes: number | null;
    parent_id: string | null;
    reply_to_author: string | null;
    reply_to_author_tag: string | null;
    is_deleted: boolean | null;
    ip_hash: string | null;
}

export function rowToComment(row: CommentRow): CommentItem {
    const cleanAuthorTag = row.author_tag ? row.author_tag.replace(/^#+/, "").trim() : undefined;
    const cleanReplyToAuthorTag = row.reply_to_author_tag ? row.reply_to_author_tag.replace(/^#+/, "").trim() : undefined;

    return {
        id: row.id,
        author: row.author,
        authorTag: cleanAuthorTag || undefined,
        content: row.content,
        createdAt: row.created_at,
        likes: row.likes ?? 0,
        parentId: row.parent_id ?? undefined,
        replyToAuthor: row.reply_to_author ?? undefined,
        replyToAuthorTag: cleanReplyToAuthorTag || undefined,
        isDeleted: row.is_deleted ?? false,
        ipHash: row.ip_hash ?? undefined,
    };
}

export function commentToRow(c: CommentItem): CommentRow {
    const cleanAuthorTag = c.authorTag ? c.authorTag.replace(/^#+/, "").trim() : null;
    const cleanReplyToAuthorTag = c.replyToAuthorTag ? c.replyToAuthorTag.replace(/^#+/, "").trim() : null;

    return {
        id: c.id,
        author: c.author,
        author_tag: cleanAuthorTag || null,
        content: c.content,
        created_at: c.createdAt,
        likes: c.likes ?? 0,
        parent_id: c.parentId || null,
        reply_to_author: c.replyToAuthor || null,
        reply_to_author_tag: cleanReplyToAuthorTag || null,
        is_deleted: c.isDeleted ?? false,
        ip_hash: c.ipHash || null,
    };
}
