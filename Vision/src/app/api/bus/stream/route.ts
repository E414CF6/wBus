import {API_CONFIG} from "@shared/config/env";
import {getCachedOrFetch} from "@shared/redis/client";
import {fetchBusLocations, type RawBusLocation} from "@shared/redis/publicApi";
import type {CacheMeta} from "@shared/redis/types";
import {parseRouteIdsParam} from "@shared/utils/routeIds";
import {NextResponse} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STREAM_INTERVAL_MS = Math.max(1000, API_CONFIG.LIVE.POLLING_INTERVAL_MS);
const ROUTE_TTL_SECONDS = Math.max(3, Math.ceil(STREAM_INTERVAL_MS / 1000));
const STREAM_SNAPSHOT_TTL_SECONDS = Math.max(1, Math.ceil(STREAM_INTERVAL_MS / 1000) - 1);
const LIVE_CACHE_OPTIONS = {
    staleWhileRevalidateSeconds: 0, staleIfErrorSeconds: 10,
};
const STREAM_CACHE_OPTIONS = {
    staleWhileRevalidateSeconds: 0, staleIfErrorSeconds: 5,
};
const VERCEL_MAX_DURATION_MS = 60000;
const STREAM_SHUTDOWN_BUFFER_MS = 5000;
const STREAM_LIFETIME_MS = Math.max(10000, VERCEL_MAX_DURATION_MS - STREAM_SHUTDOWN_BUFFER_MS);
const KEEP_ALIVE_INTERVAL_MS = 10000;
const CLIENT_RETRY_MS = 1000;
const SNAPSHOT_FORCE_INTERVAL_MS = Math.max(8000, STREAM_INTERVAL_MS * 2);
const SSE_HEADERS = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
};

const encoder = new TextEncoder();

function parseRouteIds(request: Request): string[] {
    const routeIdsParam = new URL(request.url).searchParams.get("routeIds");
    return parseRouteIdsParam(routeIdsParam, 20);
}

interface StreamSnapshotPartial {
    failed: number;
    total: number;
}

interface StreamSnapshotData {
    items: RawBusLocation[];
    partial?: StreamSnapshotPartial;
}

interface StreamSnapshotPayload {
    routeIds: string[];
    data: RawBusLocation[];
    timestamp: number;
    meta?: CacheMeta;
    partial?: StreamSnapshotPartial;
}

async function fetchStreamSnapshot(routeIds: string[]): Promise<StreamSnapshotData> {
    const results = await Promise.allSettled(routeIds.map(async (routeId) => {
        const entry = await getCachedOrFetch<RawBusLocation[]>(`bus:${routeId}`, () => fetchBusLocations(routeId), {
            ttlSeconds: ROUTE_TTL_SECONDS, ...LIVE_CACHE_OPTIONS,
        });
        return {routeId, entry};
    }));

    const items: RawBusLocation[] = [];
    let failedCount = 0;

    results.forEach((result, index) => {
        const routeId = routeIds[index];
        if (result.status === "fulfilled") {
            items.push(...result.value.entry.data);
        } else {
            failedCount += 1;
            console.warn(`[SSE /api/bus/stream] Failed to fetch route snapshot for ${routeId}`, result.reason);
        }
    });

    if (items.length === 0 && failedCount > 0) {
        throw new Error("[SSE /api/bus/stream] All route snapshots failed");
    }

    return {
        items, partial: failedCount > 0 ? {failed: failedCount, total: routeIds.length} : undefined,
    };
}

async function getStreamSnapshot(routeIds: string[]): Promise<StreamSnapshotPayload> {
    const batchKey = `bus:stream:${routeIds.join(",")}`;
    const snapshot = await getCachedOrFetch<StreamSnapshotData>(batchKey, () => fetchStreamSnapshot(routeIds), {
        ttlSeconds: STREAM_SNAPSHOT_TTL_SECONDS, ...STREAM_CACHE_OPTIONS,
    });
    const meta = snapshot.meta ? {
        ...snapshot.meta, degraded: snapshot.meta.degraded || Boolean(snapshot.data.partial),
    } : undefined;

    return {
        routeIds, data: snapshot.data.items, timestamp: snapshot.timestamp, meta, partial: snapshot.data.partial,
    };
}

