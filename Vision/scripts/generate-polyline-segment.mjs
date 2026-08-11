#!/usr/bin/env node

/**
 * Polly - wBus Integrated Data Pipeline Script
 *
 * Consolidates route collection, TAGO API fetching, OSRM route snapping,
 * GeoJSON polyline generation, schedule scraping, and static data packaging into Node.js.
 *
 * Usage:
 *   node scripts/generate-polyline-segment.mjs route [--route <no>] [--city-code 32020] [--station-map-only] [--osrm-only]
 *   node scripts/generate-polyline-segment.mjs schedule
 *   node scripts/generate-polyline-segment.mjs all
 */

import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "fs";
import {join} from "path";
import {runScraper} from "./scrape-wonju-its.mjs";

// Configuration Defaults
const DEFAULT_CITY_CODE = "32020"; // Wonju
const DEFAULT_TAGO_URL = "https://apis.data.go.kr/1613000/BusRouteInfoInqireService";
const DEFAULT_OSRM_URL = process.env.OSRM_API_URL || "http://localhost:4000/route/v1/driving";
const OSRM_SNAP_RADIUS = 30; // Meters
const CONCURRENCY_FETCH = 3;

// Service Key retrieval
function getServiceKey() {
    const key = process.env.DATA_GO_KR_SERVICE_KEY || process.env.DATA_GO_KR_SERVICE_KEYS?.split(",")[0];
    if (!key) {
        throw new Error("DATA_GO_KR_SERVICE_KEY environment variable is missing.");
    }
    return key;
}

