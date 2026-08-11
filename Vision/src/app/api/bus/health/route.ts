import {getPublicApiHealth} from "@shared/redis/publicApi";
import {NextResponse} from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const health = getPublicApiHealth();
        const status = health.circuit.state === "OPEN" ? 503 : 200;

        return NextResponse.json({
            success: health.circuit.state !== "OPEN",
            status: health.circuit.state,
            timestamp: new Date().toISOString(),
            metrics: health,
        }, {status});
    } catch (error) {
        return NextResponse.json({
            success: false, error: error instanceof Error ? error.message : "Unknown error",
        }, {status: 500});
    }
}
