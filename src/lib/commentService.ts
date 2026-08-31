import fs from "fs";
import path from "path";
import {CommentItem, CommentsDataset} from "@/types/comment";
import {generateUserTag, getRandomNickname} from "@/data/nicknames";
import {getUpstashRedis} from "@shared/redis/upstash";

const UPSTASH_COMMENTS_KEY = "wbus:comments";
const BLOB_COMMENTS_PATH = "comments.json";

// Default initial sample comments for realistic board preview
const INITIAL_COMMENTS: CommentItem[] = [{
    id: "c-init-1",
    author: "매지호오리",
    authorTag: "#m3j9h1",
    content: "34-1번 탈 때 회촌 출발 후 5~7분 정도 뒤에 학관에 도착해요!",
    category: "꿀팁",
    createdAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(), // 75 mins ago
    routeNo: "34-1",
    likes: 3,
}, {
    id: "c-init-2",
    author: "독수리",
    authorTag: "#e4g8le",
    content: "오늘 34번 시내 방면 도로 원활해서 제시간에 잘 도착합니다.",
    category: "제보",
    createdAt: new Date(Date.now() - 1000 * 60 * 160).toISOString(), // ~2.5 hours ago
    routeNo: "34",
    likes: 2,
}, {
    id: "c-init-3",
    author: "학관러버",
    authorTag: "#y0ns3i",
    content: "30번 버스는 평일과 방학/휴일 운행 시간이 동일하니 참고하세요!",
    category: "꿀팁",
    createdAt: new Date(Date.now() - 1000 * 60 * 320).toISOString(), // ~5 hours ago
    routeNo: "30",
    likes: 5,
},];

let inMemoryComments: CommentItem[] | null = null;

function getLocalCachePath(): string {
    return path.join(process.cwd(), "public", "data", "comments.json");
}

/**
 * 1. Upstash Redis Data Layer
 */
async function loadFromUpstash(): Promise<CommentItem[] | null> {
    const redis = getUpstashRedis();
    if (!redis) return null;

    try {
        const raw = await redis.get<CommentItem[] | CommentsDataset | string>(UPSTASH_COMMENTS_KEY);
        if (!raw) return null;

        if (Array.isArray(raw)) {
            return raw;
        }
        if (typeof raw === "object" && "comments" in raw && Array.isArray((raw as CommentsDataset).comments)) {
            return (raw as CommentsDataset).comments;
        }
        if (typeof raw === "string") {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && Array.isArray(parsed.comments)) return parsed.comments;
        }
    } catch (err) {
        console.warn("[Comments] Failed to read from Upstash Redis:", err);
    }
    return null;
}

async function saveToUpstash(comments: CommentItem[]): Promise<void> {
    const redis = getUpstashRedis();
    if (!redis) return;

    try {
        const dataset: CommentsDataset = {
            updatedAt: new Date().toISOString(), comments,
        };
        await redis.set(UPSTASH_COMMENTS_KEY, dataset);
    } catch (err) {
        console.warn("[Comments] Failed to save to Upstash Redis:", err);
    }
}

/**
 * 2. Vercel Blob Fallback Layer
 */
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

/**
 * 3. Local File Fallback Layer
 */
function loadFromLocalFile(): CommentItem[] | null {
    // 1. Check public/data/comments.json
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

    // 1. Save to public/data/comments.json
    try {
        const localPath = getLocalCachePath();
        const dir = path.dirname(localPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(localPath, jsonStr, "utf-8");
    } catch {
        // Read-only serverless environment fallback
    }

    // 2. Save to /tmp/comments.json
    try {
        fs.writeFileSync("/tmp/comments.json", jsonStr, "utf-8");
    } catch {
        // Ignore
    }
}

/**
 * Main Service Methods
 */
export async function getComments(forceFresh = false): Promise<CommentItem[]> {
    if (!forceFresh && inMemoryComments !== null) {
        return inMemoryComments;
    }

    // 1. Try loading from Upstash Redis (Highest priority)
    const upstashComments = await loadFromUpstash();
    if (upstashComments !== null) {
        inMemoryComments = upstashComments;
        return inMemoryComments;
    }

    // 2. Try loading from Vercel Blob
    const blobComments = await loadFromBlob();
    if (blobComments !== null) {
        inMemoryComments = blobComments;
        return inMemoryComments;
    }

    // 3. Try loading from local public/data/comments.json or /tmp/comments.json
    const localComments = loadFromLocalFile();
    if (localComments !== null) {
        inMemoryComments = localComments;
        return inMemoryComments;
    }

    // 4. Fallback to default initial comments and seed
    inMemoryComments = INITIAL_COMMENTS;
    saveToLocalFile(inMemoryComments);
    saveToUpstash(inMemoryComments).catch(() => {
    });
    return inMemoryComments;
}

export async function addComment(params: {
    author?: string;
    content: string;
    routeNo?: string;
    category?: string;
    parentId?: string;
    replyToAuthor?: string;
    authorTag?: string;
    replyToAuthorTag?: string;
}): Promise<CommentItem> {
    const current = await getComments(true);

    const generatedTag = params.authorTag || generateUserTag();
    const finalAuthor = params.author?.trim() || getRandomNickname();

    const newComment: CommentItem = {
        id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        author: finalAuthor,
        authorTag: generatedTag,
        content: params.content.trim(),
        category: params.category || "잡담",
        createdAt: new Date().toISOString(),
        routeNo: params.routeNo || "ALL",
        likes: 0,
        parentId: params.parentId,
        replyToAuthor: params.replyToAuthor,
        replyToAuthorTag: params.replyToAuthorTag,
    };

    const updated = [newComment, ...current];
    inMemoryComments = updated;

    await Promise.allSettled([saveToUpstash(updated), saveToBlob(updated), Promise.resolve(saveToLocalFile(updated)),]);

    return newComment;
}

export async function likeComment(id: string): Promise<CommentItem | null> {
    const current = await getComments(true);
    let targetComment: CommentItem | null = null;

    const updated = current.map((c) => {
        if (c.id === id) {
            targetComment = {...c, likes: (c.likes || 0) + 1};
            return targetComment;
        }
        return c;
    });

    if (!targetComment) return null;

    inMemoryComments = updated;
    await Promise.allSettled([saveToUpstash(updated), saveToBlob(updated), Promise.resolve(saveToLocalFile(updated)),]);

    return targetComment;
}

export async function deleteComment(id: string, authorTag?: string): Promise<CommentItem | null> {
    const current = await getComments(true);
    let targetComment: CommentItem | null = null;

    const updated = current.map((c) => {
        if (c.id === id) {
            if (authorTag && c.authorTag && c.authorTag !== authorTag) {
                throw new Error("작성자만 삭제할 수 있습니다.");
            }
            targetComment = {
                ...c, isDeleted: true, content: "삭제된 메시지입니다.",
            };
            return targetComment;
        }
        return c;
    });

    if (!targetComment) return null;

    inMemoryComments = updated;
    await Promise.allSettled([saveToUpstash(updated), saveToBlob(updated), Promise.resolve(saveToLocalFile(updated)),]);

    return targetComment;
}