function hashBusLocations(locations: RawBusLocation[]): string {
    if (locations.length === 0) return "empty";
    const sorted = [...locations].sort((a, b) => {
        const routeA = a.routeid ?? a.routenm;
        const routeB = b.routeid ?? b.routenm;
        if (routeA !== routeB) return routeA.localeCompare(routeB);
        return a.vehicleno.localeCompare(b.vehicleno);
    });

    let hash = 2166136261;
    const update = (value: string) => {
        for (let i = 0; i < value.length; i += 1) {
            hash ^= value.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
    };

    for (const bus of sorted) {
        update(bus.routeid ?? bus.routenm);
        update(bus.vehicleno);
        update(String(Math.round(bus.gpslati * 1e5)));
        update(String(Math.round(bus.gpslong * 1e5)));
        if (typeof bus.nodeord === "number") {
            update(String(bus.nodeord));
        }
    }

    return `${(hash >>> 0).toString(36)}:${sorted.length}`;
}

function buildSnapshotEventId(snapshot: StreamSnapshotPayload): string {
    const dataHash = hashBusLocations(snapshot.data);
    const partialHash = snapshot.partial ? `${snapshot.partial.failed}/${snapshot.partial.total}` : "none";
    const degradedHash = snapshot.meta?.degraded ? "degraded" : "fresh";
    return `${dataHash}:${partialHash}:${degradedHash}`;
}

function encodeSseEvent(event: string, payload: unknown, id?: number | string): Uint8Array {
    const idLine = id !== undefined ? `id: ${id}\n` : "";
    return encoder.encode(`${idLine}event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function encodeSseEventWithRetry(event: string, payload: unknown, retryMs: number, id?: number | string): Uint8Array {
    const idLine = id !== undefined ? `id: ${id}\n` : "";
    return encoder.encode(`retry: ${retryMs}\n${idLine}event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

const delay = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("aborted"));
    });
});

export async function GET(request: Request) {
    const routeIds = parseRouteIds(request);
    if (routeIds.length === 0) {
        return NextResponse.json({error: "Missing query parameter: routeIds"}, {status: 400});
    }

    const lastEventId = request.headers.get("last-event-id");
    const ac = new AbortController();
    const signal = ac.signal;
    request.signal.addEventListener("abort", () => ac.abort());

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            let eventSequence = 0;
            let lastSnapshotEventId: string | null = lastEventId;
            let lastSnapshotSentAt = 0;
            let streamLifetimeTimer: ReturnType<typeof setTimeout> | null = null;
            let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

            const closeStream = () => {
                ac.abort();
                if (streamLifetimeTimer) clearTimeout(streamLifetimeTimer);
                if (keepAliveTimer) clearInterval(keepAliveTimer);
                try {
                    controller.close();
                } catch {
                    // Ignore errors if already closed
                }
            };

            const send = (event: string, payload: unknown, id?: number | string) => {
                if (signal.aborted) return;
                try {
                    eventSequence += 1;
                    const encoded = eventSequence === 1 ? encodeSseEventWithRetry(event, payload, CLIENT_RETRY_MS, id) : encodeSseEvent(event, payload, id);
                    controller.enqueue(encoded);
                } catch (err) {
                    console.warn("[SSE /api/bus/stream] enqueue failed", err);
                    closeStream();
                }
            };

            streamLifetimeTimer = setTimeout(() => {
                send("handoff", {reason: "max_duration", reconnectAfterMs: CLIENT_RETRY_MS});
                closeStream();
            }, STREAM_LIFETIME_MS);

            keepAliveTimer = setInterval(() => {
                send("ping", {timestamp: Date.now()});
            }, KEEP_ALIVE_INTERVAL_MS);

            send("ready", {
                routeIds, intervalMs: STREAM_INTERVAL_MS, reconnectHintMs: STREAM_LIFETIME_MS, retryMs: CLIENT_RETRY_MS,
            });

            // Polling Loop
            try {
                while (!signal.aborted) {
                    try {
                        const snapshot = await getStreamSnapshot(routeIds);
                        const now = Date.now();
                        const nextEventId = buildSnapshotEventId(snapshot);
                        const isNewSnapshot = nextEventId !== lastSnapshotEventId;
                        const shouldForce = (now - lastSnapshotSentAt) >= SNAPSHOT_FORCE_INTERVAL_MS;

                        if (shouldForce || isNewSnapshot) {
                            lastSnapshotSentAt = now;
                            lastSnapshotEventId = nextEventId;
                            send("snapshot", {
                                routeIds: snapshot.routeIds,
                                data: snapshot.data,
                                timestamp: snapshot.timestamp,
                                meta: snapshot.meta,
                                partial: snapshot.partial,
                            }, nextEventId);
                        }
                    } catch (err) {
                        console.error("[SSE /api/bus/stream] snapshot fetch failed", err);
                        send("error", {message: "Failed to fetch live bus snapshot"});
                    }

                    await delay(STREAM_INTERVAL_MS, signal);
                }
            } catch (err) {
                // abort error expected when stream closes
                if (err instanceof Error && err.message !== "aborted") {
                    console.error("[SSE /api/bus/stream] loop error:", err);
                }
            } finally {
                closeStream();
            }
        }, cancel() {
            ac.abort();
        },
    });

    return new Response(stream, {headers: SSE_HEADERS});
}
