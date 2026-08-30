#!/usr/bin/env node

/**
 * Integrated Data Pipeline Script
 *
 * Consolidates TAGO API route collection, OSRM snapping with fallback,
 * segment-based GeoJSON polyline generation, schedule scraping, and static packaging.
 *
 * Features:
 *   - Independent UP (ud=1) and DOWN (ud=0) route snapping and polyline assembly
 *   - OSRM route snapping with automatic straight-line fallback if OSRM is unavailable
 *   - Segment hashing (MD5) matching wBus polylineService schema
 *   - Complete telemetry and error reporting
 *
 * Usage:
 *   node scripts/generate-polyline-segment.mjs route [--route <no>] [--city-code 32020] [--station-map-only] [--osrm-only]
 *   node scripts/generate-polyline-segment.mjs schedule
 *   node scripts/generate-polyline-segment.mjs all
 */

import crypto from "crypto";
import dotenv from "dotenv";
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "fs";
import {join} from "path";
import {runScraper} from "./scrape-wonju-its.mjs";

// Load environment variables (.env.local priority, fallback to .env)
dotenv.config({path: join(process.cwd(), ".env.local")});
dotenv.config({path: join(process.cwd(), ".env")});

// Configuration Defaults
const DEFAULT_CITY_CODE = "32020"; // Wonju
const DEFAULT_TAGO_URL = "https://apis.data.go.kr/1613000/BusRouteInfoInqireService";
const DEFAULT_OSRM_URL = process.env.OSRM_API_URL || "http://localhost:4000/route/v1/driving";
const OSRM_SNAP_RADIUS = 25; // Meters (conservative: prefer main road snapping, avoid alleys)
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
        headers: {"User-Agent": "wBus-Polly/2.0"}
    });

    if (!res.ok) {
        throw new Error(`TAGO API HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    const items = json?.response?.body?.items?.item;
    if (!items) return [];
    return Array.isArray(items) ? items : [items];
}

// Compute 16-character MD5 hash for segment coordinates
function computeSegmentHash(coords) {
    if (!coords || coords.length < 2) return "empty";
    const p1 = coords[0];
    const p2 = coords[coords.length - 1];
    const str = `${p1[0].toFixed(6)},${p1[1].toFixed(6)};${p2[0].toFixed(6)},${p2[1].toFixed(6)}`;
    return crypto.createHash("md5").update(str).digest("hex").slice(0, 16);
}

// Calculate Haversine distance in meters
function getHaversineDistanceMeters(p1, p2) {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(p2[1] - p1[1]);
    const dLon = toRad(p2[0] - p1[0]);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p1[1])) * Math.cos(toRad(p2[1])) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Calculate total distance along a polyline in meters
function getPolylineDistanceMeters(coords) {
    let total = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        total += getHaversineDistanceMeters(coords[i], coords[i + 1]);
    }
    return total;
}

// Calculate bearing in degrees (0-360) between two [lng, lat] coordinates
function calculateBearing(p1, p2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;
    const y = Math.sin(toRad(p2[0] - p1[0])) * Math.cos(toRad(p2[1]));
    const x = Math.cos(toRad(p1[1])) * Math.sin(toRad(p2[1])) -
        Math.sin(toRad(p1[1])) * Math.cos(toRad(p2[1])) * Math.cos(toRad(p2[0] - p1[0]));
    return Math.round((toDeg(Math.atan2(y, x)) + 360) % 360);
}

// Multi-factor candidate scoring function to prioritize main arterial roads (대로/로) over side alleys/driveways
function scoreCandidate(cand, stopName, prevRoad, nextRoad, corridorRoads) {
    let score = 0;
    const dist = cand.distance;
    const name = (cand.name || "").trim();

    // 1. Distance penalty (gradual up to 20m, steep beyond 20m)
    if (dist <= 20) {
        score -= dist * 1.0;
    } else {
        score -= 20.0 + (dist - 20) * 2.5;
    }

    // 2. Road Hierarchy base score
    if (name.endsWith("대로")) {
        score += 30; // Arterial Boulevard
    } else if (name.endsWith("길") || name.endsWith("로")) {
        score += 20; // Major Avenue / Collector Road
    } else if (name.endsWith("거리")) {
        score += 8; // Local Street
    } else if (!name) {
        score -= 15; // Unnamed side alley / parking driveway / service lane
    }

    // 3. Corridor Continuity (reward matching roads from adjacent stops or dominant route corridor)
    if (name) {
        if (prevRoad && name === prevRoad) score += 25;
        if (nextRoad && name === nextRoad) score += 25;
        if (corridorRoads && corridorRoads.has(name)) score += 10;
    }

    // 4. Stop name semantic hint
    if (name && stopName && stopName.includes(name)) {
        score += 20;
    }

    return score;
}

// Smart Stop Coordinate Snapper
async function smartSnapStops(stops, osrmHost) {
    const corridorRoads = new Set();
    const stopCandidates = [];
    const BATCH_SIZE = 10;

    // Phase 1: Fetch nearest road candidates in concurrent batches
    for (let i = 0; i < stops.length; i += BATCH_SIZE) {
        const batch = stops.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(async (s) => {
            const rawCoord = [s.lon, s.lat];
            const url = `${osrmHost}/nearest/v1/driving/${rawCoord[0].toFixed(6)},${rawCoord[1].toFixed(6)}?number=8`;
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 2500);
                const res = await fetch(url, {signal: controller.signal});
                clearTimeout(timer);
                if (res.ok) {
                    const json = await res.json();
                    const candidates = (json.waypoints || []).filter(c => c.distance <= 50);
                    return {stop: s, rawCoord, candidates};
                }
            } catch {
                // Ignore timeout/error and fallback to raw coordinate
            }
            return {stop: s, rawCoord, candidates: []};
        }));

        for (const item of batchResults) {
            stopCandidates.push(item);
            for (const c of item.candidates) {
                if (c.name && (c.name.endsWith("로") || c.name.endsWith("대로"))) {
                    corridorRoads.add(c.name);
                }
            }
        }
    }

    // Phase 2: Multi-pass corridor scoring & optimal candidate selection
    const snappedStops = [];
    for (let i = 0; i < stopCandidates.length; i++) {
        const {stop, rawCoord, candidates} = stopCandidates[i];

        let prevRoad = "";
        if (i > 0 && snappedStops[i - 1].name) {
            prevRoad = snappedStops[i - 1].name;
        }

        let nextRoad = "";
        if (i < stopCandidates.length - 1) {
            const nextCand = stopCandidates[i + 1].candidates;
            const nextMajor = nextCand.find(c => c.name && (c.name.endsWith("대로") || c.name.endsWith("로")));
            if (nextMajor) nextRoad = nextMajor.name;
        }

        if (candidates.length > 0) {
            const scored = candidates.map(c => ({
                ...c,
                score: scoreCandidate(c, stop.name || "", prevRoad, nextRoad, corridorRoads)
            })).sort((a, b) => b.score - a.score);

            const best = scored[0];
            snappedStops.push({
                rawCoord,
                coord: best.location,
                name: best.name,
                distance: best.distance,
                stopName: stop.name
            });
        } else {
            snappedStops.push({
                rawCoord,
                coord: rawCoord,
                name: "",
                distance: 0,
                stopName: stop.name
            });
        }
    }

    return snappedStops;
}

// Maximum allowed ratio of OSRM segment distance to straight-line distance.
const MAX_DETOUR_RATIO = 1.7;

// OSRM Route Snapper for a list of coordinates
async function fetchOsrmRoute(coords, osrmRouteUrl = DEFAULT_OSRM_URL, snapRadius = OSRM_SNAP_RADIUS) {
    if (coords.length < 2) return null;

    const coordsStr = coords.map(c => `${c[0].toFixed(6)},${c[1].toFixed(6)}`).join(";");
    let currentRadius = snapRadius;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        const radiuses = coords.map(() => Math.round(currentRadius)).join(";");
        const url = `${osrmRouteUrl}/${coordsStr}?overview=full&geometries=geojson&steps=false&continue_straight=true&radiuses=${radiuses}`;

        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(url, {signal: controller.signal});
            clearTimeout(timer);

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
                attempts++;
                currentRadius += 25;
            } else {
                attempts++;
            }
        } catch {
            attempts++;
            await new Promise(r => setTimeout(r, 200));
        }
    }

    return null;
}

// Process a single direction leg (UP or DOWN) from stops
async function processDirectionLeg(dirStops, stationMap, osrmUrl = DEFAULT_OSRM_URL) {
    const sorted = [...dirStops].sort((a, b) => Number(a.nodeord ?? a.ord) - Number(b.nodeord ?? b.ord));
    const stopsWithCoords = [];

    for (const s of sorted) {
        const rawId = typeof s.nodeid === "string" ? s.nodeid.trim() : (typeof s.id === "string" ? s.id.trim() : "");
        const station = rawId ? stationMap[rawId] : null;
        let lat = 0, lon = 0;
        if (station && Number.isFinite(station.gpslati) && Number.isFinite(station.gpslong)) {
            lat = station.gpslati;
            lon = station.gpslong;
        } else {
            lat = Number(s.gpslati ?? s.lat ?? 0);
            lon = Number(s.gpslong ?? s.lon ?? 0);
        }
        if (lat > 0 && lon > 0) {
            stopsWithCoords.push({
                id: rawId,
                name: String(s.nodenm ?? s.name ?? ""),
                ord: Number(s.nodeord ?? s.ord ?? 0),
                lat,
                lon,
            });
        }
    }

    if (stopsWithCoords.length < 2) {
        return {segmentHashes: [], segmentsMap: {}, totalDist: 0};
    }

    const osrmHost = osrmUrl.replace(/\/route\/v1\/driving\/?$/, "");

    // Phase 1: Smart pre-snapping to lock stops onto main road corridors
    const snapped = await smartSnapStops(stopsWithCoords, osrmHost);
    const validCoords = snapped.map(s => s.coord);

    // Phase 2: Route snapping along pre-snapped main road coordinates
    const osrmResult = await fetchOsrmRoute(validCoords, osrmUrl, 25);
    const segmentHashes = [];
    const segmentsMap = {};
    let totalDist = 0;

    if (osrmResult && osrmResult.coordinates.length >= validCoords.length) {
        // Break down OSRM polyline into segments between consecutive stops
        const fullLine = osrmResult.coordinates;
        let currIdx = 0;

        for (let i = 0; i < validCoords.length - 1; i++) {
            const target = validCoords[i + 1];
            let bestIdx = currIdx + 1;
            let bestDist = Infinity;

            for (let j = currIdx + 1; j < fullLine.length; j++) {
                const dist = getHaversineDistanceMeters(fullLine[j], target);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestIdx = j;
                }
            }

            let segCoords = fullLine.slice(currIdx, bestIdx + 1);
            const straightDist = getHaversineDistanceMeters(validCoords[i], validCoords[i + 1]);
            const segDist = getPolylineDistanceMeters(segCoords);

            // If slicing yielded < 2 points or experienced an index skip on overlapping loops
            if (segCoords.length < 2 || (straightDist > 60 && (segDist / straightDist) > 2.5)) {
                // Attempt direct pairwise OSRM query for this specific segment
                const pairRes = await fetchOsrmRoute([validCoords[i], validCoords[i + 1]], osrmUrl, 25);
                if (pairRes && pairRes.coordinates?.length >= 2) {
                    const pairDist = getPolylineDistanceMeters(pairRes.coordinates);
                    if (segCoords.length < 2 || pairDist < segDist) {
                        segCoords = pairRes.coordinates;
                    }
                }
            }

            if (segCoords.length < 2) {
                segCoords = [validCoords[i], validCoords[i + 1]];
            }

            const hash = computeSegmentHash(segCoords);
            segmentHashes.push(hash);
            segmentsMap[hash] = segCoords;
            totalDist += getPolylineDistanceMeters(segCoords);
            currIdx = bestIdx;
        }
    } else {
        // Fallback: segment-by-segment pairwise OSRM query
        for (let i = 0; i < validCoords.length - 1; i++) {
            const pairRes = await fetchOsrmRoute([validCoords[i], validCoords[i + 1]], osrmUrl, 25);
            let segCoords = (pairRes && pairRes.coordinates?.length >= 2) ? pairRes.coordinates : [validCoords[i], validCoords[i + 1]];

            const hash = computeSegmentHash(segCoords);
            segmentHashes.push(hash);
            segmentsMap[hash] = segCoords;
            totalDist += getPolylineDistanceMeters(segCoords);
        }
    }

    return {segmentHashes, segmentsMap, totalDist};
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

    // Load station map for stop coordinate resolution
    let stationMap = {};
    const stationMapFile = join(outputDir, "stationMap.json");
    if (existsSync(stationMapFile)) {
        try {
            stationMap = JSON.parse(readFileSync(stationMapFile, "utf-8")).stations || {};
        } catch {
            // Ignore error
        }
    }

    // Phase 2: Independent UP/DOWN Snapping & Segment Generation
    console.log("[Polly Phase 2] Processing UP and DOWN polylines...");
    const rawFiles = readdirSync(rawDir).filter(f => f.endsWith(".json"));
    const masterSegmentsMap = {};
    let processedCount = 0;

    for (const file of rawFiles) {
        if (options.routeFilter && !file.startsWith(options.routeFilter)) continue;

        try {
            const raw = JSON.parse(readFileSync(join(rawDir, file), "utf-8"));
            if (!raw.stops || raw.stops.length < 2) continue;

            const stops = raw.stops;
            const upStops = stops.filter(s => Number(s.updowncd ?? s.ud) === 1);
            const downStops = stops.filter(s => Number(s.updowncd ?? s.ud) === 0);

            const upRes = await processDirectionLeg(upStops, stationMap, options.osrmUrl);
            const downRes = await processDirectionLeg(downStops, stationMap, options.osrmUrl);

            // Connect UP end -> DOWN start and DOWN end -> UP start at turning points via OSRM
            if (upRes.segmentHashes.length > 0 && downRes.segmentHashes.length > 0) {
                const upCoords = upRes.segmentHashes.flatMap(s => upRes.segmentsMap[s] || []);
                const downCoords = downRes.segmentHashes.flatMap(s => downRes.segmentsMap[s] || []);

                if (upCoords.length > 0 && downCoords.length > 0) {
                    const upLast = upCoords[upCoords.length - 1];
                    const downFirst = downCoords[0];
                    const gap1 = getHaversineDistanceMeters(upLast, downFirst);
                    if (gap1 > 10 && gap1 < 10000) {
                        const osrmResult1 = await fetchOsrmRoute([upLast, downFirst], options.osrmUrl);
                        const connectSeg = (osrmResult1 && osrmResult1.coordinates?.length >= 2) ? osrmResult1.coordinates : [upLast, downFirst];
                        const hash = computeSegmentHash(connectSeg);
                        upRes.segmentsMap[hash] = connectSeg;
                        upRes.segmentHashes.push(hash);
                    }

                    const downLast = downCoords[downCoords.length - 1];
                    const upFirst = upCoords[0];
                    const gap2 = getHaversineDistanceMeters(downLast, upFirst);
                    if (gap2 > 10 && gap2 < 10000) {
                        const osrmResult2 = await fetchOsrmRoute([downLast, upFirst], options.osrmUrl);
                        const connectSeg = (osrmResult2 && osrmResult2.coordinates?.length >= 2) ? osrmResult2.coordinates : [downLast, upFirst];
                        const hash = computeSegmentHash(connectSeg);
                        downRes.segmentsMap[hash] = connectSeg;
                        downRes.segmentHashes.push(hash);
                    }
                }
            }

            // Merge segments into master lookup
            Object.assign(masterSegmentsMap, upRes.segmentsMap, downRes.segmentsMap);

            const polylineData = {
                route_id: raw.route_id,
                route_no: raw.route_no,
                stops_count: stops.length,
                total_dist: Math.round(upRes.totalDist + downRes.totalDist),
                up_segments: upRes.segmentHashes,
                down_segments: downRes.segmentHashes,
                stops: stops.map(s => ({
                    id: String(s.nodeid ?? s.id ?? ""),
                    name: String(s.nodenm ?? s.name ?? ""),
                    ord: Number(s.nodeord ?? s.ord ?? 0),
                    ud: Number(s.updowncd ?? s.ud ?? 0),
                    lat: Number(s.gpslati ?? s.lat ?? 0),
                    lon: Number(s.gpslong ?? s.lon ?? 0),
                })),
            };

            writeFileSync(join(derivedDir, `${raw.route_id}.json`), JSON.stringify(polylineData, null, 2));
            processedCount++;
            console.log(`[Polly Phase 2] (${processedCount}/${rawFiles.length}) Processed ${raw.route_no} (${raw.route_id}): UP=${upRes.segmentHashes.length} segs, DOWN=${downRes.segmentHashes.length} segs`);
        } catch (err) {
            console.error(`[Polly Phase 2] Error processing ${file}:`, err.message);
        }
    }

    // Existing segments.json preservation & merge (newly generated segments take precedence)
    let finalSegmentsMap = {...masterSegmentsMap};
    const existingSegmentsPath = join(derivedDir, "segments.json");
    if (existsSync(existingSegmentsPath)) {
        try {
            const existing = JSON.parse(readFileSync(existingSegmentsPath, "utf-8"));
            finalSegmentsMap = {...existing, ...masterSegmentsMap};
        } catch {
            // Ignore error
        }
    }

    writeFileSync(existingSegmentsPath, JSON.stringify(finalSegmentsMap, null, 2));
    console.log(`[Polly Phase 2] Complete. Processed ${processedCount} routes. Saved segments.json with ${Object.keys(finalSegmentsMap).length} segments.`);
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