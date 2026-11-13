import "server-only";

import fs from "fs";
import path from "path";
import {revalidateTag, unstable_cache} from "next/cache";

import type {CacheMetadata, RouteDataset} from "./types";
import {invalidateRouteWindowScheduleCache} from "@entities/bus/api/routeWindow";
import {RouteDatasetSchema} from "@shared/api/schemas";
import {artifactStore} from "@shared/cache/artifactStore";
import {LOCALE} from "@shared/config/locale";
import {scrapeWonjuBusDataset, scrapeWonjuItsYonsei} from "./itsScraper";

export const SCHEDULE_CACHE_TAG = "schedule";
export const MIN_REFRESH_INTERVAL_DAYS = 3;
export const MIN_REFRESH_INTERVAL_MS = MIN_REFRESH_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
export const FORCE_REFRESH_COOLDOWN_MS = 30 * 1000; // 30 seconds cooldown between non-admin force refreshes
const IN_MEMORY_TTL_MS = 30 * 1000; // 30 seconds

let inMemoryCache: {
    data: RouteDataset; meta: CacheMetadata; timestamp: number;
} | null = null;
let lastScrapeAttemptTime = 0;

function getLocalCachePath(): string {
    return path.join(process.cwd(), "public", "schedule.json");
}

function loadCandidateDatasets(): RouteDataset[] {
    const candidates = [
        "/tmp/schedule.json",
        getLocalCachePath(),
    ];

    const datasets: RouteDataset[] = [];
    for (const candidatePath of candidates) {
        if (fs.existsSync(/*turbopackIgnore: true*/ candidatePath)) {
            try {
                const raw = fs.readFileSync(/*turbopackIgnore: true*/ candidatePath, "utf-8");
                const parsed: RouteDataset = JSON.parse(raw);
                if (parsed && Array.isArray(parsed.routes) && parsed.routes.length > 0) {
                    datasets.push(parsed);
                }
            } catch {
                // Ignore parse errors
            }
        }
    }
    return datasets;
}

export function loadFromLocalFile(): RouteDataset | null {
    const candidates = loadCandidateDatasets();
    if (candidates.length === 0) return null;

    // Pick the dataset with the latest updatedAt to prefer newer runtime cache (/tmp) over bundled build files
    return candidates.reduce((latest, current) => {
        const latestTime = latest.updatedAt ? new Date(latest.updatedAt).getTime() : 0;
        const currentTime = current.updatedAt ? new Date(current.updatedAt).getTime() : 0;
        return currentTime > latestTime ? current : latest;
    });
}

