import type {CommentItem} from "@entities/comment";

export interface ReplyTarget {
    id: string; // Root parent thread ID
    author: string;
    authorTag?: string;
    content: string;
}

export interface ChatViewProps {
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

export interface TrendingTag {
    tag: string;
    count: number;
    score: number;
}

export interface RankedThread {
    thread: CommentItem;
    replyCount: number;
    score: number;
}

export type ChatFeedTab = "LATEST" | "HOT" | "MINE";

export const QUICK_HASHTAGS = [
    "#실시간",
    "#버스상황",
    "#셔틀지연",
    "#좌석여유",
    "#분실물",
    "#학관",
    "#질문",
    "#일상",
];
