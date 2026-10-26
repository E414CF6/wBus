import {getCachedOrFetch, peekCached, setCached} from "@shared/cache";
import {calculatePolylineMeters} from "@entities/route/polylineChunker";
import type {GeoPolyline} from "@entities/route/types";
import type {RawBusArrival, RawBusLocation, RawBusStop, RawCityRoute, RawNearbyStop,} from "./publicApi";

/**
 * Seoul Metropolitan Government Bus Information System (TOPIS / ws.bus.go.kr) Client
 *
 * Implements the official specification from:
 * `docs/서울특별시_버스위치정보조회_서비스_활용가이드_20230530.docx`
 *
 * Base URLs:
 * - Official OpenAPI: http://ws.bus.go.kr/api/rest/buspos (uses the same DATA_GO_KR_SERVICE_KEY as MOLIT TAGO)
 * - Official TOPIS Web JSON API: https://bus.go.kr/sbus/bus (provides route catalog, road-snapped polylines, stops & arrivals)
 */

export const SEOUL_CITY_CODE = "11";
const WS_BUS_API_BASE = "http://ws.bus.go.kr/api/rest";
const SBUS_WEB_BASE = "https://bus.go.kr/sbus/bus";

export interface SeoulBusPosItem {
    sectOrd?: string | number;
    fullSectDist?: string | number;
    sectDist?: string | number;
    rtDist?: string | number;
    stopFlag?: string | number;
    sectionId?: string | number;
    dataTm?: string;
    tmX?: string | number | null;
    tmY?: string | number | null;
    gpsX?: string | number | null;
    gpsY?: string | number | null;
    posX?: string | number | null;
    posY?: string | number | null;
    vehId?: string | number;
    plainNo?: string;
    busType?: string | number;
    lastStTm?: string | number;
    nextStTm?: string | number;
    nextStId?: string | number;
    lastStnId?: string | number;
    trnstnid?: string | number;
    trnStnid?: string | number;
    isrunyn?: string | number;
    islastyn?: string | number;
    isFullFlag?: string | number;
    congetion?: string | number;
}

interface SeoulWsEnvelope<T> {
    msgHeader?: {
        headerCd?: string | number;
        headerMsg?: string;
        itemCount?: number;
    };
    msgBody?: {
        itemList?: T | T[] | null;
    };
    ServiceResult?: {
        msgHeader?: {
            headerCd?: string | number;
            headerMsg?: string;
            itemCount?: number;
        };
        msgBody?: {
            itemList?: T | T[] | null;
        };
    };
}

interface SbusResponseEnvelope<T> {
    ResponseVO?: {
        code?: number;
        message?: string;
        errmessage?: string | null;
        data?: T;
    };
}

interface SbusBusposInfoData {
    resultRoutePath?: Array<{
        no?: number;
        ord?: number;
        sectord?: number;
        dOrd?: number;
        gpsX?: number | string;
        gpsY?: number | string;
        posX?: number | string;
        posY?: number | string;
        drcFlag?: string | number;
    }>;
    resultRouteStop?: Array<{
        busRouteId?: number | string;
        busRouteNm?: string;
        seq?: number | string;
        section?: number | string;
        station?: number | string;
        arsId?: string | number;
        stationName?: string;
        stationNm?: string;
        gpsX?: number | string;
        gpsY?: number | string;
        posX?: number | string;
        posY?: number | string;
        direction?: string;
        stationNo?: string | number;
        routeType?: number | string;
        beginTm?: string;
        lastTm?: string;
        trnstnid?: number | string;
        transYn?: string;
    }>;
    resultRouteBuspos?: SeoulBusPosItem[];
}

const SEOUL_ROUTE_TYPE_MAP: Record<string, string> = {
    "1": "공항",
    "2": "마을",
    "3": "간선",
    "4": "지선",
    "5": "순환",
    "6": "광역",
    "7": "인천",
    "8": "경기",
    "9": "폐지",
    "10": "관광",
    "14": "한강",
    "15": "심야",
};

const ALLOWED_SEOUL_ROUTE_TYPES = new Set(["1", "2", "3", "4", "5", "6", "10", "15"]);

export function mapSeoulRouteType(code?: string | number | null): string {
    if (code === undefined || code === null) return "간선";
    return SEOUL_ROUTE_TYPE_MAP[String(code).trim()] || "간선";
}

export function mapSeoulVehicleType(busType?: string | number | null): string {
    const code = String(busType ?? "0").trim();
    if (code === "1") return "저상버스";
    if (code === "2") return "굴절버스";
    return "일반버스";
}

