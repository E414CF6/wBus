import {ApiValidators, createApiHandler} from "@shared/api";
import {getRouteDetails, getRouteMapData} from "@entities/route/api";
import {getStationMap} from "@entities/station/api";
import type {BusStop} from "@entities/station/types";
import {buildCacheControl} from "@shared/cache/cachePolicy";
import {fetchCityRoutes, fetchRouteStops} from "@entities/bus";

// Edge CDN ISR Cache: Revalidate every 24 hours (86400 seconds)
export const revalidate = 86400;

async function getWonjuRouteStops(routeName: string): Promise<BusStop[]> {
    let routeIds: string[];
    if (routeName.startsWith("WJB")) {
        routeIds = [routeName];
    } else {
        const routeMapData = await getRouteMapData();
        routeIds = routeMapData.route_numbers[routeName] ?? [];
    }
    if (routeIds.length === 0) return [];

    const stationMap = await getStationMap();
    const stopMap = new Map<string, BusStop>();

    const routeDetailsList = await Promise.all(
        routeIds.map((routeId) => getRouteDetails(routeId))
    );

    routeDetailsList.forEach((detail) => {
        if (!detail?.sequence) return;
        detail.sequence.forEach((stop) => {
            const station = stationMap[stop.nodeid];
            if (!station) return;
            const key = `${stop.nodeid}-${stop.updowncd ?? ""}`;
            if (stopMap.has(key)) return;
            stopMap.set(key, {
                ...station,
                nodeid: stop.nodeid,
                nodeord: stop.nodeord,
                updowncd: stop.updowncd,
            });
        });
    });

    return Array.from(stopMap.values());
}

async function getNationwideRouteStops(routeName: string, cityCode: string): Promise<BusStop[]> {
    try {
        const rawRoutes = await fetchCityRoutes(cityCode, routeName);
        const matched = rawRoutes.filter((r) => String(r.routeno) === routeName);
        const routeIds = (matched.length > 0 ? matched : rawRoutes).map((r) => r.routeid);
        if (routeIds.length === 0) return [];

        const stopMap = new Map<string, BusStop>();

        for (const rId of routeIds) {
            try {
                const stops = await fetchRouteStops(rId, cityCode);
                for (const s of stops) {
                    const key = `${s.nodeid}-${s.updowncd ?? ""}`;
                    if (!stopMap.has(key)) {
                        stopMap.set(key, {
                            nodeid: s.nodeid,
                            nodenm: s.nodenm,
                            nodeno: String(s.nodeno ?? ""),
                            gpslati: Number(s.gpslati),
                            gpslong: Number(s.gpslong),
                            nodeord: Number(s.nodeord ?? 0),
                            updowncd: Number(s.updowncd ?? 0),
                        });
                    }
                }
            } catch (err) {
                console.warn(`[getNationwideRouteStops] Failed for routeId ${rId}:`, err);
            }
        }

        return Array.from(stopMap.values());
    } catch (e) {
        console.error(`[getNationwideRouteStops] Failed to fetch stops for city ${cityCode}:`, e);
        return [];
    }
}

const CACHE_CONTROL = buildCacheControl({
    ttlSeconds: 3600,
    maxAgeSeconds: 300,
    sMaxAgeSeconds: 86400,
    staleWhileRevalidateSeconds: 86400,
    staleIfErrorSeconds: 86400,
});

export const GET = createApiHandler<BusStop[]>({
    paramKey: "routeName",
    cacheKey: (id, req) => {
        const cityCode = req ? new URL(req.url).searchParams.get("cityCode") || "32020" : "32020";
        return `route-stops:${cityCode}:${id}`;
    },
    fetcher: (routeName, req) => {
        const cityCode = req ? new URL(req.url).searchParams.get("cityCode") || "32020" : "32020";
        if (cityCode === "32020") {
            return getWonjuRouteStops(routeName);
        }
        return getNationwideRouteStops(routeName, cityCode);
    },
    ttl: 3600,
    errorMessage: "Failed to fetch route stops",
    cacheControl: CACHE_CONTROL,
    loggerPrefix: "route-stops",
    validate: ApiValidators.isValidRouteName,
    cacheOptions: {
        staleWhileRevalidateSeconds: 86400,
        staleIfErrorSeconds: 86400,
    },
});