export function mergeRouteDatasets(base: RouteDataset, partial: RouteDataset): RouteDataset {
    if (!base.routes || base.routes.length === 0) return partial;
    if (!partial.routes || partial.routes.length === 0) return base;

    const routeMap = new Map<string, (typeof base.routes)[0]>();
    for (const route of base.routes) {
        const key = `${route.routeNo}_${route.dayType || "매일"}`;
        routeMap.set(key, route);
    }
    for (const route of partial.routes) {
        const key = `${route.routeNo}_${route.dayType || "매일"}`;
        routeMap.set(key, route);
    }

    const mergedRoutes = Array.from(routeMap.values());
    return {
        updatedAt: partial.updatedAt || new Date().toISOString(),
        sourceUrl: partial.sourceUrl || base.sourceUrl,
        totalRoutes: mergedRoutes.length,
        routes: mergedRoutes,
    };
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

export async function saveCache(data: RouteDataset): Promise<void> {
    const meta = getCacheMetadata(data);

    // 1. Update in-memory cache and invalidate routeWindow schedule cache
    inMemoryCache = {
        data, meta, timestamp: Date.now(),
    };
    invalidateRouteWindowScheduleCache();

    // 2. Persist to /tmp, Vercel Blob (when configured), and public/schedule.json (local dev)
    await artifactStore.putJson("schedule.json", data, {pretty: true});
}

/**
 * Safely purge Next.js Data Cache Tag across edge and serverless nodes
 */
export function invalidateScheduleTag(): void {
    try {
        revalidateTag(SCHEDULE_CACHE_TAG, "max");
    } catch {
        try {
            (revalidateTag as unknown as (tag: string) => void)(SCHEDULE_CACHE_TAG);
        } catch {
            // Silently ignore if invoked outside Next.js request context (tests/scripts)
        }
    }
}

async function fetchScheduleDataset(): Promise<{ data: RouteDataset; meta: CacheMetadata }> {
    const local = loadFromLocalFile();
    let storedDataset: RouteDataset | null = null;
    try {
        const stored = await artifactStore.getJson<RouteDataset>("schedule.json");
        if (stored?.data) {
            const validated = RouteDatasetSchema.safeParse(stored.data);
            if (validated.success && validated.data.routes.length > 0) {
                storedDataset = validated.data as RouteDataset;
            }
        }
    } catch {
        // Ignore artifact read failures
    }

    const localTime = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0;
    const storedTime = storedDataset?.updatedAt ? new Date(storedDataset.updatedAt).getTime() : 0;
    const existing = storedDataset && storedTime >= localTime ? storedDataset : local;

    if (storedDataset && storedTime > localTime) {
        invalidateRouteWindowScheduleCache();
    }

    // On normal GET /api/schedule requests, return existing snapshot immediately rather than
    // running a slow synchronous full-scrape inside user traffic (/api/cron/refresh handles updates).
    if (existing && existing.routes.length > 0) {
        return {data: existing, meta: getCacheMetadata(existing)};
    }

    // Only attempt bootstrap scrape when no snapshot exists anywhere
    console.log("[ScheduleService] No existing timetable snapshot found; bootstrapping from Wonju ITS...");
    try {
        const freshData = await scrapeWonjuBusDataset();
        freshData.updatedAt = new Date().toISOString();
        await saveCache(freshData);
        return {data: freshData, meta: getCacheMetadata(freshData)};
    } catch (err) {
        console.warn("[ScheduleService] Full bootstrap scrape failed, attempting fast Yonsei scrape:", err);
        try {
            const yonseiData = await scrapeWonjuItsYonsei();
            await saveCache(yonseiData);
            return {data: yonseiData, meta: getCacheMetadata(yonseiData)};
        } catch (fallbackErr) {
            console.warn("[ScheduleService] Bootstrap scraping failed:", fallbackErr);
            const emptyDataset: RouteDataset = {
                updatedAt: new Date().toISOString(), sourceUrl: "", totalRoutes: 0, routes: [],
            };
            return {data: emptyDataset, meta: getCacheMetadata(emptyDataset)};
        }
    }
}

const getNextDataCachedSchedule = unstable_cache(
    fetchScheduleDataset,
    ["wbus-schedule-dataset-v1"],
    {
        tags: [SCHEDULE_CACHE_TAG], revalidate: MIN_REFRESH_INTERVAL_DAYS * 86400, // 3 days (259,200s) ISR in Data Cache
    }
);

export async function getOrFetchSchedule(force = false): Promise<{ data: RouteDataset; meta: CacheMetadata }> {
    if (force) {
        const refreshed = await refreshSchedule(true, true);
        return {data: refreshed.data, meta: refreshed.meta};
    }

    // 1. In-memory fast path (30s TTL)
    if (inMemoryCache && Date.now() - inMemoryCache.timestamp < IN_MEMORY_TTL_MS) {
        return {data: inMemoryCache.data, meta: inMemoryCache.meta};
    }

    // 2. Next.js Data Cache Tag backed fetcher (persists across Vercel serverless containers)
    try {
        const result = await getNextDataCachedSchedule();
        inMemoryCache = {data: result.data, meta: result.meta, timestamp: Date.now()};
        return result;
    } catch (err) {
        // Invariant fallback if invoked outside Next.js request context (tests/standalone scripts)
        if (String(err).includes("incrementalCache missing")) {
            const direct = await fetchScheduleDataset();
            inMemoryCache = {data: direct.data, meta: direct.meta, timestamp: Date.now()};
            return direct;
        }
        throw err;
    }
}

export async function refreshSchedule(force = true, isAuthorized = false): Promise<{
    refreshed: boolean; message: string; data: RouteDataset; meta: CacheMetadata;
}> {
    const current = await getOrFetchSchedule(false);
    const meta = current.meta;

    // Security & Rate-limiting: Only authorized callers (Vercel Cron / Admin) can force a fresh scrape.
    // Unauthorized callers are strictly constrained by the 3-day minimum interval to prevent DoS on Wonju ITS.
    const shouldScrape = isAuthorized
        ? (force || !meta.exists || meta.canRefresh)
        : (!meta.exists || meta.canRefresh);

    const now = Date.now();
    if (shouldScrape) {
        // Enforce cooldown between scrape attempts
        if (!isAuthorized && now - lastScrapeAttemptTime < FORCE_REFRESH_COOLDOWN_MS) {
            const waitSec = Math.ceil((FORCE_REFRESH_COOLDOWN_MS - (now - lastScrapeAttemptTime)) / 1000);
            return {
                refreshed: false,
                message: `방금 시간표를 갱신했습니다. ${waitSec}초 후 다시 시도해주세요.`,
                data: current.data,
                meta: current.meta,
            };
        }

        lastScrapeAttemptTime = now;
        console.log("[ScheduleService] Triggering Wonju ITS scraper for timetable update...");
        try {
            const newData = await scrapeWonjuBusDataset();
            newData.updatedAt = new Date().toISOString();
            await saveCache(newData);
            const updatedMeta = getCacheMetadata(newData);

            // Invalidate Next.js Data Cache Tag
            invalidateScheduleTag();

            return {
                refreshed: true,
                message: `최신 시간표 (${newData.totalRoutes}개 노선)를 성공적으로 수집하여 갱신했습니다.`,
                data: newData,
                meta: updatedMeta,
            };
        } catch (err) {
            console.warn("[ScheduleService] Full scraper failed. Falling back to existing cache:", err instanceof Error ? err.message : err);
            return {
                refreshed: false,
                message: "서버 응답 지연으로 기존 저장된 최신 시간표를 유지합니다.",
                data: current.data,
                meta: current.meta,
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