/**
 * Parses XML `<itemList>...</itemList>` blocks from `ws.bus.go.kr` when XML is returned instead of JSON.
 */
export function parseSeoulXmlItems<T = Record<string, unknown>>(xmlText: string): {
    headerCd: string;
    headerMsg: string;
    items: T[];
} {
    const cdMatch = xmlText.match(/<headerCd>([^<]*)<\/headerCd>/i);
    const msgMatch = xmlText.match(/<headerMsg>([^<]*)<\/headerMsg>/i);
    const headerCd = cdMatch ? cdMatch[1].trim() : "0";
    const headerMsg = msgMatch ? msgMatch[1].trim() : "";

    const items: T[] = [];
    const itemRegex = /<itemList>([\s\S]*?)<\/itemList>/gi;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xmlText)) !== null) {
        const block = match[1];
        const obj: Record<string, string> = {};
        const tagRegex = /<([a-zA-Z0-9_]+)>([^<]*)<\/\1>/g;
        let tagMatch: RegExpExecArray | null;
        while ((tagMatch = tagRegex.exec(block)) !== null) {
            obj[tagMatch[1]] = tagMatch[2].trim();
        }
        items.push(obj as unknown as T);
    }

    return {headerCd, headerMsg, items};
}

/**
 * Extracts items from a Seoul `ws.bus.go.kr` JSON or XML response payload.
 * Per `서울특별시_버스위치정보조회_서비스_활용가이드`, `headerCd === "0"` is success and `headerCd === "4"` means no results.
 */
export function extractSeoulWsItems<T = Record<string, unknown>>(payload: SeoulWsEnvelope<T> | string): T[] {
    if (typeof payload === "string") {
        const trimmed = payload.trim();
        if (trimmed.startsWith("<")) {
            const parsedXml = parseSeoulXmlItems<T>(trimmed);
            if (parsedXml.headerCd !== "0" && parsedXml.headerCd !== "4") {
                throw new Error(`[SeoulAPI] ${parsedXml.headerMsg || "XML Error"} (Code: ${parsedXml.headerCd})`);
            }
            return parsedXml.items;
        }
        try {
            payload = JSON.parse(trimmed) as SeoulWsEnvelope<T>;
        } catch {
            throw new Error(`[SeoulAPI] Invalid JSON/XML payload from ws.bus.go.kr`);
        }
    }

    const header = payload.msgHeader ?? payload.ServiceResult?.msgHeader;
    const body = payload.msgBody ?? payload.ServiceResult?.msgBody;

    if (header && header.headerCd !== undefined) {
        const code = String(header.headerCd).trim();
        if (code === "4") {
            // Code 4: "결과가 없습니다." (0 active buses)
            return [];
        }
        if (code !== "0" && code !== "00") {
            throw new Error(`[SeoulAPI] ${header.headerMsg ?? "Upstream Error"} (Code: ${code})`);
        }
    }

    const rawList = body?.itemList;
    if (!rawList) return [];
    return Array.isArray(rawList) ? rawList : [rawList];
}

/**
 * Normalizes a single Seoul `buspos` item (`getBusPosByRtid`, `getBusPosByRouteSt`, `getLowBusPosByRtid`, etc.)
 * into our unified `RawBusLocation` schema.
 * Note: `getBusPosByRtid` uses `gpsX`/`gpsY` for WGS84 coordinates, whereas `getBusPosByRouteSt` and `getLowBusPosByRtid`
 * return WGS84 coordinates in `tmX`/`tmY` (per `서울특별시_버스위치정보조회_서비스_활용가이드` pages 8-20).
 */
