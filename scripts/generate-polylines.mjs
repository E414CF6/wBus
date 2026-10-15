#!/usr/bin/env node

/**
 * Polyline Generation Pipeline Script
 *
 * Consolidates TAGO API route collection, OSRM snapping with fallback,
 * and pre-assembled GeoJSON polyline generation.
 *
 * Pipeline Flow:
 *   1. Generates & caches all outputs in `scripts/cache/`
 *   2. Synchronizes polyline artifacts (`routeMap.json`, `stationMap.json`, `routes/*.json`)
 *      into `public/` while leaving other files (e.g. `schedule.json`, `styles/*`) intact.
 *
 * Features:
 *   - Independent UP (ud=1) and DOWN (ud=0) route snapping and polyline assembly
 *   - OSRM route snapping with automatic straight-line fallback if OSRM is unavailable
 *   - Pre-assembled GeoJSON [lng, lat] coordinate polylines directly baked into routes/*.json
 *   - Cache-first output strategy for safe atomic publishing to public/
 *   - Complete telemetry and error reporting
 * Usage:
 *   node scripts/generate-polylines.mjs [--route <no>] [--city-code 32020] [--force] [--station-map-only] [--osrm-only] [--no-sync]
 *
 * Defaults to the official OSRM public server (https://router.project-osrm.org).
 * Set OSRM_API_URL to use a custom or self-hosted endpoint.
 */

