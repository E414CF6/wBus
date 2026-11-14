import "server-only";

import fs from "fs";
import path from "path";
import {revalidateTag, unstable_cache} from "next/cache";

import type {CacheMetadata, RouteDataset} from "./types";
import {invalidateRouteWindowScheduleCache} from "@entities/bus/api/routeWindow";
import {RouteDatasetSchema} from "@shared/api/schemas";
import {artifactStore} from "@shared/cache/artifactStore";
import {distributedCache} from "@shared/cache/distributedCache";
import {LOCALE} from "@shared/config/locale";
import {type ScrapeDatasetResult, scrapeWonjuBusDataset, scrapeWonjuItsYonsei} from "./itsScraper";

export const SCHEDULE_CACHE_TAG = "schedule";
const SCHEDULE_REDIS_KEY = "schedule:wonju";
const SCHEDULE_CRON_STATUS_KEY = "cron:status:schedule";
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

function loadBundledLocalFile(): RouteDataset | null {
    const bundledPath = getLocalCachePath();
    if (!fs.existsSync(/*turbopackIgnore: true*/ bundledPath)) return null;
    try {
        const raw = fs.readFileSync(/*turbopackIgnore: true*/ bundledPath, "utf-8");
        const parsed: RouteDataset = JSON.parse(raw);
        return parsed && Array.isArray(parsed.routes) && parsed.routes.length > 0 ? parsed : null;
    } catch {
        return null;
    }
}

export interface ReconcileResult {
    accepted: boolean;
    reason?: string;
    dataset?: RouteDataset;
    preservedRoutes: number;
}

/**
 * Guards schedule refreshes against empty scrapes or massive route drops,
 * and preserves prior non-empty timetables for individual routes whose detail fetch failed.
 */
export function reconcileScrapedDataset(
    scraped: ScrapeDatasetResult,
    previous?: RouteDataset | null
): ReconcileResult {
    if (!scraped || !Array.isArray(scraped.routes) || scraped.routes.length === 0) {
        return {accepted: false, reason: "empty-dataset", preservedRoutes: 0};
    }

    const prevRoutes = previous?.routes || [];
    if (prevRoutes.length > 0 && scraped.routes.length < Math.floor(prevRoutes.length * 0.7)) {
        return {
            accepted: false,
            reason: `route-count-drop:${scraped.routes.length}/${prevRoutes.length}`,
            preservedRoutes: 0,
        };
    }

    const prevMap = new Map<string, (typeof prevRoutes)[0]>();
    for (const r of prevRoutes) {
        prevMap.set(`${r.routeNo}_${r.dayType || "매일"}`, r);
    }

    let preservedRoutes = 0;
    const failedSet = new Set(scraped.failedRouteNos || []);
    const reconciledRoutes = scraped.routes.map((route) => {
        if (route.timetable.length === 0) {
            const prev = prevMap.get(`${route.routeNo}_${route.dayType || "매일"}`);
            if (prev && prev.timetable.length > 0 && (failedSet.size === 0 || failedSet.has(route.rawNo))) {
                preservedRoutes += 1;
                return {...route, timetable: prev.timetable};
            }
        }
        return route;
    });

    const candidate: RouteDataset = {
        updatedAt: scraped.updatedAt || new Date().toISOString(),
        sourceUrl: scraped.sourceUrl || previous?.sourceUrl || "",
        totalRoutes: reconciledRoutes.length,
        routes: reconciledRoutes,
    };

    const validated = RouteDatasetSchema.safeParse(candidate);
    if (!validated.success || validated.data.routes.length === 0) {
        return {accepted: false, reason: "schema-validation-failed", preservedRoutes: 0};
    }

    return {
        accepted: true,
        dataset: validated.data as RouteDataset,
        preservedRoutes,
    };
}