export function normalizeSeoulBusPosItem(
    item: SeoulBusPosItem,
    routeId: string,
    stopLookup?: Map<number | string, { nodeid: string; nodenm: string; routenm?: string }>,
    routeName?: string
): RawBusLocation | null {
    if (String(item.isrunyn ?? "1") === "0") {
        return null;
    }

    const rawLng = Number(item.gpsX ?? item.tmX ?? item.posX ?? 0);
    const rawLat = Number(item.gpsY ?? item.tmY ?? item.posY ?? 0);

    // Filter out invalid coordinates outside South Korea WGS84 bounding box
    if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng) || rawLat < 33 || rawLat > 39 || rawLng < 124 || rawLng > 132) {
        return null;
    }

    const sectOrd = Number(item.sectOrd ?? 0);
    const lastStnId = String(item.lastStnId ?? "").trim();
    // Look up by lastStnId first, then by sectOrd
    const matchedStop = (lastStnId ? stopLookup?.get(lastStnId) : undefined) ?? stopLookup?.get(sectOrd);
    const nodeid = String(lastStnId || matchedStop?.nodeid || item.nextStId || item.sectionId || "").trim();
    const nodenm = matchedStop?.nodenm;
    const routenm = routeName || matchedStop?.routenm || "";

    return {
        routeid: routeId,
        routenm,
        gpslati: rawLat,
        gpslong: rawLng,
        vehicleno: String(item.plainNo || item.vehId || "").trim(),
        nodeid: nodeid || undefined,
        nodenm: nodenm || undefined,
        nodeord: sectOrd,
    };
}

/**
 * Calls `http://ws.bus.go.kr/api/rest/buspos/{operation}` using the shared TAGO serviceKey.
 */
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

    const res = await fetch(url.toString(), {
        headers: {
            Client: "wBus",
            Connection: "keep-alive",
        },
        signal: AbortSignal.timeout(4500),
        cache: "no-store",
    });

    if (!res.ok) {
        throw new Error(`[SeoulAPI] HTTP ${res.status} from ws.bus.go.kr/api/rest/buspos/${operation}`);
    }

    const text = await res.text();
    return extractSeoulWsItems<SeoulBusPosItem>(text);
}

/**
 * Fetches and caches route stop sequence + road-snapped route path from Seoul TOPIS (`selectBusposInfo.do`).
 */
async function getSeoulRouteBundle(routeId: string): Promise<{
    stops: RawBusStop[];
    polyline: GeoPolyline | null;
    routeName: string;
}> {
    const bundleCacheKey = `seoul:bundle:${routeId}`;
    const result = await getCachedOrFetch(
        bundleCacheKey,
        async () => {
            const url = `${SBUS_WEB_BASE}/selectBusposInfo.do?routeId=${encodeURIComponent(routeId)}&isLowBus=N`;
            const res = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; wBus/2.0)",
                    Accept: "application/json",
                },
                signal: AbortSignal.timeout(6000),
            });

            if (!res.ok) {
                throw new Error(`[SeoulAPI] selectBusposInfo.do HTTP ${res.status}`);
            }

            const json = (await res.json()) as SbusResponseEnvelope<SbusBusposInfoData>;
            const data = json.ResponseVO?.data;
            const rawStops = data?.resultRouteStop ?? [];
            const rawPath = data?.resultRoutePath ?? [];

            if (rawStops.length === 0) {
                return {stops: [], polyline: null, routeName: routeId};
            }

            // Identify turning point index (`transYn === "Y"` or `station === trnstnid`)
            const transIdx = rawStops.findIndex(
                (s) => s.transYn === "Y" || (s.trnstnid && String(s.station) === String(s.trnstnid))
            );

            const routeName = String(rawStops[0]?.busRouteNm || routeId).trim();

            const stops: RawBusStop[] = rawStops.map((s, idx) => ({
                nodeid: String(s.station ?? "").trim(),
                nodenm: String(s.stationName || s.stationNm || "").trim(),
                nodeno: String(s.arsId || s.stationNo || "").trim(),
                gpslati: Number(s.gpsY || s.posY || 0),
                gpslong: Number(s.gpsX || s.posX || 0),
                nodeord: Number(s.seq ?? idx + 1),
                // Outbound (origin -> turning point) is 0, Inbound (turning point -> origin) is 1
                updowncd: transIdx >= 0 && idx > transIdx ? 1 : 0,
            }));

            // Construct official road-snapped GeoPolyline from resultRoutePath
            // drcFlag !== "2" is outbound (down_polyline, ud=0); drcFlag === "2" is inbound (up_polyline, ud=1)
            const downCoords: [number, number][] = [];
            const upCoords: [number, number][] = [];

            for (const p of rawPath) {
                const lng = Number(p.gpsX || p.posX || 0);
                const lat = Number(p.gpsY || p.posY || 0);
                if (lng <= 0 || lat <= 0) continue;

                if (String(p.drcFlag) === "2") {
                    upCoords.push([lng, lat]);
                } else {
                    downCoords.push([lng, lat]);
                }
            }

            // Fallback to stop coordinates if path is empty
            const finalDown: [number, number][] =
                downCoords.length >= 2
                    ? downCoords
                    : stops
                          .filter((s) => s.updowncd === 0 && s.gpslong > 0 && s.gpslati > 0)
                          .map((s) => [s.gpslong, s.gpslati]);

            let finalUp: [number, number][] =
                upCoords.length >= 2
                    ? upCoords
                    : stops
                          .filter((s) => s.updowncd === 1 && s.gpslong > 0 && s.gpslati > 0)
                          .map((s) => [s.gpslong, s.gpslati]);

            if (finalUp.length < 2) {
                finalUp = finalDown;
            } else if (finalDown.length >= 2) {
                // Connect turning point smoothly
                const lastDown = finalDown[finalDown.length - 1];
                const firstUp = finalUp[0];
                if (lastDown[0] !== firstUp[0] || lastDown[1] !== firstUp[1]) {
                    finalUp = [lastDown, ...finalUp];
                }
            }

            const totalDist = Math.round(
                calculatePolylineMeters(finalDown) +
                    (finalUp !== finalDown ? calculatePolylineMeters(finalUp) : 0)
            );

            const polyline: GeoPolyline = {
                route_id: routeId,
                route_no: routeName,
                stops_count: stops.length,
                total_dist: totalDist,
                up_polyline: finalUp,
                down_polyline: finalDown,
                stops: stops.map((s) => ({
                    id: s.nodeid,
                    name: s.nodenm,
                    ord: Number(s.nodeord ?? 0),
                    ud: Number(s.updowncd ?? 0),
                    lat: s.gpslati,
                    lon: s.gpslong,
                    nodeno: String(s.nodeno ?? ""),
                })),
            };

            // Warm L1 caches for bus-stops and polyline endpoints
            setCached(`bus-stops:${SEOUL_CITY_CODE}:${routeId}`, stops);
            setCached(`polyline:${SEOUL_CITY_CODE}:${routeId}`, polyline);

            return {stops, polyline, routeName};
        },
        {
            ttlSeconds: 3600,
            staleWhileRevalidateSeconds: 86400,
            staleIfErrorSeconds: 86400,
        }
    );

    return result.data ?? {stops: [], polyline: null, routeName: routeId};
}

