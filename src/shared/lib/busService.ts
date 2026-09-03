import fs from "fs";
import path from "path";
import {scrapeWonjuBusDataset, scrapeWonjuItsYonsei} from "@entities/schedule/itsScraper";
import {APP_CONFIG} from "@shared/config/env";
import {LOCALE} from "@shared/config/locale";
import {loadFromVercelBlob, saveToVercelBlob} from "@shared/lib/blobService";
import type {BusCacheData, CacheMetadata} from "@shared/types/bus";

const LOCAL_DATA_PATH = path.join(process.cwd(), "public", "data", "schedule.json");
export const MIN_REFRESH_INTERVAL_DAYS = 1;
export const MIN_REFRESH_INTERVAL_MS = MIN_REFRESH_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
const IN_MEMORY_TTL_MS = 30 * 1000;

let inMemoryCache: {
    data: BusCacheData; meta: CacheMetadata; timestamp: number;
} | null = null;

function getLocalFilePath(): string {
    return LOCAL_DATA_PATH;
}

function loadFromLocalFile(): BusCacheData | null {
    const filePath = getLocalFilePath();
    if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
        try {
            const rawData = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf-8");
            const parsed = JSON.parse(rawData);
            if (parsed && Array.isArray(parsed.routes) && parsed.routes.length > 0) {
                return parsed;
            }
        } catch (err) {
            console.error("[BusService] Failed to parse local schedule.json:", err);
        }
    }

    const tmpPaths = ["/tmp/schedule.json", "/tmp/scheduleCache.json", "/tmp/cache.json"];
    for (const tmpPath of tmpPaths) {
        if (fs.existsSync(/*turbopackIgnore: true*/ tmpPath)) {
            try {
                const rawData = fs.readFileSync(/*turbopackIgnore: true*/ tmpPath, "utf-8");
                const parsed = JSON.parse(rawData);
                if (parsed && Array.isArray(parsed.routes) && parsed.routes.length > 0) {
                    return parsed;
                }
            } catch {
                // Continue
            }
        }
    }

    return null;
}

export async function loadCacheData(): Promise<BusCacheData | null> {
    try {
        const blobData = await loadFromVercelBlob<BusCacheData>();
        if (blobData && Array.isArray(blobData.routes) && blobData.routes.length > 0) {
            return blobData;
        }
    } catch (err) {
        if (APP_CONFIG.IS_DEV) {
            console.warn("[BusService] Failed to fetch from Vercel Blob:", err);
        }
    }

    return loadFromLocalFile();
}

export function computeCacheMetadata(data: BusCacheData | null): CacheMetadata {
    const updatedAt = data?.updatedAt || new Date().toISOString();
    const totalRoutes = data?.routes ? data.routes.length : 0;

    let canRefresh = true;
    let nextRefreshAvailableAt: string | null = null;

    if (updatedAt) {
        const lastUpdatedTime = new Date(updatedAt).getTime();
        if (!isNaN(lastUpdatedTime)) {
            const timeSinceLastRefresh = Date.now() - lastUpdatedTime;
            canRefresh = timeSinceLastRefresh >= MIN_REFRESH_INTERVAL_MS;
            if (!canRefresh) {
                nextRefreshAvailableAt = new Date(lastUpdatedTime + MIN_REFRESH_INTERVAL_MS).toISOString();
            }
        }
    }

    return {
        exists: totalRoutes > 0,
        updatedAt,
        totalRoutes,
        canRefresh,
        nextRefreshAvailableAt,
        minRefreshIntervalDays: MIN_REFRESH_INTERVAL_DAYS,
    };
}

async function saveCache(data: BusCacheData): Promise<void> {
    const jsonStr = JSON.stringify(data, null, 2);
    const meta = computeCacheMetadata(data);

    inMemoryCache = {
        data, meta, timestamp: Date.now(),
    };

    try {
        await saveToVercelBlob(data, "schedule.json");
    } catch (err) {
        console.warn("[BusService] Vercel Blob save skipped:", err);
    }

    try {
        const p = getLocalFilePath();
        const dir = path.dirname(p);
        if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) {
            fs.mkdirSync(/*turbopackIgnore: true*/ dir, {recursive: true});
        }
        fs.writeFileSync(/*turbopackIgnore: true*/ p, jsonStr, "utf-8");
    } catch {
        // Ignore
    }

    try {
        fs.writeFileSync(/*turbopackIgnore: true*/ "/tmp/schedule.json", jsonStr, "utf-8");
    } catch {
        // Ignore
    }
}

export async function getOrFetchBusData(force = false): Promise<{ data: BusCacheData; meta: CacheMetadata }> {
    if (!force && inMemoryCache && Date.now() - inMemoryCache.timestamp < IN_MEMORY_TTL_MS) {
        return {
            data: inMemoryCache.data, meta: inMemoryCache.meta,
        };
    }

    if (!force) {
        const loaded = await loadCacheData();
        if (loaded) {
            const meta = computeCacheMetadata(loaded);
            inMemoryCache = {data: loaded, meta, timestamp: Date.now()};
            return {data: loaded, meta};
        }
    }

    console.log("[BusService] No cache found. Scraping full timetable from Wonju ITS...");
    try {
        const freshData = await scrapeWonjuBusDataset();
        await saveCache(freshData);
        const meta = computeCacheMetadata(freshData);
        return {data: freshData, meta};
    } catch (err) {
        console.warn("[BusService] Full scrape failed, falling back to Yonsei only:", err);
        try {
            const yonseiData = await scrapeWonjuItsYonsei();
            await saveCache(yonseiData);
            const meta = computeCacheMetadata(yonseiData);
            return {data: yonseiData, meta};
        } catch (fallbackErr) {
            console.error("[BusService] Initial scrape failed completely:", fallbackErr);
            const emptyDataset: BusCacheData = {
                updatedAt: new Date().toISOString(), sourceUrl: "", totalRoutes: 0, routes: [],
            };
            return {data: emptyDataset, meta: computeCacheMetadata(emptyDataset)};
        }
    }
}

export async function refreshBusData(force = true): Promise<{
    refreshed: boolean; message: string; data: BusCacheData; meta: CacheMetadata;
}> {
    const current = await getOrFetchBusData(false);
    const meta = current.meta;

    if (force || !meta.exists || meta.canRefresh) {
        console.log("[BusService] Triggering Wonju ITS scraper for full timetable update...");
        try {
            const newData = await scrapeWonjuBusDataset();
            newData.updatedAt = new Date().toISOString();
            await saveCache(newData);
            const updatedMeta = computeCacheMetadata(newData);
            return {
                refreshed: true,
                message: `최신 시간표 (${newData.totalRoutes}개 노선)를 성공적으로 수집하여 갱신했습니다.`,
                data: newData,
                meta: updatedMeta,
            };
        } catch (err) {
            console.warn("[BusService] Full scraper failed. Falling back to existing cache:", err instanceof Error ? err.message : err);
            return {
                refreshed: false, message: "서버 응답 지연으로 기존 저장된 최신 시간표를 유지합니다.", data: current.data, meta: current.meta,
            };
        }
    }

    const nextAvailableStr = meta.nextRefreshAvailableAt ? new Date(meta.nextRefreshAvailableAt).toLocaleString(LOCALE, {
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }) : "";

    return {
        refreshed: false,
        message: `최소 갱신 주기(${MIN_REFRESH_INTERVAL_DAYS}일)가 지나지 않아 기존 시간표를 사용합니다. (다음 갱신 가능: ${nextAvailableStr})`,
        data: current.data,
        meta: current.meta,
    };
}
