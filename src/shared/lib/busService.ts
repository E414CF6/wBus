import fs from "fs";
import path from "path";
import {BusCacheData, CacheMetadata} from "@shared/types/bus";
import {runScraper} from "../../../scripts/scrape-wonju-its.mjs";

export const MIN_REFRESH_INTERVAL_DAYS = 1;
export const MIN_REFRESH_INTERVAL_MS = MIN_REFRESH_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
const VERCEL_BLOB_PATH = "scheduleCache.json";

// In-Memory cache for node process lifetime
let inMemoryCache: {
    data: BusCacheData; meta: CacheMetadata; timestamp: number;
} | null = null;

function getBlobUrlFromEnv(): string | null {
    if (process.env.NEXT_PUBLIC_STATIC_API_URL?.startsWith("http")) {
        return `${process.env.NEXT_PUBLIC_STATIC_API_URL.replace(/\/+$/, "")}/${VERCEL_BLOB_PATH}`;
    }
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return null;
    const match = token.match(/^vercel_blob_rw_([^_]+)_/);
    if (match) {
        return `https://${match[1].toLowerCase()}.public.blob.vercel-storage.com/${VERCEL_BLOB_PATH}`;
    }
    return null;
}

async function loadFromVercelBlob(): Promise<BusCacheData | null> {
    const directUrl = getBlobUrlFromEnv();

    // 1. Try reading via @vercel/blob SDK (head)
    if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
            const {head} = await import("@vercel/blob");
            const blobResult = await head(VERCEL_BLOB_PATH);
            if (blobResult && blobResult.url) {
                console.log(`[BusService] Fetching timetable cache from Vercel Blob: ${blobResult.url}`);
                const res = await fetch(blobResult.url, {cache: "no-store"});
                if (res.ok) {
                    const data: BusCacheData = await res.json();
                    if (data && Array.isArray(data.routes) && data.routes.length > 0) {
                        console.log(`[BusService] Successfully loaded ${data.routes.length} routes from Vercel Blob.`);
                        return data;
                    }
                }
            }
        } catch (err) {
            console.warn("[BusService] Could not inspect Vercel Blob via SDK:", err instanceof Error ? err.message : err);
        }
    }

    // 2. Try fetching direct Blob URL
    if (directUrl) {
        try {
            console.log(`[BusService] Attempting to fetch timetable cache from direct Blob URL: ${directUrl}`);
            const res = await fetch(directUrl, {cache: "no-store"});
            if (res.ok) {
                const data: BusCacheData = await res.json();
                if (data && Array.isArray(data.routes) && data.routes.length > 0) {
                    console.log(`[BusService] Successfully loaded ${data.routes.length} routes from direct Blob URL.`);
                    return data;
                }
            }
        } catch (err) {
            console.warn("[BusService] Could not fetch timetable from direct Blob URL:", err instanceof Error ? err.message : err);
        }
    }

    return null;
}

function getLocalFilePath(): string {
    return path.join(process.cwd(), "public", "data", "scheduleCache.json");
}

function loadFromLocalFile(): BusCacheData | null {
    const localPath = getLocalFilePath();
    if (fs.existsSync(/*turbopackIgnore: true*/ localPath)) {
        try {
            const raw = fs.readFileSync(/*turbopackIgnore: true*/ localPath, "utf-8");
            const data: BusCacheData = JSON.parse(raw);
            if (data && Array.isArray(data.routes) && data.routes.length > 0) {
                return data;
            }
        } catch (err) {
            console.warn("[BusService] Error reading local scheduleCache.json:", err);
        }
    }
    return null;
}

export function getCacheMetadata(): CacheMetadata {
    let updatedAt: string | null = null;
    let totalRoutes = 0;
    let sizeBytes = 0;
    let exists = false;
    const filePath = getLocalFilePath();

    if (inMemoryCache && inMemoryCache.data) {
        exists = true;
        updatedAt = inMemoryCache.data.updatedAt || new Date().toISOString();
        totalRoutes = inMemoryCache.data.routes ? inMemoryCache.data.routes.length : 0;
    } else {
        const localData = loadFromLocalFile();
        if (localData) {
            exists = true;
            updatedAt = localData.updatedAt || new Date().toISOString();
            totalRoutes = localData.routes ? localData.routes.length : 0;
            try {
                const stats = fs.statSync(/*turbopackIgnore: true*/ filePath);
                sizeBytes = stats.size;
            } catch {
                sizeBytes = 0;
            }
        }
    }

    let canRefresh = true;
    let nextRefreshAvailableAt: string | null = null;

    if (updatedAt) {
        const lastUpdateMs = new Date(updatedAt).getTime();
        if (!isNaN(lastUpdateMs)) {
            const nextRefreshMs = lastUpdateMs + MIN_REFRESH_INTERVAL_MS;
            nextRefreshAvailableAt = new Date(nextRefreshMs).toISOString();
            canRefresh = Date.now() >= nextRefreshMs;
        }
    }

    return {
        filePath,
        exists,
        sizeBytes,
        updatedAt,
        totalRoutes,
        minRefreshIntervalDays: MIN_REFRESH_INTERVAL_DAYS,
        canRefresh,
        nextRefreshAvailableAt,
    };
}

