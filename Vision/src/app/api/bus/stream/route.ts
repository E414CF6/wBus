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
const VERCEL_MAX_DURATION_MS = 60000;
const STREAM_SHUTDOWN_BUFFER_MS = 5000;
const STREAM_LIFETIME_MS = Math.max(10000, VERCEL_MAX_DURATION_MS - STREAM_SHUTDOWN_BUFFER_MS);
const KEEP_ALIVE_INTERVAL_MS = 10000;
const CLIENT_RETRY_MS = 1000;
const SNAPSHOT_FORCE_INTERVAL_MS = Math.max(8000, STREAM_INTERVAL_MS * 2);
const SSE_HEADERS = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
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
        const entry = await getCachedOrFetch<RawBusLocation[]>(`bus:${routeId}`, () => fetchBusLocations(routeId), ROUTE_TTL_SECONDS);
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
    const snapshot = await getCachedOrFetch<StreamSnapshotData>(batchKey, () => fetchStreamSnapshot(routeIds), STREAM_SNAPSHOT_TTL_SECONDS);
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

function encodeSseEvent(event: string, payload: unknown): Uint8Array {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function encodeSseEventWithRetry(event: string, payload: unknown, retryMs: number): Uint8Array {
    return encoder.encode(`retry: ${retryMs}\nevent: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

interface StreamClient {
    send: (event: string, payload: unknown) => void;
    close: () => void;
}

interface StreamGroup {
    key: string;
    routeIds: string[];
    clients: Set<StreamClient>;
    poller: ReturnType<typeof setInterval> | null;
    keepAliveTimer: ReturnType<typeof setInterval> | null;
    inFlight: boolean;
    lastSnapshot: StreamSnapshotPayload | null;
    lastSnapshotTimestamp: number | null;
    lastSnapshotHash: string | null;
    lastSnapshotSentAt: number;
}

const streamGroups = new Map<string, StreamGroup>();

function getStreamGroup(routeIds: string[]): StreamGroup {
    const key = routeIds.join(",");
    const existing = streamGroups.get(key);
    if (existing) return existing;

    const group: StreamGroup = {
        key,
        routeIds,
        clients: new Set(),
        poller: null,
        keepAliveTimer: null,
        inFlight: false,
        lastSnapshot: null,
        lastSnapshotTimestamp: null,
        lastSnapshotHash: null,
        lastSnapshotSentAt: 0,
    };
    streamGroups.set(key, group);
    return group;
}

function broadcast(group: StreamGroup, event: string, payload: unknown): void {
    for (const client of Array.from(group.clients)) {
        client.send(event, payload);
    }
}

function stopStreamGroup(group: StreamGroup): void {
    if (group.keepAliveTimer) {
        clearInterval(group.keepAliveTimer);
        group.keepAliveTimer = null;
    }
    if (group.poller) {
        clearInterval(group.poller);
        group.poller = null;
    }
    streamGroups.delete(group.key);
}

async function pollStreamGroup(group: StreamGroup): Promise<void> {
    if (group.inFlight || group.clients.size === 0) return;
    group.inFlight = true;
    try {
        const snapshot = await getStreamSnapshot(group.routeIds);
        const now = Date.now();
        const isNewSnapshot = snapshot.timestamp !== group.lastSnapshotTimestamp;
        const shouldForce = (now - group.lastSnapshotSentAt) >= SNAPSHOT_FORCE_INTERVAL_MS;

        group.lastSnapshot = snapshot;
        group.lastSnapshotTimestamp = snapshot.timestamp;

        let shouldSend = shouldForce;

        if (isNewSnapshot) {
            const nextHash = hashBusLocations(snapshot.data);
            if (nextHash !== group.lastSnapshotHash || shouldForce) {
                group.lastSnapshotHash = nextHash;
                shouldSend = true;
            }
        } else if (shouldForce && group.lastSnapshotHash === null) {
            group.lastSnapshotHash = hashBusLocations(snapshot.data);
        }

        if (shouldSend) {
            group.lastSnapshotSentAt = now;
            broadcast(group, "snapshot", {
                routeIds: snapshot.routeIds,
                data: snapshot.data,
                timestamp: snapshot.timestamp,
                meta: snapshot.meta,
                partial: snapshot.partial,
            });
        }
    } catch (err) {
        console.error("[SSE /api/bus/stream] snapshot fetch failed", err);
        broadcast(group, "error", {message: "Failed to fetch live bus snapshot"});
    } finally {
        group.inFlight = false;
    }
}

function startStreamGroup(group: StreamGroup): void {
    if (group.poller || group.clients.size === 0) return;
    group.keepAliveTimer = setInterval(() => {
        broadcast(group, "ping", {timestamp: Date.now()});
    }, KEEP_ALIVE_INTERVAL_MS);
    group.poller = setInterval(() => {
        void pollStreamGroup(group);
    }, STREAM_INTERVAL_MS);
    void pollStreamGroup(group);
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
            let streamLifetimeTimer: ReturnType<typeof setTimeout> | null = null;
            const group = getStreamGroup(routeIds);
            let client: StreamClient | null = null;

            const handleAbort = () => close();

            const clearTimers = () => {
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
                if (client) {
                    group.clients.delete(client);
                    if (group.clients.size === 0) {
                        stopStreamGroup(group);
                    }
                }
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

            client = {send, close};
            group.clients.add(client);
            startStreamGroup(group);

            send("ready", {
                routeIds, intervalMs: STREAM_INTERVAL_MS, reconnectHintMs: STREAM_LIFETIME_MS, retryMs: CLIENT_RETRY_MS,
            });

            if (group.lastSnapshot) {
                send("snapshot", {
                    routeIds: group.lastSnapshot.routeIds,
                    data: group.lastSnapshot.data,
                    timestamp: group.lastSnapshot.timestamp,
                    meta: group.lastSnapshot.meta,
                    partial: group.lastSnapshot.partial,
                });
            }

            streamLifetimeTimer = setTimeout(() => {
                send("handoff", {
                    reason: "max_duration", reconnectAfterMs: CLIENT_RETRY_MS,
                });
                close();
            }, STREAM_LIFETIME_MS);
        },
    });

    return new Response(stream, {headers: SSE_HEADERS});
}