import dotenv from "dotenv";
import {copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "fs";
import {join} from "path";

// Load environment variables (.env.local priority, fallback to .env)
dotenv.config({path: join(process.cwd(), ".env.local")});
dotenv.config({path: join(process.cwd(), ".env")});

// Configuration Defaults
const DEFAULT_CITY_CODE = "32020"; // Wonju
const DEFAULT_TAGO_URL = "https://apis.data.go.kr/1613000/BusRouteInfoInqireService";
const DEFAULT_OSRM_URL = process.env.OSRM_API_URL || "https://router.project-osrm.org/route/v1/driving";
const FALLBACK_OSRM_URL = "https://routing.openstreetmap.de/routed-car/route/v1/driving";
const OSRM_SNAP_RADIUS = 25; // Meters (conservative: prefer main road snapping, avoid alleys)
const OSRM_REQUEST_DELAY_MS = 150; // Throttling delay for public OSRM server fair use policy
const OSRM_CHUNK_SIZE = 25; // Safe waypoint batch size to avoid URL length / capacity limits
const CONCURRENCY_FETCH = 3;

function isRemoteOsrm(url) {
    return typeof url === "string" && !url.includes("localhost") && !url.includes("127.0.0.1");
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}


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

// Calculate bearing in degrees (0-360) between two [lng, lat] coordinates accurately
function calculateBearing(p1, p2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;
    const phi1 = toRad(p1[1]);
    const phi2 = toRad(p2[1]);
    const dLambda = toRad(p2[0] - p1[0]);
    const y = Math.sin(dLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
    return Math.round((toDeg(Math.atan2(y, x)) + 360) % 360);
}

// Clean U-turn spur loops caused by dual-carriageway opposite lane snapping
function cleanSpurLoops(coords) {
    if (!coords || coords.length < 5) return coords;
    let res = coords;
    const dest = res[res.length - 1];
    const startDistToDest = getHaversineDistanceMeters(res[0], dest);

    // 1. Detect start spur (moves away from destination, U-turns, and returns toward destination)
    let maxDistFromStart = 0;
    let uTurnIdx = -1;
    for (let i = 1; i < Math.min(res.length - 2, 15); i++) {
        const dDest = getHaversineDistanceMeters(res[i], dest);
        const dStart = getHaversineDistanceMeters(res[0], res[i]);
        if (dDest > startDistToDest + 15) {
            if (dStart > maxDistFromStart) maxDistFromStart = dStart;
        } else if (maxDistFromStart > 25 && dDest <= startDistToDest + 5) {
            uTurnIdx = i;
            break;
        }
    }
    if (uTurnIdx > 0) {
        res = res.slice(uTurnIdx);
    }

    // 2. Detect end spur (passes destination, U-turns, and backtracks to destination)
    if (res.length >= 5) {
        const start = res[0];
        const endDistToStart = getHaversineDistanceMeters(start, res[res.length - 1]);
        let maxDistFromEnd = 0;
        let endUTurnIdx = -1;
        for (let i = res.length - 2; i >= Math.max(1, res.length - 15); i--) {
            const dStart = getHaversineDistanceMeters(start, res[i]);
            const dEnd = getHaversineDistanceMeters(res[i], res[res.length - 1]);
            if (dStart > endDistToStart + 15) {
                if (dEnd > maxDistFromEnd) maxDistFromEnd = dEnd;
            } else if (maxDistFromEnd > 25 && dStart <= endDistToStart + 5) {
                endUTurnIdx = i;
                break;
            }
        }
        if (endUTurnIdx > 0) {
            res = res.slice(0, endUTurnIdx + 1);
        }
    }

    return res;
}

// Candidate scoring function relying purely on geometric proximity and corridor continuity
// (Road hierarchy and alley avoidance are handled inherently by OSRM bus.lua)
// Candidate scoring function prioritizing official named transit corridors over unnamed alleys/parking lots
function scoreCandidate(cand, stopName, prevRoad, nextRoad, corridorRoads, roadFreq) {
    // Pure geometric distance is the baseline (closer is better)
    let score = -cand.distance;
    const name = (cand.name || "").trim();

    // Significant bonus for officially named public roads over unnamed alleys, driveways, parking entries
    if (name) {
        score += 15; // 15m tolerance: named road beats unnamed alley/parking entry
        if (prevRoad && name === prevRoad) score += 10;
        if (nextRoad && name === nextRoad) score += 10;
        if (corridorRoads && corridorRoads.has(name)) score += 5;
    }

    return score;
}

// Smart Stop Coordinate Snapper
async function smartSnapStops(stops, osrmHost) {
    // When using remote public OSRM servers (router.project-osrm.org), skip per-stop /nearest queries.
    // The /route/v1/driving API automatically snaps coordinates within `radiuses` meters,
    // avoiding thousands of rate-limited HTTP roundtrips on public infrastructure.
    if (isRemoteOsrm(osrmHost)) {
        return stops.map((s) => ({
            rawCoord: [s.lon, s.lat], coord: [s.lon, s.lat], name: s.name || "", distance: 0, stopName: s.name,
        }));
    }

    const roadFreq = {};
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
                const cname = (c.name || "").trim();
                if (cname) {
                    roadFreq[cname] = (roadFreq[cname] || 0) + 1;
                }
            }
        }
    }

    // Dominant corridors are roads appearing at least twice or the most frequent roads on the route
    const corridorRoads = new Set(Object.entries(roadFreq).filter(([_, count]) => count >= 2).map(([name]) => name));

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
            // Find highest-confidence candidate of next stop
            const nextCands = stopCandidates[i + 1].candidates;
            const nextDominant = nextCands.find(c => c.name && corridorRoads.has(c.name)) || nextCands[0];
            if (nextDominant && nextDominant.name) nextRoad = nextDominant.name;
        }

        if (candidates.length > 0) {
            const scored = candidates.map(c => ({
                ...c, score: scoreCandidate(c, stop.name || "", prevRoad, nextRoad, corridorRoads, roadFreq)
            })).sort((a, b) => b.score - a.score);

            const best = scored[0];
            snappedStops.push({
                rawCoord, coord: best.location, name: best.name, distance: best.distance, stopName: stop.name
            });
        } else {
            snappedStops.push({
                rawCoord, coord: rawCoord, name: "", distance: 0, stopName: stop.name
            });
        }
    }

    return snappedStops;
}