async function saveCacheData(cacheData: BusCacheData): Promise<void> {
    const jsonStr = JSON.stringify(cacheData, null, 2);

    // 1. Update in-memory cache
    inMemoryCache = {
        data: cacheData, meta: getCacheMetadata(), timestamp: Date.now(),
    };

    // 2. Try saving to local file if writable (e.g. local dev environment)
    try {
        const localPath = getLocalFilePath();
        const dir = path.dirname(localPath);
        if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        fs.writeFileSync(/*turbopackIgnore: true*/ localPath, jsonStr, "utf-8");
        console.log("[BusService] Saved timetable cache to local public/data/scheduleCache.json.");
    } catch {
        // Ignore read-only filesystem errors on serverless functions
    }

    // 3. Upload to Vercel Blob if BLOB_READ_WRITE_TOKEN is set
    if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
            const {put} = await import("@vercel/blob");
            await put(VERCEL_BLOB_PATH, jsonStr, {
                access: "public", contentType: "application/json", addRandomSuffix: false,
            });
            console.log("[BusService] Successfully uploaded updated timetable data to Vercel Blob.");
        } catch (err) {
            console.error("[BusService] Failed to upload to Vercel Blob:", err);
        }
    }
}

export async function refreshBusData(force = false): Promise<{
    refreshed: boolean; message: string; data: BusCacheData; meta: CacheMetadata;
}> {
    const currentRes = await getOrFetchBusData(false);
    const meta = currentRes.meta;

    if (force || !meta.exists || meta.canRefresh) {
        console.log("[BusService] Starting scraper for bus timetable data...");
        const newData: BusCacheData = await runScraper();
        await saveCacheData(newData);
        return {
            refreshed: true,
            message: "시간표 데이터가 원주시 ITS에서 새로 수집되어 Vercel Blob 및 캐시에 성공적으로 저장되었습니다.",
            data: newData,
            meta: getCacheMetadata(),
        };
    }

    console.log("[BusService] Minimum refresh interval not reached. Using existing cache.");

    const nextAvailableStr = meta.nextRefreshAvailableAt ? new Date(meta.nextRefreshAvailableAt).toLocaleString("ko-KR", {
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }) : "";

    return {
        refreshed: false,
        message: `최소 하한 갱신 시간이 지나지 않아 시간표를 갱신하지 않았습니다. (다음 갱신 가능: ${nextAvailableStr})`,
        data: currentRes.data,
        meta: currentRes.meta,
    };
}

export async function getOrFetchBusData(forceRefresh = false): Promise<{ data: BusCacheData; meta: CacheMetadata }> {
    // 1. Check In-Memory Cache
    if (!forceRefresh && inMemoryCache) {
        return {
            data: inMemoryCache.data, meta: getCacheMetadata(),
        };
    }

    if (!forceRefresh) {
        // 2. Try Vercel Blob (Primary remote storage for production)
        const blobData = await loadFromVercelBlob();
        if (blobData) {
            inMemoryCache = {
                data: blobData, meta: getCacheMetadata(), timestamp: Date.now(),
            };
            return {
                data: blobData, meta: getCacheMetadata(),
            };
        }

        // 3. Fallback to Local Static File (public/data/scheduleCache.json)
        const localData = loadFromLocalFile();
        if (localData) {
            inMemoryCache = {
                data: localData, meta: getCacheMetadata(), timestamp: Date.now(),
            };
            return {
                data: localData, meta: getCacheMetadata(),
            };
        }
    }

    // 4. Scraper Fallback (If cache missing across Blob/Local or refresh forced)
    console.log("[BusService] Cache missing across Vercel Blob/Local or refresh forced. Scraping Wonju ITS...");
    const newData = await runScraper();
    await saveCacheData(newData);
    return {
        data: newData, meta: getCacheMetadata(),
    };
}