export async function saveCache(data: RouteDataset): Promise<void> {
    const meta = getCacheMetadata(data);

    // 1. Update in-memory cache and invalidate routeWindow schedule cache
    inMemoryCache = {
        data, meta, timestamp: Date.now(),
    };
    invalidateRouteWindowScheduleCache();

    // 2. Persist to /tmp, Vercel Blob (minified), and L2 Redis
    await Promise.all([
        artifactStore.putJson("schedule.json", data, {pretty: false}),
        distributedCache.set(SCHEDULE_REDIS_KEY, data, 24 * 60 * 60).catch(() => false),
    ]);
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
    const local = loadBundledLocalFile();
    const [redisResult, artifactResult] = await Promise.all([
        distributedCache.get<RouteDataset>(SCHEDULE_REDIS_KEY, 400).catch(() => null),
        artifactStore.getJson<RouteDataset>("schedule.json").catch(() => null),
    ]);

    const candidates: RouteDataset[] = [];
    if (local) candidates.push(local);

    for (const raw of [redisResult, artifactResult?.data]) {
        if (!raw) continue;
        const validated = RouteDatasetSchema.safeParse(raw);
        if (validated.success && validated.data.routes.length > 0) {
            candidates.push(validated.data as RouteDataset);
        }
    }

    const existing = candidates.length > 0
        ? candidates.reduce((latest, current) => {
            const latestTime = latest.updatedAt ? new Date(latest.updatedAt).getTime() : 0;
            const currentTime = current.updatedAt ? new Date(current.updatedAt).getTime() : 0;
            return currentTime > latestTime ? current : latest;
        })
        : null;

    if (existing && existing.routes.length > 0) {
        const localTime = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0;
        const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        if (existingTime > localTime) {
            invalidateRouteWindowScheduleCache();
        }
        // Seed Redis if missing or stale compared to Blob/bundled snapshot
        const redisTime = redisResult?.updatedAt ? new Date(redisResult.updatedAt).getTime() : 0;
        if (existingTime > redisTime) {
            void distributedCache.set(SCHEDULE_REDIS_KEY, existing, 24 * 60 * 60).catch(() => false);
        }
        return {data: existing, meta: getCacheMetadata(existing)};
    }

    // Only attempt bootstrap scrape when no snapshot exists anywhere
    console.log("[ScheduleService] No existing timetable snapshot found; bootstrapping from Wonju ITS...");
    try {
        const freshData = await scrapeWonjuBusDataset();
        freshData.updatedAt = new Date().toISOString();
        const reconciled = reconcileScrapedDataset(freshData, null);
        const datasetToSave = reconciled.accepted && reconciled.dataset ? reconciled.dataset : freshData;
        await saveCache(datasetToSave);
        return {data: datasetToSave, meta: getCacheMetadata(datasetToSave)};
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
            const scraped = await scrapeWonjuBusDataset();
            scraped.updatedAt = new Date().toISOString();
            const reconciled = reconcileScrapedDataset(scraped, current.data);

            if (!reconciled.accepted || !reconciled.dataset) {
                console.warn(`[ScheduleService] Aborting schedule overwrite (${reconciled.reason}); keeping previous snapshot.`);
                await distributedCache.set(SCHEDULE_CRON_STATUS_KEY, {
                    ok: false,
                    reason: reconciled.reason || "reconcile-rejected",
                    checkedAt: new Date().toISOString(),
                    previousRoutes: current.data.totalRoutes,
                }, 7 * 24 * 60 * 60).catch(() => false);

                return {
                    refreshed: false,
                    message: `수집 데이터 검증 실패(${reconciled.reason})로 기존 시간표를 유지합니다.`,
                    data: current.data,
                    meta: current.meta,
                };
            }

            const cleanData = reconciled.dataset;
            await saveCache(cleanData);
            const updatedMeta = getCacheMetadata(cleanData);

            // Invalidate Next.js Data Cache Tag
            invalidateScheduleTag();

            await distributedCache.set(SCHEDULE_CRON_STATUS_KEY, {
                ok: true,
                updatedAt: cleanData.updatedAt,
                totalRoutes: cleanData.totalRoutes,
                preservedRoutes: reconciled.preservedRoutes,
                failedCount: scraped.failedRouteNos?.length ?? 0,
            }, 7 * 24 * 60 * 60).catch(() => false);

            return {
                refreshed: true,
                message: `최신 시간표 (${cleanData.totalRoutes}개 노선)를 성공적으로 수집하여 갱신했습니다.`,
                data: cleanData,
                meta: updatedMeta,
            };
        } catch (err) {
            console.warn("[ScheduleService] Full scraper failed. Falling back to existing cache:", err instanceof Error ? err.message : err);
            await distributedCache.set(SCHEDULE_CRON_STATUS_KEY, {
                ok: false,
                reason: err instanceof Error ? err.message : String(err),
                checkedAt: new Date().toISOString(),
            }, 7 * 24 * 60 * 60).catch(() => false);
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