/**
 * 1. Real-time Bus Locations (`getBusPosByRtid` with TOPIS fallback)
 */
export async function fetchSeoulBusLocations(
    routeId: string,
    getServiceKey: () => { key: string; index: number },
    onKeyRateLimited?: (index: number) => void
): Promise<RawBusLocation[]> {
    // 1. Resolve routeName and route stops with multi-tier cache & fallback warming
    let cachedStops = peekCached<RawBusStop[]>(`bus-stops:${SEOUL_CITY_CODE}:${routeId}`, 86400)?.data;
    const cachedPoly = peekCached<GeoPolyline>(`polyline:${SEOUL_CITY_CODE}:${routeId}`, 86400)?.data;
    let resolvedRouteName = cachedPoly?.route_no || "";

    if (!resolvedRouteName) {
        // Check full city routes catalog cache if available
        const cityRoutes = peekCached<RawCityRoute[]>(`routes:${SEOUL_CITY_CODE}:all`, 604800)?.data;
        const matchedCityRoute = cityRoutes?.find((r) => String(r.routeid) === String(routeId));
        if (matchedCityRoute?.routeno) {
            resolvedRouteName = String(matchedCityRoute.routeno);
        }
    }

    // If still missing stops or polyline, proactively warm bundle via TOPIS
    if ((!cachedStops || !resolvedRouteName) && routeId) {
        try {
            const bundle = await getSeoulRouteBundle(routeId);
            if (bundle) {
                if (bundle.stops && bundle.stops.length > 0) {
                    cachedStops = bundle.stops;
                }
                if (bundle.routeName && bundle.routeName !== routeId) {
                    resolvedRouteName = bundle.routeName;
                }
            }
        } catch {
            // Keep going even if bundle warm fails
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

    let rawItems: SeoulBusPosItem[];

    // Primary: Official ws.bus.go.kr/api/rest/buspos/getBusPosByRtid using TAGO serviceKey
    try {
        const {key, index} = getServiceKey();
        rawItems = await fetchSeoulWsBusPos("getBusPosByRtid", {busRouteId: routeId}, key);
        void index;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/LIMITED|TRAFFIC|EXCEED|429|Code:\s*22/i.test(msg) && onKeyRateLimited) {
            try {
                const {index} = getServiceKey();
                onKeyRateLimited(index);
            } catch {
                // Ignore
            }
        }

        // Fallback: TOPIS selectBusposByRtid.do
        const fallbackUrl = `${SBUS_WEB_BASE}/selectBusposByRtid.do?routeId=${encodeURIComponent(routeId)}&isLowBus=N`;
        const res = await fetch(fallbackUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; wBus/2.0)",
                Accept: "application/json",
            },
            signal: AbortSignal.timeout(4500),
            cache: "no-store",
        });

        if (!res.ok) {
            throw err;
        }

        const json = (await res.json()) as SbusResponseEnvelope<{
            resultList?: SeoulBusPosItem[];
            resultRouteBuspos?: SeoulBusPosItem[];
        }>;
        rawItems = json.ResponseVO?.data?.resultList ?? json.ResponseVO?.data?.resultRouteBuspos ?? [];
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

