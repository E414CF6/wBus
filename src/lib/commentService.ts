import fs from "fs";
import { CommentItem, CommentsDataset } from "@/types/comment";

const BLOB_COMMENTS_PATH = "comments.json";
const TMP_COMMENTS_PATH = "/tmp/comments.json";

// Default initial sample comments for Yonsei students
const INITIAL_COMMENTS: CommentItem[] = [
  {
    id: "c-init-1",
    author: "정문러",
    content: "30번 터미널 갈 때 상지대 경유 시간표 확인 필수예요!",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
    routeNo: "30",
  },
  {
    id: "c-init-2",
    author: "매지학사",
    content: "34-1번 회촌에서 탈 때 5분 정도 여유 두고 나가는 게 좋습니다.",
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

export async function getComments(): Promise<CommentItem[]> {
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
  const currentList = await getComments();

  const newComment: CommentItem = {
    id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    author: cleanAuthor.slice(0, 20),
    content: cleanContent,
    createdAt: new Date().toISOString(),
    routeNo: routeNo ? routeNo.slice(0, 10) : undefined,
  };

  // Keep up to 100 recent comments
  const updatedList = [newComment, ...currentList].slice(0, 100);
  inMemoryComments = updatedList;

  // Persist asynchronously
  saveToTmp(updatedList);
  saveToBlob(updatedList).catch(() => {});

  return newComment;
}

export async function deleteComment(id: string): Promise<boolean> {
  const currentList = await getComments();
  const nextList = currentList.filter((c) => c.id !== id);
  inMemoryComments = nextList;

  saveToTmp(nextList);
  saveToBlob(nextList).catch(() => {});

  return true;
}
