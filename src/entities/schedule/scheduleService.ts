import fs from "fs";
import path from "path";
import {loadFromVercelBlob, saveToVercelBlob} from "@shared/lib/blobService";
import type {CacheMetadata, RouteDataset} from "@shared/types/bus";
import {LOCALE} from "@shared/config/locale";
import {scrapeWonjuBusDataset, scrapeWonjuItsYonsei} from "./itsScraper";

export const MIN_REFRESH_INTERVAL_DAYS = 1;
export const MIN_REFRESH_INTERVAL_MS = MIN_REFRESH_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
const IN_MEMORY_TTL_MS = 30 * 1000; // 30 seconds

let inMemoryCache: {
    data: RouteDataset;
    meta: CacheMetadata;
    timestamp: number;
} | null = null;

function getLocalCachePath(): string {
    return path.join(process.cwd(), "public", "data", "schedule.json");
}

function loadFromLocalFile(): RouteDataset | null {
    // 1. Check public/data directory
    const publicDataPath = getLocalCachePath();
    if (fs.existsSync(/*turbopackIgnore: true*/ publicDataPath)) {
        try {
            const raw = fs.readFileSync(/*turbopackIgnore: true*/ publicDataPath, "utf-8");
            const parsed: RouteDataset = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.routes) && parsed.routes.length > 0) {
                return parsed;
            }
        } catch {
            // Ignore
        }
    }

    // 2. Check /tmp directory for serverless container caching
    for (const tmpPath of ["/tmp/schedule.json", "/tmp/scheduleCache.json", "/tmp/cache.json"]) {
        if (fs.existsSync(/*turbopackIgnore: true*/ tmpPath)) {
            try {
                const raw = fs.readFileSync(/*turbopackIgnore: true*/ tmpPath, "utf-8");
                const parsed: RouteDataset = JSON.parse(raw);
                if (parsed && Array.isArray(parsed.routes) && parsed.routes.length > 0) {
                    return parsed;
                }
            } catch {
                // Ignore
            }
        }
    }

    return null;
}

export function getCacheMetadata(data?: RouteDataset | null): CacheMetadata {
    const updatedAt = data?.updatedAt || new Date().toISOString();
    const totalRoutes = data?.routes ? data.routes.length : 0;

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
        exists: totalRoutes > 0,
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

    // 1. Update in-memory cache
    inMemoryCache = {
        data,
        meta,
        timestamp: Date.now(),
    };

    // 2. Save to Vercel Blob
    try {
        await saveToVercelBlob(data, "schedule.json");
    } catch (err) {
        console.warn("[ScheduleService] Vercel Blob save skipped:", err);
    }

    // 3. Save to public/data/schedule.json
    try {
        const p = getLocalCachePath();
        const dir = path.dirname(p);
        if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) {
            fs.mkdirSync(/*turbopackIgnore: true*/ dir, {recursive: true});
        }
        fs.writeFileSync(/*turbopackIgnore: true*/ p, jsonStr, "utf-8");
    } catch {
        // Ignore in read-only environment
    }

    // 4. Save to /tmp for serverless container caching
    try {
        fs.writeFileSync(/*turbopackIgnore: true*/ "/tmp/schedule.json", jsonStr, "utf-8");
    } catch {
        // Ignore
    }
}

export async function getOrFetchSchedule(
    force = false
): Promise<{ data: RouteDataset; meta: CacheMetadata }> {
    // 1. Check in-memory cache (with 30s TTL)
    if (!force && inMemoryCache && Date.now() - inMemoryCache.timestamp < IN_MEMORY_TTL_MS) {
        return {
            data: inMemoryCache.data,
            meta: inMemoryCache.meta,
        };
    }

    if (!force) {
        // 2. Check Vercel Blob (OIDC / Token)
        try {
            const blobData = await loadFromVercelBlob<RouteDataset>();
            if (blobData) {
                const meta = getCacheMetadata(blobData);
                inMemoryCache = {data: blobData, meta, timestamp: Date.now()};
                return {data: blobData, meta};
            }
        } catch (err) {
            console.warn("[ScheduleService] Vercel Blob load fallback:", err);
        }

        // 3. Check local public/data or /tmp
        const fromFile = loadFromLocalFile();
        if (fromFile) {
            const meta = getCacheMetadata(fromFile);
            inMemoryCache = {data: fromFile, meta, timestamp: Date.now()};
            return {data: fromFile, meta};
        }
    }

    // 4. If no cache found anywhere, scrape full dataset from Wonju ITS
    console.log(
        "[ScheduleService] No cache found. Fetching initial full timetable from Wonju ITS..."
    );
    try {
        const freshData = await scrapeWonjuBusDataset();
        await saveCache(freshData);
        const meta = getCacheMetadata(freshData);
        return {data: freshData, meta};
    } catch (err) {
        console.warn("[ScheduleService] Full scrape failed, attempting fast scrape:", err);
        try {
            const yonseiData = await scrapeWonjuItsYonsei();
            await saveCache(yonseiData);
            const meta = getCacheMetadata(yonseiData);
            return {data: yonseiData, meta};
        } catch (fallbackErr) {
            console.error("[ScheduleService] Initial scrape failed completely:", fallbackErr);
            const emptyDataset: RouteDataset = {
                updatedAt: new Date().toISOString(),
                sourceUrl: "",
                totalRoutes: 0,
                routes: [],
            };
            return {data: emptyDataset, meta: getCacheMetadata(emptyDataset)};
        }
    }
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
        console.log(
            "[ScheduleService] Triggering Wonju ITS scraper for full timetable update..."
        );
        try {
            const newData = await scrapeWonjuBusDataset();
            newData.updatedAt = new Date().toISOString();
            await saveCache(newData);
            const updatedMeta = getCacheMetadata(newData);
            return {
                refreshed: true,
                message: `최신 시간표 (${newData.totalRoutes}개 노선)를 원주시 ITS에서 성공적으로 수집하여 갱신했습니다.`,
                data: newData,
                meta: updatedMeta,
            };
        } catch (err) {
            console.warn(
                "[ScheduleService] Full scraper failed. Falling back to existing cache:",
                err instanceof Error ? err.message : err
            );
            return {
                refreshed: false,
                message: "서버 응답 지연으로 기존 저장된 최신 시간표를 유지합니다.",
                data: current.data,
                meta: current.meta,
            };
        }
    }

    const nextAvailableStr = meta.nextRefreshAvailableAt
        ? new Date(meta.nextRefreshAvailableAt).toLocaleString(LOCALE, {
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