/**
 * 2. Route Stops (`fetchSeoulRouteStops`)
 */
export async function fetchSeoulRouteStops(routeId: string): Promise<RawBusStop[]> {
    const bundle = await getSeoulRouteBundle(routeId);
    return bundle.stops;
}

/**
 * 3. Route Road-Snapped Polyline (`fetchSeoulRoutePolyline`)
 */
export async function fetchSeoulRoutePolyline(routeId: string, routeNo?: string): Promise<GeoPolyline | null> {
    const bundle = await getSeoulRouteBundle(routeId);
    if (!bundle.polyline) return null;
    if (routeNo && bundle.polyline.route_no === routeId) {
        return {
            ...bundle.polyline,
            route_no: routeNo,
        };
    }
    return bundle.polyline;
}

/**
 * 4. City Routes (`fetchSeoulCityRoutes`)
 */
interface SbusRouteListItem {
    strdiv?: number | string;
    strid?: number | string;
    strnm?: string;
    strno?: string;
    strtp?: string | number;
    strkey?: string;
}

export async function fetchSeoulCityRoutes(routeNo?: string): Promise<RawCityRoute[]> {
    const url = new URL(`${SBUS_WEB_BASE}/selectVApiTotalstr.do`);
    url.searchParams.set("pageIndex", "1");
    url.searchParams.set("recordCountPerPage", "2000");
    url.searchParams.set("strkey", routeNo || "");
    url.searchParams.set("strdiv", "1");

    const res = await fetch(url.toString(), {
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; wBus/2.0)",
            Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
        throw new Error(`[SeoulAPI] selectVApiTotalstr.do HTTP ${res.status}`);
    }

    const json = (await res.json()) as SbusResponseEnvelope<{ resultList?: SbusRouteListItem[] }>;
    const list = json.ResponseVO?.data?.resultList ?? [];

    const routes: RawCityRoute[] = [];
    for (const item of list) {
        if (String(item.strdiv) !== "1") continue;
        const tpCode = String(item.strtp ?? "");
        // Keep pure Seoul bus routes (or exact match when routeNo is explicitly queried)
        if (!routeNo && !ALLOWED_SEOUL_ROUTE_TYPES.has(tpCode)) {
            continue;
        }

        const routeId = String(item.strid ?? "").trim();
        if (!routeId) continue;

        // Clean operational annotations like `(자율주행)(토,일 미운행)` from strnm
        const rawName = String(item.strnm || item.strno || "").trim();
        const cleanedName = rawName.replace(/\([^)]*\)/g, "").trim() || String(item.strno || "").trim();
        if (!cleanedName) continue;

        const endpoints = String(item.strkey || "").split(/\s+-\s+|\s*~\s*/);
        const startnodenm = endpoints[0]?.trim() || "기점";
        const endnodenm = endpoints[1]?.trim() || endpoints[0]?.trim() || "종점";

        routes.push({
            routeid: routeId,
            routeno: cleanedName,
            routetp: mapSeoulRouteType(tpCode),
            startnodenm,
            endnodenm,
        });
    }

    return routes;
}

/**
 * 5. Bus Stop Arrivals (`fetchSeoulBusArrivals`)
 */
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

