import { NextResponse } from "next/server";
import { getOrFetchSchedule } from "@/lib/scheduleService";

export async function GET() {
  const startTime = Date.now();
  try {
    const { data, meta } = await getOrFetchSchedule(false);
    return NextResponse.json(
      {
        success: true,
        data,
        meta,
        elapsedMs: Date.now() - startTime,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("API /api/schedule error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
