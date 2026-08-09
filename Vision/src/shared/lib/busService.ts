import fs from "fs";
import path from "path";
import {BusCacheData, CacheMetadata} from "@shared/types/bus";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {runScraper} = require("../../../scripts/scrape.js");

export const MIN_REFRESH_INTERVAL_DAYS = 3;
export const MIN_REFRESH_INTERVAL_MS = MIN_REFRESH_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
const VERCEL_BLOB_PATH = "data/scheduleCache.json";

// In-Memory cache to avoid repeated disk reads during server process lifetime
let inMemoryCache: {
    data: BusCacheData;
    meta: CacheMetadata;
    timestamp: number;
} | null = null;

function getCandidateFilePaths(): string[] {
    return [
        "/tmp/scheduleCache.json",
        path.join(process.cwd(), "data", "scheduleCache.json"),
        path.join(process.cwd(), "public", "data", "scheduleCache.json"),
    ];
}

function resolveExistingFilePath(): string | null {
    for (const p of getCandidateFilePaths()) {
        if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
            return p;
        }
    }
    return null;
}

export function getCacheMetadata(): CacheMetadata {
    const existingPath = resolveExistingFilePath();

    if (!existingPath) {
        return {
            filePath: path.join(process.cwd(), "data", "scheduleCache.json"),
            exists: false,
            sizeBytes: 0,
            updatedAt: null,
            totalRoutes: 0,
            minRefreshIntervalDays: MIN_REFRESH_INTERVAL_DAYS,
            canRefresh: true,
            nextRefreshAvailableAt: null,
        };
    }

    const stats = fs.statSync(/*turbopackIgnore: true*/ existingPath);
    let updatedAt: string | null = null;
    let totalRoutes = 0;

    if (inMemoryCache && inMemoryCache.data) {
        updatedAt = inMemoryCache.data.updatedAt || stats.mtime.toISOString();
        totalRoutes = inMemoryCache.data.routes ? inMemoryCache.data.routes.length : 0;
    } else {
        try {
            const raw = fs.readFileSync(/*turbopackIgnore: true*/ existingPath, "utf-8");
            const parsed: BusCacheData = JSON.parse(raw);
            updatedAt = parsed.updatedAt || stats.mtime.toISOString();
            totalRoutes = parsed.routes ? parsed.routes.length : 0;
        } catch {
            updatedAt = stats.mtime.toISOString();
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
        filePath: existingPath,
        exists: true,
        sizeBytes: stats.size,
        updatedAt,
        totalRoutes,
        minRefreshIntervalDays: MIN_REFRESH_INTERVAL_DAYS,
        canRefresh,
        nextRefreshAvailableAt,
    };
}

async function saveCacheData(cacheData: BusCacheData): Promise<void> {
    const jsonStr = JSON.stringify(cacheData, null, 2);

    // Update in-memory cache immediately
    const meta = getCacheMetadata();
    inMemoryCache = {
        data: cacheData,
        meta,
        timestamp: Date.now(),
    };

    // 1. Upload to Vercel Blob if BLOB_READ_WRITE_TOKEN is set
    if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
            const {put} = await import("@vercel/blob");
            await put(VERCEL_BLOB_PATH, jsonStr, {
                access: "public",
                contentType: "application/json",
                addRandomSuffix: false,
            });
            console.log("[BusService] Successfully uploaded updated timetable data to Vercel Blob.");
        } catch (err) {
            console.error("[BusService] Failed to upload to Vercel Blob:", err);
        }
    }

    // 2. Write to local writeable target (/tmp, data/, public/data/)
    for (const target of getCandidateFilePaths()) {
        try {
            const dir = path.dirname(target);
            if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) {
                fs.mkdirSync(dir, {recursive: true});
            }
            fs.writeFileSync(/*turbopackIgnore: true*/ target, jsonStr, "utf-8");
        } catch (e) {
            // Ignore read-only filesystem errors on Vercel serverless functions
        }
    }
}

export async function refreshBusData(force = false): Promise<{
    refreshed: boolean;
    message: string;
    data: BusCacheData;
    meta: CacheMetadata;
}> {
    const meta = getCacheMetadata();

    if (force || !meta.exists || meta.canRefresh) {
        console.log("[BusService] Starting scraper for bus timetable data...");
        const newData: BusCacheData = await runScraper();
        await saveCacheData(newData);
        return {
            refreshed: true,
            message: "시간표 데이터가 원주시 ITS에서 새로 수집되어 성공적으로 갱신되었습니다.",
            data: newData,
            meta: getCacheMetadata(),
        };
    }

    console.log("[BusService] Minimum refresh interval (3 days) not reached. Using existing cache.");
    const res = await getOrFetchBusData(false);

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
        message: `최소 하한 갱신 시간(3일)이 지나지 않아 시간표를 갱신하지 않았습니다. (다음 갱신 가능: ${nextAvailableStr})`,
        data: res.data,
        meta: res.meta,
    };
}

export async function getOrFetchBusData(forceRefresh = false): Promise<{ data: BusCacheData; meta: CacheMetadata }> {
    if (!forceRefresh && inMemoryCache) {
        return {
            data: inMemoryCache.data,
            meta: inMemoryCache.meta,
        };
    }

    const existingPath = resolveExistingFilePath();

    if (forceRefresh || !existingPath) {
        console.log("[BusService] Cache file missing or refresh forced. Scraping Wonju ITS...");
        const newData = await runScraper();
        await saveCacheData(newData);
        return {
            data: newData,
            meta: getCacheMetadata(),
        };
    }

    try {
        const raw = fs.readFileSync(/*turbopackIgnore: true*/ existingPath, "utf-8");
        const data: BusCacheData = JSON.parse(raw);
        const meta = getCacheMetadata();
        inMemoryCache = {
            data,
            meta,
            timestamp: Date.now(),
        };
        return {
            data,
            meta,
        };
    } catch (err) {
        console.error("[BusService] Error reading cache file, rescraping:", err);
        const newData = await runScraper();
        await saveCacheData(newData);
        return {
            data: newData,
            meta: getCacheMetadata(),
        };
    }
}