export async function fetchSeoulBusArrivals(nodeId: string): Promise<RawBusArrival[]> {
    const trimmed = nodeId.trim();
    const url = new URL(`${SBUS_WEB_BASE}/selectBusArrive.do`);
    // 9-digit IDs (e.g. 101000290) are stopId; 5-digit IDs (e.g. 02286) are arsId (stnuid)
    if (trimmed.length <= 5) {
        url.searchParams.set("stnuid", trimmed);
    } else {
        url.searchParams.set("stopId", trimmed);
    }

    const res = await fetch(url.toString(), {
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; wBus/2.0)",
            Accept: "application/json",
        },
        signal: AbortSignal.timeout(4500),
        cache: "no-store",
    });

    if (!res.ok) {
        throw new Error(`[SeoulAPI] selectBusArrive.do HTTP ${res.status}`);
    }

    const json = (await res.json()) as SbusResponseEnvelope<{ resultList?: SbusArrivalItem[] }>;
    const list = json.ResponseVO?.data?.resultList ?? [];

    const arrivals: RawBusArrival[] = [];

    for (const item of list) {
        const routeid = String(item.rtid ?? "").trim();
        const routeno = String(item.rtnm || item.rtnum || "").trim();
        const nodenm = String(item.stnnm ?? "").trim();
        const stopOrd = Number(item.ord ?? 0);

        // First arriving bus
        const arrSec1 = Number(item.avgs11 ?? item.wavgs11 ?? 0);
        const stat1 = Number(item.stat1 ?? 0);
        if (arrSec1 > 0 || (stat1 > 0 && item.avgs1 && !item.statnm1?.includes("종료") && !item.statnm1?.includes("대기"))) {
            const prevCnt1 = parseStationsAway(item.avgs1, stopOrd, Number(item.sectord1 ?? 0));
            arrivals.push({
                routeid,
                routeno,
                arrtime: arrSec1 > 0 ? arrSec1 : 30,
                arrprevstationcnt: prevCnt1,
                vehicletp: mapSeoulVehicleType(item.bustp1),
                nodenm,
                nodeid: String(item.stnid || trimmed),
            });
        }

        // Second arriving bus
        const arrSec2 = Number(item.avgs22 ?? item.wavgs22 ?? 0);
        const stat2 = Number(item.stat2 ?? 0);
        if (arrSec2 > 0 || (stat2 > 0 && item.avgs2 && !item.statnm2?.includes("종료") && !item.statnm2?.includes("대기"))) {
            const prevCnt2 = parseStationsAway(item.avgs2, stopOrd, Number(item.sectord2 ?? 0));
            arrivals.push({
                routeid,
                routeno,
                arrtime: arrSec2 > 0 ? arrSec2 : 60,
                arrprevstationcnt: prevCnt2,
                vehicletp: mapSeoulVehicleType(item.bustp2),
                nodenm,
                nodeid: String(item.stnid || trimmed),
            });
        }
    }

    return arrivals.sort((a, b) => a.arrtime - b.arrtime);
}

/**
 * 6. Nearby Bus Stops (`fetchSeoulNearbyStops`)
 */
interface SbusNearStopItem {
    strdiv?: string | number;
    strid?: string | number;
    strnm?: string;
    strno?: string | number;
    strkey?: string | number;
    posX?: number | string;
    posY?: number | string;
}

export function isWithinSeoulBounds(lat: number, lng: number): boolean {
    return lat >= 37.41 && lat <= 37.72 && lng >= 126.76 && lng <= 127.19;
}

export async function fetchSeoulNearbyStops(params: {
    gpsLati: number;
    gpsLong: number;
}): Promise<RawNearbyStop[]> {
    const url = new URL(`${SBUS_WEB_BASE}/selectNearStops.do`);
    url.searchParams.set("kiloMeter", "0.5");
    url.searchParams.set("lati", String(params.gpsLati));
    url.searchParams.set("longi", String(params.gpsLong));

    const res = await fetch(url.toString(), {
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; wBus/2.0)",
            Accept: "application/json",
        },
        signal: AbortSignal.timeout(4500),
    });

    if (!res.ok) {
        throw new Error(`[SeoulAPI] selectNearStops.do HTTP ${res.status}`);
    }

    const json = (await res.json()) as SbusResponseEnvelope<{ resultList?: SbusNearStopItem[] }>;
    const list = json.ResponseVO?.data?.resultList ?? [];

    return list
        .filter((s) => String(s.strdiv ?? "2") === "2")
        .map((s) => ({
            nodeid: String(s.strid ?? "").trim(),
            nodenm: String(s.strnm ?? "").trim(),
            nodeno: String(s.strno || s.strkey || "").trim(),
            gpslati: Number(s.posY ?? 0),
            gpslong: Number(s.posX ?? 0),
            citycode: SEOUL_CITY_CODE,
        }))
        .filter((s) => s.nodeid && s.gpslati > 0 && s.gpslong > 0);
}
