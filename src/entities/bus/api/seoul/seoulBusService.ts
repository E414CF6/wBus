import {fetchWithRetry} from "@shared/api/upstreamClient";
import {peekCached} from "@shared/cache";
import type {GeoPolyline} from "@entities/route/types";
import type {RawBusArrival, RawBusLocation, RawBusStop, RawCityRoute} from "../publicApi";
import {fetchTopisJson, SBUS_WEB_BASE, SEOUL_CITY_CODE, seoulWsBreaker, WS_BUS_API_BASE} from "./seoulClient";
import {extractSeoulWsItems, mapSeoulVehicleType, normalizeSeoulBusPosItem, type SeoulBusPosItem} from "./seoulParser";
import {getSeoulRouteBundle} from "./seoulRouteBundle";

export async function fetchSeoulWsBusPos(
    operation:
        | "getBusPosByRtid"
        | "getBusPosByRouteSt"
        | "getBusPosByVehId"
        | "getLowBusPosByRtid"
        | "getLowBusPosByRouteSt",
    params: Record<string, string>,
    serviceKey: string
): Promise<SeoulBusPosItem[]> {
    const url = new URL(`${WS_BUS_API_BASE}/buspos/${operation}`);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("resultType", "json");
    for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
    }

    const res = await fetchWithRetry(url.toString(), {
        headers: {
            Client: "wBus",
            Connection: "keep-alive",
        },
        timeoutMs: 4500,
        maxAttempts: 2,
        cache: "no-store",
        circuitBreaker: seoulWsBreaker,
    });

    if (!res.ok) {
        throw new Error(`[SeoulAPI] HTTP ${res.status} from ws.bus.go.kr/api/rest/buspos/${operation}`);
    }

    const text = await res.text();
    return extractSeoulWsItems<SeoulBusPosItem>(text);
}

export async function fetchSeoulBusLocations(
    routeId: string,
    getServiceKey: () => { key: string; index: number },
    onKeyRateLimited?: (index: number) => void
): Promise<RawBusLocation[]> {
    let cachedStops = peekCached<RawBusStop[]>(`bus-stops:${SEOUL_CITY_CODE}:${routeId}`, 86400)?.data;
    const cachedPoly = peekCached<GeoPolyline>(`polyline:${SEOUL_CITY_CODE}:${routeId}`, 86400)?.data;
    let resolvedRouteName = cachedPoly?.route_no || "";

    if (!resolvedRouteName) {
        const cityRoutes = peekCached<RawCityRoute[]>(`routes:${SEOUL_CITY_CODE}:all`, 604800)?.data;
        const matchedCityRoute = cityRoutes?.find((r) => String(r.routeid) === String(routeId));
        if (matchedCityRoute?.routeno) {
            resolvedRouteName = String(matchedCityRoute.routeno);
        }
    }

    const needsBundleWarm = (!cachedStops || !resolvedRouteName) && Boolean(routeId);
    const bundlePromise = needsBundleWarm
        ? getSeoulRouteBundle(routeId).catch(() => null)
        : Promise.resolve(null);

    let usedKeyIndex: number | null = null;
    const wsPositionPromise = (async (): Promise<SeoulBusPosItem[]> => {
        try {
            const {key, index} = getServiceKey();
            usedKeyIndex = index;
            return await fetchSeoulWsBusPos("getBusPosByRtid", {busRouteId: routeId}, key);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (/LIMITED|TRAFFIC|EXCEED|429|Code:\s*22/i.test(msg) && onKeyRateLimited && usedKeyIndex !== null) {
                try {
                    onKeyRateLimited(usedKeyIndex);
                } catch {
                    // Ignore
                }
            }

            const fallbackUrl = `${SBUS_WEB_BASE}/selectBusposByRtid.do?routeId=${encodeURIComponent(routeId)}&isLowBus=N`;
            try {
                const data = await fetchTopisJson<{
                    resultList?: SeoulBusPosItem[];
                    resultRouteBuspos?: SeoulBusPosItem[];
                }>(fallbackUrl, "selectBusposByRtid.do", {timeoutMs: 4500, cache: "no-store"});
                return data?.resultList ?? data?.resultRouteBuspos ?? [];
            } catch {
                throw err;
            }
        }
    })();

    const [bundle, rawItems] = await Promise.all([bundlePromise, wsPositionPromise]);

    if (bundle) {
        if (bundle.stops && bundle.stops.length > 0) {
            cachedStops = bundle.stops;
        }
        if (bundle.routeName && bundle.routeName !== routeId) {
            resolvedRouteName = bundle.routeName;
        }
    }

    const stopLookup = new Map<number | string, { nodeid: string; nodenm: string; routenm?: string }>();
    if (cachedStops && cachedStops.length > 0) {
        for (const s of cachedStops) {
            const entry = {
                nodeid: s.nodeid,
                nodenm: s.nodenm,
                routenm: resolvedRouteName,
            };
            if (s.nodeord !== undefined) {
                stopLookup.set(Number(s.nodeord), entry);
            }
            if (s.nodeid) {
                stopLookup.set(String(s.nodeid), entry);
            }
        }
    }

    const locations: RawBusLocation[] = [];
    for (const item of rawItems) {
        const normalized = normalizeSeoulBusPosItem(item, routeId, stopLookup, resolvedRouteName);
        if (normalized) {
            locations.push(normalized);
        }
    }

    return locations;
}