// TAGO API Fetcher
async function fetchTago(endpoint, params) {
    const url = new URL(`${DEFAULT_TAGO_URL}/${endpoint}`);
    url.searchParams.set("serviceKey", getServiceKey());
    url.searchParams.set("_type", "json");
    for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, String(v));
    }

    const res = await fetch(url.toString(), {
        headers: {"User-Agent": "wBus-Polly/1.0"}
    });

    if (!res.ok) {
        throw new Error(`TAGO API HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    const items = json?.response?.body?.items?.item;
    if (!items) return [];
    return Array.isArray(items) ? items : [items];
}

// OSRM Route Snapper with Retry
async function fetchOsrmRoute(stops, osrmBaseUrl = DEFAULT_OSRM_URL) {
    if (stops.length < 2) return null;

    const coordsStr = stops.map(s => `${s.gpslong.toFixed(6)},${s.gpslati.toFixed(6)}`).join(";");
    let currentRadius = OSRM_SNAP_RADIUS;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
        const radiuses = stops.map(() => Math.round(currentRadius)).join(";");
        const url = `${osrmBaseUrl}/${coordsStr}?overview=full&geometries=geojson&steps=false&continue_straight=true&snapping=any&radiuses=${radiuses}`;

        try {
            const res = await fetch(url);
            if (res.ok) {
                const json = await res.json();
                const route = json?.routes?.[0];
                if (route && route.geometry?.coordinates?.length > 0) {
                    return {
                        coordinates: route.geometry.coordinates,
                        distance: route.distance || 0,
                        duration: route.duration || 0,
                    };
                }
            } else if (res.status === 400) {
                const errText = await res.text();
                if (errText.includes("NoSegment")) {
                    attempts++;
                    currentRadius += 100;
                    console.warn(`[OSRM] NoSegment error (attempt ${attempts}/${maxAttempts}). Increasing radius to ${currentRadius}m...`);

                }
            }
        } catch {
            attempts++;
            await new Promise(r => setTimeout(r, 500));
        }
    }

    return null;
}

// Main Pipeline Logic
async function runRoutePipeline(options) {
    const outputDir = options.outputDir || join(process.cwd(), "public", "data");
    const rawDir = join(outputDir, "cache");
    const derivedDir = join(outputDir, "polylines");

    if (!existsSync(rawDir)) mkdirSync(rawDir, {recursive: true});
    if (!existsSync(derivedDir)) mkdirSync(derivedDir, {recursive: true});

    console.log(`[Polly] Starting Route Processing (Output: ${outputDir})...`);

    let targetRoutes = [];
    if (!options.osrmOnly) {
        console.log("[Polly Phase 1] Fetching Route List from TAGO API...");
        const allRoutes = await fetchTago("getRouteNoList", {
            cityCode: options.cityCode || DEFAULT_CITY_CODE,
            numOfRows: 2048,
            pageNo: 1,
        });

        targetRoutes = allRoutes.filter(r => {
            const routeNo = String(r.routeno || "");
            if (!routeNo || routeNo === "UNKNOWN") return false;
            if (options.routeFilter && routeNo !== options.routeFilter) return false;
            return true;
        });

        console.log(`[Polly Phase 1] Found ${targetRoutes.length} matching routes.`);

        const routeDetailsMap = {};
        const routeMapping = {};
        const allStopsMap = {};

        // Fetch stops for each route with concurrency
        for (let i = 0; i < targetRoutes.length; i += CONCURRENCY_FETCH) {
            const chunk = targetRoutes.slice(i, i + CONCURRENCY_FETCH);
            await Promise.all(chunk.map(async (route) => {
                const routeId = String(route.routeid);
                const routeNo = String(route.routeno);

                try {
                    const stopItems = await fetchTago("getRouteAcctoThrghSttnList", {
                        cityCode: options.cityCode || DEFAULT_CITY_CODE,
                        routeId,
                        numOfRows: 2048,
                    });

                    if (stopItems.length === 0) return;

                    const stops = stopItems.map(item => ({
                        nodeid: String(item.nodeid || ""),
                        nodenm: String(item.nodenm || ""),
                        nodeord: Number(item.nodeord || 0),
                        nodeno: String(item.nodeno || ""),
                        gpslati: Number(item.gpslati || 0),
                        gpslong: Number(item.gpslong || 0),
                        updowncd: Number(item.updowncd ?? 0),
                    })).sort((a, b) => a.nodeord - b.nodeord);

                    // Save raw cache file
                    const rawData = {
                        route_id: routeId,
                        route_no: routeNo,
                        fetched_at: new Date().toISOString(),
                        stops,
                    };
                    writeFileSync(join(rawDir, `${routeNo}_${routeId}.json`), JSON.stringify(rawData, null, 2));

                    // Aggregate mapping metadata
                    if (!routeMapping[routeNo]) routeMapping[routeNo] = [];
                    if (!routeMapping[routeNo].includes(routeId)) routeMapping[routeNo].push(routeId);

                    routeDetailsMap[routeId] = {
                        routeno: routeNo,
                        sequence: stops.map(s => ({
                            nodeid: s.nodeid,
                            nodeord: s.nodeord,
                            updowncd: s.updowncd,
                        }))
                    };

                    stops.forEach(s => {
                        allStopsMap[s.nodeid] = {
                            nodenm: s.nodenm,
                            nodeno: s.nodeno,
                            gpslati: s.gpslati,
                            gpslong: s.gpslong,
                        };
                    });
                } catch (err) {
                    console.error(`[Polly] Failed fetching stops for route ${routeNo} (${routeId}):`, err.message);
                }
            }));
            process.stdout.write(`Progress: ${Math.min(i + CONCURRENCY_FETCH, targetRoutes.length)} / ${targetRoutes.length}\r`);
        }
        console.log("\n[Polly Phase 1] Saved raw route files.");

        // Save mapping JSON files
        const timestamp = new Date().toISOString();
        writeFileSync(join(outputDir, "routeMap.json"), JSON.stringify({
            lastUpdated: timestamp,
            route_numbers: routeMapping
        }, null, 2));
        writeFileSync(join(outputDir, "routeDetails.json"), JSON.stringify({
            lastUpdated: timestamp,
            route_details: routeDetailsMap
        }, null, 2));
        writeFileSync(join(outputDir, "stationMap.json"), JSON.stringify({
            lastUpdated: timestamp,
            stations: allStopsMap
        }, null, 2));
        console.log("[Polly Phase 1] Generated routeMap.json, routeDetails.json, stationMap.json.");
    }

    if (options.stationMapOnly) return;

    // Phase 2: OSRM Route Snapping & GeoJSON Polyline Generation
    console.log("[Polly Phase 2] Snapping routes with OSRM...");
    const rawFiles = readdirSync(rawDir).filter(f => f.endsWith(".json"));
    const allSegments = {};

    for (const file of rawFiles) {
        if (options.routeFilter && !file.startsWith(options.routeFilter)) continue;

        try {
            const raw = JSON.parse(readFileSync(join(rawDir, file), "utf-8"));
            if (!raw.stops || raw.stops.length < 2) continue;

            const osrmResult = await fetchOsrmRoute(raw.stops, options.osrmUrl);
            const coordinates = osrmResult?.coordinates || raw.stops.map(s => [s.gpslong, s.gpslati]);

            const geoJson = {
                type: "Feature",
                properties: {
                    route_id: raw.route_id,
                    route_no: raw.route_no,
                    stops_count: raw.stops.length,
                    distance: osrmResult?.distance || 0,
                    duration: osrmResult?.duration || 0,
                    stops: raw.stops.map(s => ({
                        id: s.nodeid,
                        name: s.nodenm,
                        ord: s.nodeord,
                        ud: s.updowncd,
                        lat: s.gpslati,
                        lon: s.gpslong,
                    })),
                },
                geometry: {
                    type: "LineString",
                    coordinates,
                }
            };

            writeFileSync(join(derivedDir, `${raw.route_id}.json`), JSON.stringify(geoJson, null, 2));

            // Record segment
            allSegments[raw.route_id] = coordinates;
            console.log(`[Polly Phase 2] Snapped ${file} -> ${raw.route_id}.json (${coordinates.length} points)`);
        } catch (err) {
            console.error(`[Polly Phase 2] Error processing ${file}:`, err.message);
        }
    }

    writeFileSync(join(derivedDir, "segments.json"), JSON.stringify(allSegments));
    console.log("[Polly Phase 2] Complete. Saved segments.json.");
}

// CLI Command Handler
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || "all";

    const options = {
        cityCode: DEFAULT_CITY_CODE,
        routeFilter: null,
        stationMapOnly: args.includes("--station-map-only"),
        osrmOnly: args.includes("--osrm-only"),
        osrmUrl: DEFAULT_OSRM_URL,
        outputDir: join(process.cwd(), "public", "data"),
    };

    const routeIdx = args.indexOf("--route");
    if (routeIdx !== -1 && args[routeIdx + 1]) {
        options.routeFilter = args[routeIdx + 1];
    }

    const cityIdx = args.indexOf("--city-code");
    if (cityIdx !== -1 && args[cityIdx + 1]) {
        options.cityCode = args[cityIdx + 1];
    }

    if (command === "route" || command === "all") {
        await runRoutePipeline(options);
    }

    if (command === "schedule" || command === "all") {
        console.log("[Polly] Running Schedule Scraper...");
        await runScraper();
    }

    console.log("[Polly] Data Pipeline Complete!");
}

main().catch(err => {
    console.error("[Polly] Pipeline failed:", err);
    process.exit(1);
});