// Single chunk OSRM query with fallback server & retry support
async function fetchOsrmSingleChunk(coords, osrmRouteUrl = DEFAULT_OSRM_URL, snapRadius = OSRM_SNAP_RADIUS, bearings = null) {
    if (coords.length < 2) return null;

    const coordsStr = coords.map(c => `${c[0].toFixed(6)},${c[1].toFixed(6)}`).join(";");
    const urlsToTry = [osrmRouteUrl];
    if (FALLBACK_OSRM_URL && FALLBACK_OSRM_URL !== osrmRouteUrl) {
        urlsToTry.push(FALLBACK_OSRM_URL);
    }

    for (const activeUrl of urlsToTry) {
        let currentRadius = snapRadius;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            const radiuses = coords.map(() => Math.round(currentRadius)).join(";");
            let url = `${activeUrl}/${coordsStr}?overview=full&geometries=geojson&steps=false&continue_straight=true&radiuses=${radiuses}`;
            if (bearings && attempts === 0 && bearings.length === coords.length) {
                url += `&bearings=${bearings.join(";")}`;
            }

            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 8000);
                const res = await fetch(url, {
                    headers: {"User-Agent": "wBus-Transit-Pipeline/2.0 (https://github.com/kernelily/wBus)"},
                    signal: controller.signal,
                });
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
                } else if (res.status === 429) {
                    attempts++;
                    await sleep(1000 * attempts);
                } else if (res.status === 400) {
                    attempts++;
                    currentRadius += 25;
                } else {
                    attempts++;
                }
            } catch {
                attempts++;
                await sleep(300 * attempts);
            }
        }
    }

    return null;
}

// OSRM Route Snapper supporting automatic chunking for long routes on public servers
async function fetchOsrmRoute(coords, osrmRouteUrl = DEFAULT_OSRM_URL, snapRadius = OSRM_SNAP_RADIUS, bearings = null) {
    if (coords.length < 2) return null;

    // For long stop sequences on public servers, chunk into smaller segments to avoid URL length & server capacity limits
    if (coords.length > OSRM_CHUNK_SIZE) {
        const fullCoords = [];
        let totalDist = 0;
        let totalDuration = 0;

        for (let i = 0; i < coords.length - 1; i += OSRM_CHUNK_SIZE - 1) {
            const endIdx = Math.min(i + OSRM_CHUNK_SIZE, coords.length);
            const chunk = coords.slice(i, endIdx);
            if (chunk.length < 2) break;

            const chunkBearings = bearings ? bearings.slice(i, endIdx) : null;
            const res = await fetchOsrmSingleChunk(chunk, osrmRouteUrl, snapRadius, chunkBearings);

            if (res && res.coordinates?.length > 0) {
                if (fullCoords.length === 0) {
                    fullCoords.push(...res.coordinates);
                } else {
                    fullCoords.push(...res.coordinates.slice(1));
                }
                totalDist += res.distance || 0;
                totalDuration += res.duration || 0;
            } else {
                // Straight-line fallback for this chunk
                if (fullCoords.length === 0) {
                    fullCoords.push(...chunk);
                } else {
                    fullCoords.push(...chunk.slice(1));
                }
                totalDist += getPolylineDistanceMeters(chunk);
            }

            if (isRemoteOsrm(osrmRouteUrl)) {
                await sleep(OSRM_REQUEST_DELAY_MS);
            }
        }

        return {
            coordinates: fullCoords, distance: totalDist, duration: totalDuration,
        };
    }

    const result = await fetchOsrmSingleChunk(coords, osrmRouteUrl, snapRadius, bearings);
    if (isRemoteOsrm(osrmRouteUrl)) {
        await sleep(OSRM_REQUEST_DELAY_MS);
    }
    return result;
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
                id: rawId, name: String(s.nodenm ?? s.name ?? ""), ord: Number(s.nodeord ?? s.ord ?? 0), lat, lon,
            });
        }
    }

    if (stopsWithCoords.length < 2) {
        return {polyline: [], totalDist: 0};
    }

    const osrmHost = osrmUrl.replace(/\/route\/v1\/driving\/?$/, "");

    // Phase 1: Smart-snap stop coordinates to dominant arterial/corridor roads
    const snapped = await smartSnapStops(stopsWithCoords, osrmHost);
    const validCoords = snapped.map(s => s.coord);

    // Phase 2: Compute directional travel bearings along sequence
    const bearings = [];
    for (let i = 0; i < validCoords.length; i++) {
        if (i < validCoords.length - 1) {
            const b = calculateBearing(validCoords[i], validCoords[i + 1]);
            bearings.push(`${b},60`);
        } else {
            const b = calculateBearing(validCoords[i - 1], validCoords[i]);
            bearings.push(`${b},60`);
        }
    }

    // Route snapping along pre-snapped main road coordinates with forward bearings
    const osrmResult = await fetchOsrmRoute(validCoords, osrmUrl, 25, bearings);
    const polyline = [];
    let totalDist = 0;

    const appendCoords = (coords) => {
        if (!coords || coords.length === 0) return;
        if (polyline.length === 0) {
            polyline.push(...coords);
        } else {
            polyline.push(...coords.slice(1));
        }
    };

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

            // If slicing yielded < 2 points or experienced an abnormal detour/loop (> 2.0x straight distance)
            if (segCoords.length < 2 || (straightDist > 60 && (segDist / straightDist) > 2.0)) {
                // Attempt direct pairwise OSRM query with forward directional bearings
                const b = calculateBearing(validCoords[i], validCoords[i + 1]);
                const pairRes = await fetchOsrmRoute([validCoords[i], validCoords[i + 1]], osrmUrl, 15, [`${b},60`, `${b},60`]);
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

            segCoords = cleanSpurLoops(segCoords);
            appendCoords(segCoords);
            totalDist += getPolylineDistanceMeters(segCoords);
            currIdx = bestIdx;
        }
    } else {
        if (isRemoteOsrm(osrmUrl)) {
            // For remote public servers, avoid N individual pairwise queries on failure to prevent rate-limiting;
            // fallback gracefully to straight segments between consecutive stops.
            for (let i = 0; i < validCoords.length - 1; i++) {
                const segCoords = [validCoords[i], validCoords[i + 1]];
                appendCoords(segCoords);
                totalDist += getPolylineDistanceMeters(segCoords);
            }
        } else {
            // Local OSRM fallback: segment-by-segment pairwise query
            for (let i = 0; i < validCoords.length - 1; i++) {
                const pairRes = await fetchOsrmRoute([validCoords[i], validCoords[i + 1]], osrmUrl, 25);
                let segCoords = (pairRes && pairRes.coordinates?.length >= 2) ? pairRes.coordinates : [validCoords[i], validCoords[i + 1]];
                appendCoords(segCoords);
                totalDist += getPolylineDistanceMeters(segCoords);
            }
        }
    }

    return {polyline, totalDist};
}

