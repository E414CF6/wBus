import {BusCacheData, CacheMetadata} from "@shared/types/bus";
import {APP_CONFIG} from "@shared/config/env";
import {loadFromVercelBlob, saveToVercelBlob} from "@/lib/blobService";
import {scrapeWonjuBusDataset, scrapeWonjuItsYonsei} from "@/lib/itsScraper";
import fs from "fs";
import path from "path";

const LOCAL_DATA_PATH = path.join(process.cwd(), "public", "data", "schedule.json");
export const MIN_REFRESH_INTERVAL_DAYS = 1;
export const MIN_REFRESH_INTERVAL_MS = MIN_REFRESH_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

function getLocalFilePath(): string {
    return LOCAL_DATA_PATH;
}

export async function loadCacheData(): Promise<BusCacheData | null> {
    // 1. Try loading from Vercel Blob first (schedule.json)
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

    // 2. Check serverless container /tmp/ schedule.json
    for (const tmpPath of ["/tmp/schedule.json", "/tmp/scheduleCache.json", "/tmp/cache.json"]) {
        if (fs.existsSync(/*turbopackIgnore: true*/ tmpPath)) {
            try {
                const raw = fs.readFileSync(/*turbopackIgnore: true*/ tmpPath, "utf-8");
                const data: BusCacheData = JSON.parse(raw);
                if (data && Array.isArray(data.routes) && data.routes.length > 0) {
                    return data;
                }
            } catch (err) {
                console.warn(`[BusService] Error reading ${tmpPath}:`, err);
            }
        }
    }

    // 3. Check public/data/schedule.json
    const localDataPath = getLocalFilePath();
    if (fs.existsSync(/*turbopackIgnore: true*/ localDataPath)) {
        try {
            const raw = fs.readFileSync(/*turbopackIgnore: true*/ localDataPath, "utf-8");
            const data: BusCacheData = JSON.parse(raw);
            if (data && Array.isArray(data.routes) && data.routes.length > 0) {
                return data;
            }
        } catch (err) {
            console.warn(`[BusService] Error reading ${localDataPath}:`, err);
        }
    }

    return null;
}

export function getCacheMetadata(overrideData?: BusCacheData): CacheMetadata {
    let updatedAt: string | null = null;
    let totalRoutes = 0;
    let sizeBytes = 0;
    let exists = false;
    const filePath = getLocalFilePath();

    if (overrideData) {
        updatedAt = overrideData.updatedAt || new Date().toISOString();
        totalRoutes = overrideData.totalRoutes || overrideData.routes?.length || 0;
        sizeBytes = Buffer.byteLength(JSON.stringify(overrideData), "utf-8");
        exists = totalRoutes > 0;
    } else if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
        try {
            const stat = fs.statSync(/*turbopackIgnore: true*/ filePath);
            const raw = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf-8");
            const data: BusCacheData = JSON.parse(raw);
            updatedAt = data.updatedAt || stat.mtime.toISOString();
            totalRoutes = data.totalRoutes || data.routes?.length || 0;
            sizeBytes = stat.size;
            exists = totalRoutes > 0;
        } catch (err) {
            console.warn("[BusService] Failed to read metadata from local file:", err);
        }
    }

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
        filePath,
        exists,
        updatedAt,
        totalRoutes,
        sizeBytes,
        minRefreshIntervalDays: MIN_REFRESH_INTERVAL_DAYS,
        canRefresh,
        nextRefreshAvailableAt,
    };
}

export async function saveCacheData(data: BusCacheData): Promise<void> {
    const jsonStr = JSON.stringify(data, null, 2);

    // 1. Save to Vercel Blob
    try {
        await saveToVercelBlob(data, "schedule.json");
    } catch (err) {
        console.warn("[BusService] Failed to save to Vercel Blob:", err);
    }

    // 2. Save locally to public/data/schedule.json
    try {
        const targetPath = getLocalFilePath();
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) {
            fs.mkdirSync(/*turbopackIgnore: true*/ dir, {recursive: true});
        }
        fs.writeFileSync(/*turbopackIgnore: true*/ targetPath, jsonStr, "utf-8");
    } catch (err) {
        console.warn(`[BusService] Failed to write local cache file (${getLocalFilePath()}):`, err);
    }

    // 3. Save to serverless container /tmp directory as well
    try {
        fs.writeFileSync(/*turbopackIgnore: true*/ "/tmp/schedule.json", jsonStr, "utf-8");
    } catch {
        // Ignore /tmp write errors in constrained envs
    }
}

export async function getOrFetchBusData(force = false): Promise<{
    data: BusCacheData | null;
    meta: CacheMetadata;
}> {
    const data = await loadCacheData();
    if (data && (!force || data.routes.length > 0)) {
        return {
            data,
            meta: getCacheMetadata(data),
        };
    }
    return refreshBusData(force);
}

export async function refreshBusData(force = false): Promise<{
    refreshed: boolean;
    message: string;
    data: BusCacheData | null;
    meta: CacheMetadata;
}> {
    const currentData = await loadCacheData();

    try {
        const scraped = await scrapeWonjuBusDataset();
        if (scraped && scraped.routes && scraped.routes.length > 0) {
            const freshData: BusCacheData = {
                updatedAt: new Date().toISOString(),
                sourceUrl: scraped.sourceUrl || "https://its.wonju.go.kr",
                totalRoutes: scraped.routes.length,
                routes: scraped.routes,
            };
            await saveCacheData(freshData);
            return {
                refreshed: true,
                message: `시간표 데이터 (${freshData.totalRoutes}개 노선)가 원주시 ITS에서 새로 수집되어 갱신되었습니다.`,
                data: freshData,
                meta: getCacheMetadata(freshData),
            };
        }
    } catch (scrapeErr) {
        console.warn("[BusService] Direct full scraping failed, attempting fast scrape fallback:", scrapeErr);
        try {
            const yonseiScraped = await scrapeWonjuItsYonsei();
            if (yonseiScraped && yonseiScraped.routes && yonseiScraped.routes.length > 0) {
                const freshData: BusCacheData = {
                    updatedAt: new Date().toISOString(),
                    sourceUrl: yonseiScraped.sourceUrl || "https://its.wonju.go.kr",
                    totalRoutes: yonseiScraped.routes.length,
                    routes: yonseiScraped.routes,
                };
                await saveCacheData(freshData);
                return {
                    refreshed: true,
                    message: "연세대 노선 시간표 데이터가 원주시 ITS에서 새로 수집되어 갱신되었습니다.",
                    data: freshData,
                    meta: getCacheMetadata(freshData),
                };
            }
        } catch (fastErr) {
            console.warn("[BusService] Fast scrape also failed:", fastErr);
        }
    }

    return {
        refreshed: false,
        message: "원주시 ITS 서버 응답 지연으로 기존 저장소의 시간표를 유지합니다.",
        data: currentData,
        meta: getCacheMetadata(currentData || undefined),
    };
}

export async function refreshCache(): Promise<BusCacheData> {
    const res = await refreshBusData(true);
    if (res.data) return res.data;
    const current = await loadCacheData();
    if (current) return current;
    throw new Error(res.message);
}
