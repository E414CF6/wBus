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

export interface CommentsDataset {
    updatedAt: string;
    comments: CommentItem[];
}
