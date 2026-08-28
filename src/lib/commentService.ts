import fs from "fs";
import path from "path";
import {CommentItem, CommentsDataset} from "@/types/comment";

const BLOB_COMMENTS_PATH = "comments.json";
export const COMMENT_DISPLAY_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours (1 day)

// Default initial sample comments for realistic board preview
const INITIAL_COMMENTS: CommentItem[] = [{
    id: "c-init-1",
    author: "매지호오리",
    content: "34-1번 탈 때 회촌 출발 후 5~7분 정도 뒤에 학관에 도착해요!",
    category: "꿀팁",
    createdAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(), // 75 mins ago
    routeNo: "34-1",
    likes: 3,
}, {
    id: "c-init-2",
    author: "독수리",
    content: "오늘 34번 시내 방면 도로 원활해서 제시간에 잘 도착합니다.",
    category: "제보",
    createdAt: new Date(Date.now() - 1000 * 60 * 160).toISOString(), // ~2.5 hours ago
    routeNo: "34",
    likes: 2,
}, {
    id: "c-init-3",
    author: "학관러버",
    content: "30번 버스는 평일과 방학/휴일 운행 시간이 동일하니 참고하세요!",
    category: "꿀팁",
    createdAt: new Date(Date.now() - 1000 * 60 * 320).toISOString(), // ~5 hours ago
    routeNo: "30",
    likes: 5,
},];

let inMemoryComments: CommentItem[] | null = null;

function getLocalCachePath(): string {
    return path.join(process.cwd(), ".cache", "comments.json");
}

async function loadFromBlob(): Promise<CommentItem[] | null> {
    try {
        const {head} = await import("@vercel/blob");
        const blobResult = await head(BLOB_COMMENTS_PATH);
        if (blobResult && blobResult.url) {
            const res = await fetch(`${blobResult.url}?t=${Date.now()}`, {
                cache: "no-store",
            });
            if (res.ok) {
                const data: CommentsDataset = await res.json();
                if (data && Array.isArray(data.comments)) {
                    return data.comments;
                }
            }
        }
    } catch {
        // Fall through
    }
    return null;
}

async function saveToBlob(comments: CommentItem[]): Promise<void> {
    const dataset: CommentsDataset = {
        updatedAt: new Date().toISOString(), comments,
    };
    const jsonStr = JSON.stringify(dataset, null, 2);

    try {
        const {put} = await import("@vercel/blob");
        await put(BLOB_COMMENTS_PATH, jsonStr, {
            access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true,
        });
    } catch (err) {
        console.warn("[Comments] Could not save to Vercel Blob:", err);
    }
}

function loadFromLocalFile(): CommentItem[] | null {
    // 1. Check .cache/comments.json
    const localPath = getLocalCachePath();
    if (fs.existsSync(localPath)) {
        try {
            const raw = fs.readFileSync(localPath, "utf-8");
            const parsed: CommentsDataset = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.comments)) {
                return parsed.comments;
            }
        } catch {
            // Ignore
        }
    }

    // 2. Check /tmp/comments.json
    const tmpPath = "/tmp/comments.json";
    if (fs.existsSync(tmpPath)) {
        try {
            const raw = fs.readFileSync(tmpPath, "utf-8");
            const parsed: CommentsDataset = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.comments)) {
                return parsed.comments;
            }
        } catch {
            // Ignore
        }
    }
    return null;
}

function saveToLocalFile(comments: CommentItem[]): void {
    const dataset: CommentsDataset = {
        updatedAt: new Date().toISOString(), comments,
    };
    const jsonStr = JSON.stringify(dataset, null, 2);

    // 1. Save to .cache/comments.json
    try {
        const localPath = getLocalCachePath();
        const dir = path.dirname(localPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(localPath, jsonStr, "utf-8");
    } catch {
        // Ignore
    }

    // 2. Save to /tmp/comments.json
    try {
        fs.writeFileSync("/tmp/comments.json", jsonStr, "utf-8");
    } catch {
        // Ignore
    }
}

/**
 * Loads all stored comments from storage/memory.
 */
export async function getAllStoredComments(forceReload = false): Promise<CommentItem[]> {
    if (!forceReload && inMemoryComments) {
        return inMemoryComments;
    }

    // 1. Try Vercel Blob
    const blobComments = await loadFromBlob();
    if (blobComments) {
        inMemoryComments = blobComments;
        return inMemoryComments;
    }

    // 2. Try Local File (.cache / /tmp)
    const fileComments = loadFromLocalFile();
    if (fileComments) {
        inMemoryComments = fileComments;
        return inMemoryComments;
    }

    // 3. Fallback to initial comments
    inMemoryComments = INITIAL_COMMENTS;
    return inMemoryComments;
}

/**
 * Retrieves comments.
 * By default (onlyRecent = true), returns only comments written within the last 24 hours.
 */
export async function getComments(onlyRecent = true, forceReload = false): Promise<CommentItem[]> {
    const allComments = await getAllStoredComments(forceReload);

    if (!onlyRecent) {
        return allComments;
    }

    const cutoff = Date.now() - COMMENT_DISPLAY_DURATION_MS;
    return allComments.filter((c) => {
        const time = new Date(c.createdAt).getTime();
        return !isNaN(time) && time >= cutoff;
    });
}

export async function addComment({
                                     author, content, routeNo, category,
                                 }: {
    author?: string; content: string; routeNo?: string; category?: string;
}): Promise<CommentItem> {
    const cleanContent = content.trim();
    if (!cleanContent) {
        throw new Error("댓글 내용을 입력해주세요.");
    }
    if (cleanContent.length > 150) {
        throw new Error("댓글은 최대 150자까지 작성할 수 있습니다.");
    }

    const cleanAuthor = author?.trim() || "익명";
    const currentList = await getAllStoredComments();

    const newComment: CommentItem = {
        id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        author: cleanAuthor.slice(0, 20),
        content: cleanContent,
        category: category ? category.slice(0, 10) : "제보",
        createdAt: new Date().toISOString(),
        routeNo: routeNo ? routeNo.slice(0, 10) : undefined,
        likes: 0,
    };

    // Permanently save new comment at the top of the archive (up to 5000 items)
    const updatedList = [newComment, ...currentList].slice(0, 5000);
    inMemoryComments = updatedList;

    // Persist asynchronously to storage
    saveToLocalFile(updatedList);
    saveToBlob(updatedList).catch(() => {
    });

    return newComment;
}

export async function likeComment(id: string): Promise<CommentItem | null> {
    const currentList = await getAllStoredComments();
    let updatedComment: CommentItem | null = null;

    const nextList = currentList.map((c) => {
        if (c.id === id) {
            updatedComment = {
                ...c, likes: (c.likes || 0) + 1,
            };
            return updatedComment;
        }
        return c;
    });

    if (!updatedComment) {
        return null;
    }

    inMemoryComments = nextList;
    saveToLocalFile(nextList);
    saveToBlob(nextList).catch(() => {
    });

    return updatedComment;
}

export async function deleteComment(id: string): Promise<boolean> {
    const currentList = await getAllStoredComments();
    const nextList = currentList.filter((c) => c.id !== id);
    inMemoryComments = nextList;

    saveToLocalFile(nextList);
    saveToBlob(nextList).catch(() => {
    });

    return true;
}
