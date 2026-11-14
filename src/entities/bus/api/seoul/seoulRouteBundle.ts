import {getCachedOrFetch, setCached} from "@shared/cache";
import {artifactStore} from "@shared/cache/artifactStore";
import {calculatePolylineMeters} from "@entities/route/polylineChunker";
import type {GeoPolyline} from "@entities/route/types";
import type {RawBusStop} from "../publicApi";
import {fetchTopisJson, SBUS_WEB_BASE, SEOUL_CITY_CODE} from "./seoulClient";
import type {SeoulBusPosItem} from "./seoulParser";

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

/**
 * Fetches and caches route stop sequence + road-snapped route path from Seoul TOPIS (`selectBusposInfo.do`).
 */
export async function getSeoulRouteBundle(routeId: string): Promise<{
    stops: RawBusStop[];
    polyline: GeoPolyline | null;
    routeName: string;
}> {
    const bundleCacheKey = `seoul:bundle:${routeId}`;
    const result = await getCachedOrFetch(
        bundleCacheKey,
        async () => {
            const url = `${SBUS_WEB_BASE}/selectBusposInfo.do?routeId=${encodeURIComponent(routeId)}&isLowBus=N`;
            const data = await fetchTopisJson<SbusBusposInfoData>(url, "selectBusposInfo.do", {timeoutMs: 6000});
            const rawStops = data?.resultRouteStop ?? [];
            const rawPath = data?.resultRoutePath ?? [];

            if (rawStops.length === 0) {
                return {stops: [], polyline: null, routeName: routeId};
            }

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
                updowncd: transIdx >= 0 && idx > transIdx ? 1 : 0,
            }));

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

            setCached(`bus-stops:${SEOUL_CITY_CODE}:${routeId}`, stops);
            setCached(`polyline:${SEOUL_CITY_CODE}:${routeId}`, polyline);
            if (stops.length > 0) {
                void artifactStore.putJson(`routes/${SEOUL_CITY_CODE}/${routeId}.json`, polyline);
            }

            return {stops, polyline, routeName};
        },
        {
            ttlSeconds: 3600,
            staleWhileRevalidateSeconds: 86400,
            staleIfErrorSeconds: 86400,
            useDistributedCache: true,
            shouldCache: (b) => Boolean(b?.stops?.length),
        }
    );

    return result.data ?? {stops: [], polyline: null, routeName: routeId};
}

export async function fetchSeoulRouteStops(routeId: string): Promise<RawBusStop[]> {
    const bundle = await getSeoulRouteBundle(routeId);
    return bundle.stops;
}

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
