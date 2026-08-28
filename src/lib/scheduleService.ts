import fs from "fs";
import path from "path";
import { CacheMetadata, RouteDataset } from "@/types/bus";
import { YONSEI_DATA } from "@/data/yonseiRoutes";
import { scrapeWonjuItsYonsei } from "./itsScraper";
import { loadFromVercelBlob, saveToVercelBlob } from "./blobService";

export const MIN_REFRESH_INTERVAL_DAYS = 1;
export const MIN_REFRESH_INTERVAL_MS =
  MIN_REFRESH_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
const IN_MEMORY_TTL_MS = 30 * 1000; // 30 seconds

let inMemoryCache: {
  data: RouteDataset;
  meta: CacheMetadata;
  timestamp: number;
} | null = null;

function getLocalFilePath(): string {
  return path.join(process.cwd(), "src", "data", "yonseiRoutes.json");
}

function loadFromFile(): RouteDataset | null {
  // Check /tmp first for serverless environment
  const tmpPath = "/tmp/cache.json";
  if (fs.existsSync(tmpPath)) {
    try {
      const raw = fs.readFileSync(tmpPath, "utf-8");
      const parsed: RouteDataset = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.routes) && parsed.routes.length > 0) {
        return parsed;
      }
    } catch {
      // Ignore
    }
  }

  // Check static file in project
  const localPath = getLocalFilePath();
  if (fs.existsSync(localPath)) {
    try {
      const raw = fs.readFileSync(localPath, "utf-8");
      const parsed: RouteDataset = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.routes) && parsed.routes.length > 0) {
        return parsed;
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

export function getCacheMetadata(overrideData?: RouteDataset): CacheMetadata {
  const target =
    overrideData || inMemoryCache?.data || loadFromFile() || YONSEI_DATA;
  const updatedAt = target.updatedAt || new Date().toISOString();
  const totalRoutes = target.routes ? target.routes.length : 0;

  let canRefresh = true;
  let nextRefreshAvailableAt: string | null = null;

  if (updatedAt) {
    const lastMs = new Date(updatedAt).getTime();
    if (!isNaN(lastMs)) {
      const nextMs = lastMs + MIN_REFRESH_INTERVAL_MS;
      nextRefreshAvailableAt = new Date(nextMs).toISOString();
      canRefresh = Date.now() >= nextMs;
    }
  }

  return {
    exists: true,
    updatedAt,
    totalRoutes,
    minRefreshIntervalDays: MIN_REFRESH_INTERVAL_DAYS,
    canRefresh,
    nextRefreshAvailableAt,
  };
}

async function saveCache(data: RouteDataset): Promise<void> {
  const jsonStr = JSON.stringify(data, null, 2);
  const meta = getCacheMetadata(data);

  // 1. Update in-memory cache with immediate current timestamp
  inMemoryCache = {
    data,
    meta,
    timestamp: Date.now(),
  };

  // 2. Save to Vercel Blob (Supports OIDC or token authentication)
  try {
    await saveToVercelBlob(data);
  } catch (err) {
    console.warn("[ScheduleService] Vercel Blob save skipped:", err);
  }

  // 3. Save to /tmp/ for serverless container caching
  try {
    fs.writeFileSync("/tmp/cache.json", jsonStr, "utf-8");
  } catch {
    // Ignore in read-only environment
  }

  // 4. Save to local file if writable
  try {
    const localPath = getLocalFilePath();
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(localPath, jsonStr, "utf-8");
  } catch {
    // Ignore
  }
}

export async function getOrFetchSchedule(
  force = false
): Promise<{ data: RouteDataset; meta: CacheMetadata }> {
  // 1. Check in-memory cache (with TTL)
  if (!force && inMemoryCache && Date.now() - inMemoryCache.timestamp < IN_MEMORY_TTL_MS) {
    return {
      data: inMemoryCache.data,
      meta: inMemoryCache.meta,
    };
  }

  if (!force) {
    // 2. Check Vercel Blob (OIDC or Token)
    try {
      const blobData = await loadFromVercelBlob();
      if (blobData) {
        const meta = getCacheMetadata(blobData);
        inMemoryCache = { data: blobData, meta, timestamp: Date.now() };
        return { data: blobData, meta };
      }
    } catch (err) {
      console.warn("[ScheduleService] Vercel Blob load fallback:", err);
    }

    // 3. Check local/tmp file
    const fromFile = loadFromFile();
    if (fromFile) {
      const meta = getCacheMetadata(fromFile);
      inMemoryCache = { data: fromFile, meta, timestamp: Date.now() };
      return { data: fromFile, meta };
    }
  }

  // 4. Fallback to bundled dataset
  const meta = getCacheMetadata(YONSEI_DATA);
  inMemoryCache = { data: YONSEI_DATA, meta, timestamp: Date.now() };
  return { data: YONSEI_DATA, meta };
}

export async function refreshSchedule(force = true): Promise<{
  refreshed: boolean;
  message: string;
  data: RouteDataset;
  meta: CacheMetadata;
}> {
  const current = await getOrFetchSchedule(false);
  const meta = current.meta;

  if (force || !meta.exists || meta.canRefresh) {
    console.log("[ScheduleService] Triggering Wonju ITS scraper for timetable update...");
    try {
      const newData = await scrapeWonjuItsYonsei();
      // Ensure updatedAt is set to current timestamp
      newData.updatedAt = new Date().toISOString();
      await saveCache(newData);
      const updatedMeta = getCacheMetadata(newData);
      return {
        refreshed: true,
        message: "원주시 교통정보센터(ITS)에서 최신 시간표를 성공적으로 가져왔습니다.",
        data: newData,
        meta: updatedMeta,
      };
    } catch (err) {
      console.warn(
        "[ScheduleService] Scraper failed. Falling back to existing cache:",
        err instanceof Error ? err.message : err
      );
      return {
        refreshed: false,
        message: "원주시 ITS 서버 응답 지연으로 기존 저장된 최신 시간표를 유지합니다.",
        data: current.data,
        meta: current.meta,
      };
    }
  }

  const nextAvailableStr = meta.nextRefreshAvailableAt
    ? new Date(meta.nextRefreshAvailableAt).toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return {
    refreshed: false,
    message: `최소 갱신 주기(${MIN_REFRESH_INTERVAL_DAYS}일)가 지나지 않아 기존 시간표를 사용합니다. (다음 갱신 가능: ${nextAvailableStr})`,
    data: current.data,
    meta: current.meta,
  };
}
