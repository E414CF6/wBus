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
}

export interface CommentsDataset {
    updatedAt: string;
    comments: CommentItem[];
}
