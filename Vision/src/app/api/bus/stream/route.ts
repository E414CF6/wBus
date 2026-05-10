import {API_CONFIG} from "@shared/config/env";
import {getCachedOrFetch} from "@shared/redis/client";
import {fetchBusLocations, type RawBusLocation} from "@shared/redis/publicApi";
import {NextResponse} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STREAM_INTERVAL_MS = Math.max(1000, API_CONFIG.LIVE.POLLING_INTERVAL_MS);
const ROUTE_TTL_SECONDS = 3;
const STREAM_SNAPSHOT_TTL_SECONDS = 2;
const SSE_HEADERS = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
};

const encoder = new TextEncoder();

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRouteIds(request: Request): string[] {
    const routeIdsParam = new URL(request.url).searchParams.get("routeIds") ?? "";
    const routeIds = routeIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

    return Array.from(new Set(routeIds)).slice(0, 20);
}

async function getStreamSnapshot(routeIds: string[]) {
    const batchKey = `bus:stream:${routeIds.join(",")}`;
    return getCachedOrFetch<RawBusLocation[]>(batchKey, async () => {
        const entries = await Promise.all(routeIds.map((routeId) => getCachedOrFetch<RawBusLocation[]>(`bus:${routeId}`, () => fetchBusLocations(routeId), ROUTE_TTL_SECONDS,)));
        return entries.flatMap((entry) => entry.data);
    }, STREAM_SNAPSHOT_TTL_SECONDS,);
}

function encodeSseEvent(event: string, payload: unknown): Uint8Array {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export async function GET(request: Request) {
    const routeIds = parseRouteIds(request);
    if (routeIds.length === 0) {
        return NextResponse.json({error: "Missing query parameter: routeIds"}, {status: 400});
    }

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            let closed = false;

            const close = () => {
                if (closed) return;
                closed = true;
                try {
                    controller.close();
                } catch (err) {
                    console.warn("[SSE /api/bus/stream] controller.close failed", err);
                }
            };

            const send = (event: string, payload: unknown) => {
                if (closed) return;
                try {
                    controller.enqueue(encodeSseEvent(event, payload));
                } catch (err) {
                    console.warn("[SSE /api/bus/stream] enqueue failed", err);
                    close();
                }
            };

            const handleAbort = () => close();
            request.signal.addEventListener("abort", handleAbort);

            const loop = async () => {
                send("ready", {routeIds, intervalMs: STREAM_INTERVAL_MS});
                while (!closed && !request.signal.aborted) {
                    try {
                        const snapshot = await getStreamSnapshot(routeIds);
                        send("snapshot", {
                            routeIds, data: snapshot.data, timestamp: snapshot.timestamp, meta: snapshot.meta,
                        });
                    } catch (err) {
                        console.error("[SSE /api/bus/stream] snapshot fetch failed", err);
                        send("error", {message: "Failed to fetch live bus snapshot"});
                    }
                    await sleep(STREAM_INTERVAL_MS);
                }
                request.signal.removeEventListener("abort", handleAbort);
                close();
            };

            void loop();
        },
    });

    return new Response(stream, {headers: SSE_HEADERS});
}
