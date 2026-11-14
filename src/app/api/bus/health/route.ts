import {getPublicApiHealth, getSeoulApiHealth} from "@entities/bus";
import {getRouteWindowStats} from "@entities/bus/api/routeWindow";
import {getRouteSyncHealth} from "@entities/route/routeSyncService";
import {getCacheMetadata, getItsScraperHealth, loadFromLocalFile} from "@entities/schedule/server";
import {distributedCache, getL1CacheMetrics} from "@shared/cache";
import {artifactStore} from "@shared/cache/artifactStore";
import {type NextRequest, NextResponse} from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const isDeep = request.nextUrl.searchParams.get("deep") === "true";
        const publicApiMetrics = getPublicApiHealth();
        const seoulApiMetrics = getSeoulApiHealth();
        const routeSyncMetrics = getRouteSyncHealth();
        const wonjuItsMetrics = getItsScraperHealth();
        const routeWindowMetrics = getRouteWindowStats();
        const l1Cache = getL1CacheMetrics();
        const distributedStatus = distributedCache.getStatus();
        const artifactStatus = artifactStore.getStatus();

        let scheduleMetrics = null;
        try {
            const localData = loadFromLocalFile();
            const meta = getCacheMetadata(localData);
            scheduleMetrics = {
                totalRoutes: meta.totalRoutes,
                updatedAt: meta.updatedAt,
                exists: meta.exists,
                canRefresh: meta.canRefresh,
            };
        } catch {
            // Schedule metrics are non-blocking for healthcheck
        }

        const [redisPing, blobHealth, scheduleCronStatus, routesCronStatus] = isDeep
            ? await Promise.all([
                distributedCache.ping(1000).catch(() => ({
                    configured: distributedStatus.configured,
                    ok: false,
                    latencyMs: null
                })),
                artifactStore.checkHealth().catch(() => ({
                    configured: artifactStatus.configured,
                    ok: false,
                    latencyMs: null
                })),
                distributedCache.get<Record<string, unknown>>("cron:status:schedule", 500).catch(() => null),
                distributedCache.get<Record<string, unknown>>("cron:status:routes", 500).catch(() => null),
            ])
            : await Promise.all([
                Promise.resolve(null),
                Promise.resolve(null),
                distributedCache.get<Record<string, unknown>>("cron:status:schedule", 300).catch(() => null),
                distributedCache.get<Record<string, unknown>>("cron:status:routes", 300).catch(() => null),
            ]);

        const isPublicApiHealthy = publicApiMetrics.circuit.state !== "OPEN";
        const deepHealthy = !isDeep || ((!distributedStatus.configured || Boolean(redisPing?.ok)) && (!artifactStatus.configured || Boolean(blobHealth?.ok)));
        const healthy = isPublicApiHealthy && deepHealthy;
        const status = healthy ? 200 : 503;

        return NextResponse.json({
            success: healthy,
            status: publicApiMetrics.circuit.state,
            deep: isDeep,
            timestamp: new Date().toISOString(),
            metrics: {
                ...publicApiMetrics,
                seoulApi: seoulApiMetrics,
                routeSync: routeSyncMetrics,
                wonjuIts: wonjuItsMetrics,
                routeWindow: routeWindowMetrics,
                cache: l1Cache,
                storage: {
                    distributedCache: distributedStatus,
                    artifactStore: artifactStatus,
                    ...(isDeep ? {probes: {redis: redisPing, blob: blobHealth}} : {}),
                },
                schedule: scheduleMetrics,
                cron: {
                    schedule: scheduleCronStatus,
                    routes: routesCronStatus,
                },
            },
        }, {status});
    } catch (error) {
        return NextResponse.json({
            success: false, error: error instanceof Error ? error.message : "Unknown error",
        }, {status: 500});
    }
}
