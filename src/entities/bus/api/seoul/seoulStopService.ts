import type {RawCityRoute, RawNearbyStop} from "../publicApi";
import {fetchTopisJson, SBUS_WEB_BASE, SEOUL_CITY_CODE} from "./seoulClient";
import {mapSeoulRouteType} from "./seoulParser";

const ALLOWED_SEOUL_ROUTE_TYPES = new Set(["1", "2", "3", "4", "5", "6", "10", "15"]);

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

    const data = await fetchTopisJson<{ resultList?: SbusRouteListItem[] }>(
        url.toString(),
        "selectVApiTotalstr.do",
        {timeoutMs: 8000}
    );
    const list = data?.resultList ?? [];

    const routes: RawCityRoute[] = [];
    for (const item of list) {
        if (String(item.strdiv) !== "1") continue;
        const tpCode = String(item.strtp ?? "");
        if (!routeNo && !ALLOWED_SEOUL_ROUTE_TYPES.has(tpCode)) {
            continue;
        }

        const routeId = String(item.strid ?? "").trim();
        if (!routeId) continue;

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

    const data = await fetchTopisJson<{ resultList?: SbusNearStopItem[] }>(
        url.toString(),
        "selectNearStops.do",
        {timeoutMs: 4500}
    );
    const list = data?.resultList ?? [];

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
