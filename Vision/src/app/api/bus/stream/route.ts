import {API_CONFIG} from "@shared/config/env";
import {getCachedOrFetch} from "@shared/redis/client";
import {fetchBusLocations, type RawBusLocation} from "@shared/redis/publicApi";
import {parseRouteIdsParam} from "@shared/utils/routeIds";
import {NextResponse} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STREAM_INTERVAL_MS = Math.max(1000, API_CONFIG.LIVE.POLLING_INTERVAL_MS);
const ROUTE_TTL_SECONDS = 3;
const STREAM_SNAPSHOT_TTL_SECONDS = 2;
const VERCEL_MAX_DURATION_MS = 60000;
const STREAM_SHUTDOWN_BUFFER_MS = 5000;
const STREAM_LIFETIME_MS = Math.max(10000, VERCEL_MAX_DURATION_MS - STREAM_SHUTDOWN_BUFFER_MS);
const KEEP_ALIVE_INTERVAL_MS = 10000;
const CLIENT_RETRY_MS = 1000;
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
    const routeIdsParam = new URL(request.url).searchParams.get("routeIds");
    return parseRouteIdsParam(routeIdsParam, 20);
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

function encodeSseEventWithRetry(event: string, payload: unknown, retryMs: number): Uint8Array {
    return encoder.encode(`retry: ${retryMs}\nevent: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export async function GET(request: Request) {
    const routeIds = parseRouteIds(request);
    if (routeIds.length === 0) {
        return NextResponse.json({error: "Missing query parameter: routeIds"}, {status: 400});
    }

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            let closed = false;
            let eventSequence = 0;
            let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
            let streamLifetimeTimer: ReturnType<typeof setTimeout> | null = null;

            const handleAbort = () => close();

            const clearTimers = () => {
                if (keepAliveTimer) {
                    clearInterval(keepAliveTimer);
                    keepAliveTimer = null;
                }
                if (streamLifetimeTimer) {
                    clearTimeout(streamLifetimeTimer);
                    streamLifetimeTimer = null;
                }
            };

            const close = () => {
                if (closed) return;
                closed = true;
                clearTimers();
                request.signal.removeEventListener("abort", handleAbort);
                try {
                    controller.close();
                } catch (err) {
                    console.warn("[SSE /api/bus/stream] controller.close failed", err);
                }
            };

            const send = (event: string, payload: unknown) => {
                if (closed) return;
                try {
                    eventSequence += 1;
                    const encoded = eventSequence === 1 ? encodeSseEventWithRetry(event, payload, CLIENT_RETRY_MS) : encodeSseEvent(event, payload);
                    controller.enqueue(encoded);
                } catch (err) {
                    console.warn("[SSE /api/bus/stream] enqueue failed", err);
                    close();
                }
            };

            request.signal.addEventListener("abort", handleAbort);

            const loop = async () => {
                send("ready", {
                    routeIds,
                    intervalMs: STREAM_INTERVAL_MS,
                    reconnectHintMs: STREAM_LIFETIME_MS,
                    retryMs: CLIENT_RETRY_MS,
                });

                keepAliveTimer = setInterval(() => {
                    send("ping", {timestamp: Date.now()});
                }, KEEP_ALIVE_INTERVAL_MS);

                streamLifetimeTimer = setTimeout(() => {
                    send("handoff", {
                        reason: "max_duration", reconnectAfterMs: CLIENT_RETRY_MS,
                    });
                    close();
                }, STREAM_LIFETIME_MS);

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
                close();
            };

            void loop();
        },
    });

    return new Response(stream, {headers: SSE_HEADERS});
}