// Synchronize cached polyline files from scripts/cache to public
function syncCacheToPublic(cacheDir, publicDir) {
    if (!existsSync(publicDir)) mkdirSync(publicDir, {recursive: true});

    const singleFiles = ["routeMap.json", "stationMap.json"];
    let copiedFiles = 0;

    for (const fileName of singleFiles) {
        const src = join(cacheDir, fileName);
        const dest = join(publicDir, fileName);
        if (existsSync(src)) {
            copyFileSync(src, dest);
            copiedFiles++;
        }
    }

    // Sync route/*.json to public/routes/*.json
    const cacheRouteDir = join(cacheDir, "route");
    const publicRoutesDir = join(publicDir, "routes");
    if (existsSync(cacheRouteDir)) {
        if (!existsSync(publicRoutesDir)) mkdirSync(publicRoutesDir, {recursive: true});
        const routeFiles = readdirSync(cacheRouteDir).filter(f => f.endsWith(".json"));
        for (const file of routeFiles) {
            copyFileSync(join(cacheRouteDir, file), join(publicRoutesDir, file));
            copiedFiles++;
        }
    }

    console.log(`[Polly Sync] Copied ${copiedFiles} cached files to ${publicDir}`);
}

// Main Pipeline Logic
async function runRoutePipeline(options) {
    const scriptsCacheDir = options.cacheDir || join(process.cwd(), "scripts", "cache");
    const outputDir = options.outputDir || join(process.cwd(), "public");
    const routesCacheFile = join(scriptsCacheDir, "routes.json");
    const cacheDerivedDir = join(scriptsCacheDir, "route");

    if (!existsSync(scriptsCacheDir)) mkdirSync(scriptsCacheDir, {recursive: true});
    if (!existsSync(cacheDerivedDir)) mkdirSync(cacheDerivedDir, {recursive: true});

    console.log(`[Polly] Starting Polyline Pipeline (Cache: ${scriptsCacheDir} -> Target: ${outputDir})...`);

    // Load existing routes cache if present
    let routesCache = {};
    if (existsSync(routesCacheFile)) {
        try {
            const raw = JSON.parse(readFileSync(routesCacheFile, "utf-8"));
            if (Array.isArray(raw)) {
                raw.forEach(r => {
                    if (r.route_id) routesCache[r.route_id] = r;
                });
            } else if (raw && typeof raw === "object") {
                routesCache = raw;
            }
        } catch {
            routesCache = {};
        }
    }

    let targetRoutes = [];
    if (!options.osrmOnly) {
        console.log("[Polly Phase 1] Fetching Route List from TAGO API...");
        const allRoutes = await fetchTago("getRouteNoList", {
            cityCode: options.cityCode || DEFAULT_CITY_CODE, numOfRows: 2048, pageNo: 1,
        });

        targetRoutes = allRoutes.filter(r => {
            const routeNo = String(r.routeno || "");
            if (!routeNo || routeNo === "UNKNOWN") return false;
            if (options.routeFilter && routeNo !== options.routeFilter) return false;
            return true;
        });

        console.log(`[Polly Phase 1] Found ${targetRoutes.length} matching routes.`);

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
                        cityCode: options.cityCode || DEFAULT_CITY_CODE, routeId, numOfRows: 2048,
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

                    // Update single cached routes object
                    routesCache[routeId] = {
                        route_id: routeId, route_no: routeNo, fetched_at: new Date().toISOString(), stops,
                    };

                    // Aggregate mapping metadata
                    if (!routeMapping[routeNo]) routeMapping[routeNo] = [];
                    if (!routeMapping[routeNo].includes(routeId)) routeMapping[routeNo].push(routeId);

                    stops.forEach(s => {
                        allStopsMap[s.nodeid] = {
                            nodenm: s.nodenm, nodeno: s.nodeno, gpslati: s.gpslati, gpslong: s.gpslong,
                        };
                    });
                } catch (err) {
                    console.error(`[Polly] Failed fetching stops for route ${routeNo} (${routeId}):`, err.message);
                }
            }));
            process.stdout.write(`Progress: ${Math.min(i + CONCURRENCY_FETCH, targetRoutes.length)} / ${targetRoutes.length}\r`);
        }

        // Save consolidated scripts/cache/routes.json
        writeFileSync(routesCacheFile, JSON.stringify(routesCache, null, 2));
        console.log(`\n[Polly Phase 1] Saved ${Object.keys(routesCache).length} routes to ${routesCacheFile}`);

        // Save mapping JSON files into cache directory
        const timestamp = new Date().toISOString();
        writeFileSync(join(scriptsCacheDir, "routeMap.json"), JSON.stringify({
            lastUpdated: timestamp, route_numbers: routeMapping
        }, null, 2));
        writeFileSync(join(scriptsCacheDir, "stationMap.json"), JSON.stringify({
            lastUpdated: timestamp, stations: allStopsMap
        }, null, 2));
        console.log("[Polly Phase 1] Generated cache/routeMap.json, cache/stationMap.json.");
    }

    if (options.stationMapOnly) {
        if (!options.noSync) {
            syncCacheToPublic(scriptsCacheDir, outputDir);
        }
        return;
    }

    // Load station map for stop coordinate resolution (check cache first, fallback to public)
    let stationMap = {};
    const cacheStationMapFile = join(scriptsCacheDir, "stationMap.json");
    const publicStationMapFile = join(outputDir, "stationMap.json");
    const stationMapFile = existsSync(cacheStationMapFile) ? cacheStationMapFile : publicStationMapFile;

    if (existsSync(stationMapFile)) {
        try {
            stationMap = JSON.parse(readFileSync(stationMapFile, "utf-8")).stations || {};
        } catch {
            // Ignore error
        }
    }

    // Phase 2: Independent UP/DOWN Snapping & Segment Generation
    console.log("[Polly Phase 2] Processing UP and DOWN polylines from scripts/cache/routes.json...");
    const cachedRoutesList = Object.values(routesCache);
    let processedCount = 0;

    for (const raw of cachedRoutesList) {
        if (options.routeFilter && raw.route_no !== options.routeFilter && !raw.route_no.startsWith(options.routeFilter)) continue;
        if (!raw.stops || raw.stops.length < 2) continue;

        // Incremental generation: Skip if already baked and stop count matches (unless --force is specified)
        const targetCacheFile = join(cacheDerivedDir, `${raw.route_id}.json`);
        const existingPublicFile = join(outputDir, "routes", `${raw.route_id}.json`);
        const existingFile = existsSync(targetCacheFile) ? targetCacheFile : (existsSync(existingPublicFile) ? existingPublicFile : null);

        if (!options.force && existingFile) {
            try {
                const existingData = JSON.parse(readFileSync(existingFile, "utf-8"));
                if (existingData.stops_count === raw.stops.length && Array.isArray(existingData.up_polyline) && Array.isArray(existingData.down_polyline) && (existingData.up_polyline.length > 0 || existingData.down_polyline.length > 0)) {
                    if (existingFile !== targetCacheFile) {
                        copyFileSync(existingFile, targetCacheFile);
                    }
                    processedCount++;
                    continue;
                }
            } catch {
                // Ignore parse error and re-generate
            }
        }

        try {
            const stops = raw.stops;
            const upStops = stops.filter(s => Number(s.updowncd ?? s.ud) === 1);
            const downStops = stops.filter(s => Number(s.updowncd ?? s.ud) === 0);

            const upRes = await processDirectionLeg(upStops, stationMap, options.osrmUrl);
            const downRes = await processDirectionLeg(downStops, stationMap, options.osrmUrl);

            // Connect turning point via OSRM. The connecting segment has passed the turning point,
            // so if transitioning from DOWN to UP, it must be included in the UP polyline (at the beginning).
            // If transitioning from UP to DOWN, it must be included in the DOWN polyline (at the beginning).
            if (upRes.polyline.length > 0 && downRes.polyline.length > 0) {
                // Determine direction transition from sorted stops
                const sortedStops = [...stops].sort((a, b) => Number(a.nodeord ?? a.ord ?? 0) - Number(b.nodeord ?? b.ord ?? 0));
                let turningDir = null;
                for (let i = 0; i < sortedStops.length - 1; i++) {
                    const cUd = Number(sortedStops[i].updowncd ?? sortedStops[i].ud ?? 0);
                    const nUd = Number(sortedStops[i + 1].updowncd ?? sortedStops[i + 1].ud ?? 0);
                    if (cUd === 0 && nUd === 1) {
                        turningDir = "down_to_up";
                        break;
                    } else if (cUd === 1 && nUd === 0) {
                        turningDir = "up_to_down";
                        break;
                    }
                }

                if (turningDir === "down_to_up") {
                    const downLast = downRes.polyline[downRes.polyline.length - 1];
                    const upFirst = upRes.polyline[0];
                    const gap = getHaversineDistanceMeters(downLast, upFirst);
                    if (gap > 5 && gap < 15000) {
                        const osrmResult = await fetchOsrmRoute([downLast, upFirst], options.osrmUrl);
                        let connectSeg = (osrmResult && osrmResult.coordinates?.length >= 2) ? [...osrmResult.coordinates] : [downLast, upFirst];
                        connectSeg = cleanSpurLoops(connectSeg);
                        connectSeg[0] = downLast;
                        connectSeg[connectSeg.length - 1] = upFirst;
                        // Prepend connectSeg to UP polyline (excluding duplicate junction coordinate at end)
                        upRes.polyline = [...connectSeg.slice(0, -1), ...upRes.polyline];
                        upRes.totalDist += getPolylineDistanceMeters(connectSeg);
                    }
                } else if (turningDir === "up_to_down") {
                    const upLast = upRes.polyline[upRes.polyline.length - 1];
                    const downFirst = downRes.polyline[0];
                    const gap = getHaversineDistanceMeters(upLast, downFirst);
                    if (gap > 5 && gap < 15000) {
                        const osrmResult = await fetchOsrmRoute([upLast, downFirst], options.osrmUrl);
                        let connectSeg = (osrmResult && osrmResult.coordinates?.length >= 2) ? [...osrmResult.coordinates] : [upLast, downFirst];
                        connectSeg = cleanSpurLoops(connectSeg);
                        connectSeg[0] = upLast;
                        connectSeg[connectSeg.length - 1] = downFirst;
                        // Prepend connectSeg to DOWN polyline (excluding duplicate junction coordinate at end)
                        downRes.polyline = [...connectSeg.slice(0, -1), ...downRes.polyline];
                        downRes.totalDist += getPolylineDistanceMeters(connectSeg);
                    }
                }
            }

            const upPolyline = upRes.polyline;
            const downPolyline = downRes.polyline;

            const polylineData = {
                route_id: raw.route_id,
                route_no: raw.route_no,
                stops_count: stops.length,
                total_dist: Math.round(upRes.totalDist + downRes.totalDist),
                up_polyline: upPolyline,
                down_polyline: downPolyline,
                stops: stops.map(s => {
                    const stId = String(s.nodeid ?? s.id ?? "");
                    return {
                        id: stId,
                        name: String(s.nodenm ?? s.name ?? ""),
                        ord: Number(s.nodeord ?? s.ord ?? 0),
                        ud: Number(s.updowncd ?? s.ud ?? 0),
                        lat: Number(s.gpslati ?? s.lat ?? 0),
                        lon: Number(s.gpslong ?? s.lon ?? 0),
                        nodeno: String(s.nodeno || stationMap[stId]?.nodeno || ""),
                    };
                }),
            };

            // Write route file to cache
            writeFileSync(join(cacheDerivedDir, `${raw.route_id}.json`), JSON.stringify(polylineData, null, 2));
            processedCount++;
            console.log(`[Polly Phase 2] (${processedCount}/${cachedRoutesList.length}) Processed ${raw.route_no} (${raw.route_id}): UP=${upPolyline.length} pts, DOWN=${downPolyline.length} pts`);
        } catch (err) {
            console.error(`[Polly Phase 2] Error processing route ${raw.route_no} (${raw.route_id}):`, err.message);
        }
    }

    console.log(`[Polly Phase 2] Complete. Processed ${processedCount} routes with pre-assembled polylines.`);

    // Phase 3: Synchronize cache output into public
    if (!options.noSync) {
        console.log("[Polly Phase 3] Synchronizing cached polyline artifacts to public...");
        syncCacheToPublic(scriptsCacheDir, outputDir);
    }
}

// CLI Command Handler
async function main() {
    const args = process.argv.slice(2);

    const options = {
        cityCode: DEFAULT_CITY_CODE,
        routeFilter: null,
        force: args.includes("--force"),
        stationMapOnly: args.includes("--station-map-only"),
        osrmOnly: args.includes("--osrm-only"),
        noSync: args.includes("--no-sync"),
        osrmUrl: DEFAULT_OSRM_URL,
        cacheDir: join(process.cwd(), "scripts", "cache"),
        outputDir: join(process.cwd(), "public"),
    };

    const routeIdx = args.indexOf("--route");
    if (routeIdx !== -1 && args[routeIdx + 1]) {
        options.routeFilter = args[routeIdx + 1];
    }

    const cityIdx = args.indexOf("--city-code");
    if (cityIdx !== -1 && args[cityIdx + 1]) {
        options.cityCode = args[cityIdx + 1];
    }

    await runRoutePipeline(options);
    console.log("[Polly] Polyline Pipeline Finished Successfully!");
}

main().catch(err => {
    console.error("[Polly] Pipeline failed:", err);
    process.exit(1);
});
