import {NextResponse} from "next/server";
import {getOrFetchBusData} from "@shared/lib/busService";

export async function GET() {
    const startTime = Date.now();
    try {
        const {data, meta} = await getOrFetchBusData(false);
        return NextResponse.json({
            success: true,
            data,
            meta,
            elapsedMs: Date.now() - startTime,
        });
    } catch (error) {
        console.error("API /api/bus error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            {status: 500}
        );
    }
}