interface SbusArrivalItem {
    rtid?: number | string;
    ord?: number | string;
    rtnm?: string;
    rtnum?: string;
    rttp?: number | string;
    rttpnm?: string;
    stnid?: number | string;
    stnuid?: string;
    stnnm?: string;
    stat1?: number | string;
    statnm1?: string;
    sectord1?: number | string;
    avgs1?: string;
    avgs11?: number | string;
    wavgs11?: number | string;
    bustp1?: string | number;
    stat2?: number | string;
    statnm2?: string;
    sectord2?: number | string;
    avgs2?: string;
    avgs22?: number | string;
    wavgs22?: number | string;
    bustp2?: string | number;
}

function parseStationsAway(avgsText: string | undefined, stopOrd: number, busSectOrd: number): number {
    if (avgsText) {
        const match = avgsText.match(/\[(\d+)번째\s*전\]/);
        if (match) {
            return Number(match[1]);
        }
        if (avgsText.includes("곧") || avgsText.includes("도착")) {
            return 0;
        }
    }
    if (stopOrd > 0 && busSectOrd > 0 && stopOrd >= busSectOrd) {
        return stopOrd - busSectOrd;
    }
    return 1;
}

function parseArrivalSlot(
    params: {
        arrSecRaw?: number | string;
        statRaw?: number | string;
        statNm?: string;
        avgs?: string;
        sectOrd?: number | string;
        busTp?: string | number;
        defaultSec: number;
    },
    ctx: { routeid: string; routeno: string; nodenm: string; nodeid: string; stopOrd: number }
): RawBusArrival | null {
    const arrSec = Number(params.arrSecRaw ?? 0);
    const stat = Number(params.statRaw ?? 0);
    const isActive =
        arrSec > 0 ||
        (stat > 0 && Boolean(params.avgs) && !params.statNm?.includes("종료") && !params.statNm?.includes("대기"));
    if (!isActive) return null;

    return {
        routeid: ctx.routeid,
        routeno: ctx.routeno,
        arrtime: arrSec > 0 ? arrSec : params.defaultSec,
        arrprevstationcnt: parseStationsAway(params.avgs, ctx.stopOrd, Number(params.sectOrd ?? 0)),
        vehicletp: mapSeoulVehicleType(params.busTp),
        nodenm: ctx.nodenm,
        nodeid: ctx.nodeid,
    };
}

export async function fetchSeoulBusArrivals(nodeId: string): Promise<RawBusArrival[]> {
    const trimmed = nodeId.trim();
    const url = new URL(`${SBUS_WEB_BASE}/selectBusArrive.do`);
    if (trimmed.length <= 5) {
        url.searchParams.set("stnuid", trimmed);
    } else {
        url.searchParams.set("stopId", trimmed);
    }

    const data = await fetchTopisJson<{ resultList?: SbusArrivalItem[] }>(
        url.toString(),
        "selectBusArrive.do",
        {timeoutMs: 4500, cache: "no-store"}
    );
    const list = data?.resultList ?? [];

    const arrivals: RawBusArrival[] = [];

    for (const item of list) {
        const ctx = {
            routeid: String(item.rtid ?? "").trim(),
            routeno: String(item.rtnm || item.rtnum || "").trim(),
            nodenm: String(item.stnnm ?? "").trim(),
            nodeid: String(item.stnid || trimmed),
            stopOrd: Number(item.ord ?? 0),
        };

        const first = parseArrivalSlot(
            {
                arrSecRaw: item.avgs11 ?? item.wavgs11,
                statRaw: item.stat1,
                statNm: item.statnm1,
                avgs: item.avgs1,
                sectOrd: item.sectord1,
                busTp: item.bustp1,
                defaultSec: 30,
            },
            ctx
        );
        if (first) arrivals.push(first);

        const second = parseArrivalSlot(
            {
                arrSecRaw: item.avgs22 ?? item.wavgs22,
                statRaw: item.stat2,
                statNm: item.statnm2,
                avgs: item.avgs2,
                sectOrd: item.sectord2,
                busTp: item.bustp2,
                defaultSec: 60,
            },
            ctx
        );
        if (second) arrivals.push(second);
    }

    return arrivals.sort((a, b) => a.arrtime - b.arrtime);
}
