import fs from "fs";
import { CommentItem, CommentsDataset } from "@/types/comment";

const BLOB_COMMENTS_PATH = "comments.json";
const TMP_COMMENTS_PATH = "/tmp/comments.json";
export const COMMENT_DISPLAY_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours (1 day)

// Default initial sample comments
const INITIAL_COMMENTS: CommentItem[] = [
  {
    id: "c-init-1",
    author: "고양이",
    content: "34-1번 탈 때 6분 정도 이후에 학관에 도착해요.",
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3 hours ago
    routeNo: "34-1",
  },
];

let inMemoryComments: CommentItem[] | null = null;

async function loadFromBlob(): Promise<CommentItem[] | null> {
  try {
    const { head } = await import("@vercel/blob");
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
    updatedAt: new Date().toISOString(),
    comments,
  };
  const jsonStr = JSON.stringify(dataset, null, 2);

  try {
    const { put } = await import("@vercel/blob");
    await put(BLOB_COMMENTS_PATH, jsonStr, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (err) {
    console.warn("[Comments] Could not save to Vercel Blob:", err);
  }
}

function loadFromTmp(): CommentItem[] | null {
  if (fs.existsSync(TMP_COMMENTS_PATH)) {
    try {
      const raw = fs.readFileSync(TMP_COMMENTS_PATH, "utf-8");
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

function saveToTmp(comments: CommentItem[]): void {
  const dataset: CommentsDataset = {
    updatedAt: new Date().toISOString(),
    comments,
  };
  try {
    fs.writeFileSync(TMP_COMMENTS_PATH, JSON.stringify(dataset, null, 2), "utf-8");
  } catch {
    // Ignore
  }
}

/**
 * Loads all stored comments from storage/memory.
 */
export async function getAllStoredComments(): Promise<CommentItem[]> {
  if (inMemoryComments) {
    return inMemoryComments;
  }

  // 1. Try Vercel Blob
  const blobComments = await loadFromBlob();
  if (blobComments) {
    inMemoryComments = blobComments;
    return inMemoryComments;
  }

  // 2. Try /tmp/
  const tmpComments = loadFromTmp();
  if (tmpComments) {
    inMemoryComments = tmpComments;
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
export async function getComments(onlyRecent = true): Promise<CommentItem[]> {
  const allComments = await getAllStoredComments();

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
  author,
  content,
  routeNo,
}: {
  author?: string;
  content: string;
  routeNo?: string;
}): Promise<CommentItem> {
  const cleanContent = content.trim();
  if (!cleanContent) {
    throw new Error("댓글 내용을 입력해주세요.");
  }
  if (cleanContent.length > 150) {
    throw new Error("댓글은 최대 150자까지 작성할 수 있습니다.");
  }

  const cleanAuthor = author?.trim() || "익명 연세인";
  const currentList = await getAllStoredComments();

  const newComment: CommentItem = {
    id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    author: cleanAuthor.slice(0, 20),
    content: cleanContent,
    createdAt: new Date().toISOString(),
    routeNo: routeNo ? routeNo.slice(0, 10) : undefined,
  };

  // Permanently save new comment at the top of the archive (up to 5000 items)
  const updatedList = [newComment, ...currentList].slice(0, 5000);
  inMemoryComments = updatedList;

  // Persist asynchronously to storage
  saveToTmp(updatedList);
  saveToBlob(updatedList).catch(() => {});

  return newComment;
}

export async function deleteComment(id: string): Promise<boolean> {
  const currentList = await getAllStoredComments();
  const nextList = currentList.filter((c) => c.id !== id);
  inMemoryComments = nextList;

  saveToTmp(nextList);
  saveToBlob(nextList).catch(() => {});

  return true;
}
