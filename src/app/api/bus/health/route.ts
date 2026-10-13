import {getPublicApiHealth} from "@entities/bus";
import {getCacheMetadata, loadFromLocalFile} from "@entities/schedule/server";
import {NextResponse} from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const publicApiMetrics = getPublicApiHealth();

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

        const isPublicApiHealthy = publicApiMetrics.circuit.state !== "OPEN";
        const status = isPublicApiHealthy ? 200 : 503;

        return NextResponse.json({
            success: isPublicApiHealthy,
            status: publicApiMetrics.circuit.state,
            timestamp: new Date().toISOString(),
            metrics: {
                ...publicApiMetrics,
                schedule: scheduleMetrics,
            },
        }, {status});
    } catch (error) {
        return NextResponse.json({
            success: false, error: error instanceof Error ? error.message : "Unknown error",
        }, {status: 500});
    }
}
