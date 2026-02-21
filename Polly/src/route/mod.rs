//! Bus Route Processing Module
//!
//! This module handles the collection and processing of bus route
//! information. It fetches raw route data from a public API, saves it,
//! and processes it into GeoJSON format suitable for frontend applications.

mod model;

use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::Result;
use chrono::Local;
use futures::stream::{self, StreamExt};
use serde_json::{Value, json};

use crate::config::{CONCURRENCY_FETCH, CONCURRENCY_SNAP, OSRM_CHUNK_SIZE, OSRM_URL, TAGO_URL};
use crate::route::model::{
    BusRouteProcessor, FrontendMeta, FrontendStop, RawRouteFile, RawStop, RouteFeature,
    RouteFeatureCollection, RouteGeometry, RouteIndices, RouteProcessData, RouteProperties,
};
use crate::utils::{
    ensure_dir, extract_items,
    geo::{calculate_metrics, closest_point_on_polyline, find_nearest_coord_index},
    get_env, parse_flexible_string, resolve_url,
};

// ============================================================================
// Argument Structure
// ============================================================================

#[derive(clap::Args)]
pub struct RouteArgs {
    /// City code to process (default: Wonju -> 32020)
    #[arg(long, default_value = "32020")]
    city_code: String,

    /// Specific route number (if not specified, all)
    #[arg(short, long)]
    route: Option<String>,

    /// Output directory
    #[arg(short, long, default_value = "./storage")]
    output_dir: PathBuf,

    /// Update station map only and skip snapping
    #[arg(long)]
    station_map_only: bool,

    /// Snap route paths using OSRM only (skip Tago API)
    #[arg(long)]
    osrm_only: bool,
}

// ============================================================================
// Main Execution
// ============================================================================

pub async fn run(args: RouteArgs) -> Result<()> {
    // Setup Directories
    let raw_dir = args.output_dir.join("cache");
    let derived_dir = args.output_dir.join("polylines");

    ensure_dir(&raw_dir)?;
    ensure_dir(&derived_dir)?;

    let service_key = get_env("DATA_GO_KR_SERVICE_KEY");
    if service_key.is_empty() {
        anyhow::bail!("DATA_GO_KR_SERVICE_KEY is missing!");
    }

    let processor = Arc::new(BusRouteProcessor {
        client: reqwest::Client::new(),
        service_key,
        city_code: args.city_code.clone(),
        raw_dir: raw_dir.clone(),
        derived_dir: derived_dir.clone(),
        mapping_file: args.output_dir.join("routeMap.json"),
        tago_base_url: resolve_url("TAGO_API_URL", TAGO_URL),
        osrm_base_url: resolve_url("OSRM_API_URL", OSRM_URL),
    });

    // [Phase 1] Data Collection (Raw Save)
    if !args.osrm_only {
        // Check if cache already exists
        let cache_file_count = fs::read_dir(&raw_dir)?
            .filter_map(|e| e.ok())
            .filter(|entry| entry.path().extension().map_or(false, |ext| ext == "json"))
            .count();

        if cache_file_count == 0 {
            // No cache exists, fetch from API
            log::info!("[Phase 1: Fetching Raw Data to {:?}]", raw_dir);

            let routes = processor.get_all_routes().await?;
            let target_routes: Vec<Value> = if let Some(target_no) = args.route.as_ref() {
                routes
                    .into_iter()
                    .filter(|r| parse_flexible_string(&r["routeno"]) == *target_no)
                    .collect()
            } else {
                routes
            };

            log::info!(" Targeting {} routes...", target_routes.len());

            let mut route_stream = stream::iter(target_routes)
                .map(|route| {
                    let proc = Arc::clone(&processor);
                    async move { proc.fetch_and_save_raw(route).await }
                })
                .buffer_unordered(CONCURRENCY_FETCH);

            // Aggregation for routeMap.json
            let mut all_stops = BTreeMap::new();
            let mut route_details_map = HashMap::new();
            let mut route_mapping: BTreeMap<String, Vec<String>> = BTreeMap::new();
            let mut count = 0usize;

            while let Some(result) = route_stream.next().await {
                match result {
                    Ok(Some(data)) => {
                        count += 1;
                        route_details_map.insert(data.route_id.clone(), data.details);
                        route_mapping
                            .entry(data.route_no)
                            .or_default()
                            .push(data.route_id);
                        for (id, val) in data.stops_map {
                            all_stops.insert(id, val);
                        }
                        if count % 10 == 0 {
                            log::debug!(".");
                        }
                    }
                    Ok(None) => {}
                    Err(e) => log::error!(" Error: {:?}", e),
                }
            }
            log::info!(" Processed {} raw routes.", count);

            processor
                .save_route_map_json(&route_mapping, &route_details_map, &all_stops)
                .await?;
        } else {
            // Cache exists, skip API calls
            log::info!(
                "Cache loaded with {} route files. Skipping Phase 1 (API fetch).",
                cache_file_count
            );

            // Verify that routeMap.json exists
            let route_map_path = args.output_dir.join("routeMap.json");
            if !route_map_path.exists() {
                anyhow::bail!(
                    "`routeMap.json` not found. Run without cache or delete {} to regenerate.",
                    raw_dir.display()
                );
            }
        }

        if args.station_map_only {
            log::info!("Station map generated.");
            return Ok(());
        }
    }

    // [Phase 2] Data Processing (Raw -> Derived)
    log::info!(
        "[Phase 2: Processing raw data to GeoJSON: {:?}]",
        derived_dir
    );

    // Load stationMap.json for accurate coordinates
    let station_map_path = args.output_dir.join("stationMap.json");
    let station_map: HashMap<String, Value> = if station_map_path.exists() {
        let content = tokio::fs::read_to_string(&station_map_path).await?;
        let json: Value = serde_json::from_str(&content)?;
        serde_json::from_value(json["stations"].clone()).unwrap_or_default()
    } else {
        HashMap::new()
    };
    let station_map_arc = Arc::new(station_map);

    // Read all JSONs from `cache/`
    let raw_entries: Vec<_> = fs::read_dir(&raw_dir)?.filter_map(|e| e.ok()).collect();

    // Process with concurrency
    let mut snap_stream = stream::iter(raw_entries)
        .map(|entry| {
            let proc = Arc::clone(&processor);
            let specific = args.route.clone();
            let smap = Arc::clone(&station_map_arc);

            async move {
                let path = entry.path();
                if path.extension().map_or(false, |ext| ext == "json") {
                    let fname = path.file_name().unwrap().to_string_lossy();

                    // Filter check
                    if let Some(ref target) = specific {
                        if !fname.starts_with(target) && !fname.contains(target) {
                            return Ok(());
                        }
                    }

                    log::info!("Processing {}...", fname);

                    proc.process_raw_to_derived(&path, &smap).await
                } else {
                    Ok(())
                }
            }
        })
        .buffer_unordered(CONCURRENCY_SNAP);

    while let Some(res) = snap_stream.next().await {
        if let Err(e) = res {
            log::error!("Processing failed: {:?}", e);
        }
    }

    log::info!("Pipeline Complete.");

    Ok(())
}

// ============================================================================
// Processor Implementation
// ============================================================================

impl BusRouteProcessor {
    // Phase 1 Logic

    async fn get_all_routes(&self) -> Result<Vec<Value>> {
        let params = [
            ("cityCode", self.city_code.as_str()),
            ("numOfRows", "2048"),
            ("pageNo", "1"),
            ("serviceKey", self.service_key.as_str()),
            ("_type", "json"),
        ];

        let url = format!("{}/getRouteNoList", self.tago_base_url);
        let resp: reqwest::Response = self.client.get(&url).query(&params).send().await?;
        let json: Value = resp.json().await?;

        extract_items(&json)
    }

    async fn fetch_and_save_raw(&self, route_info: Value) -> Result<Option<RouteProcessData>> {
        let route_id = route_info["routeid"]
            .as_str()
            .unwrap_or_default()
            .to_string();
        let route_no = parse_flexible_string(&route_info["routeno"]);

        if route_no == "UNKNOWN" || route_id.is_empty() {
            return Ok(None);
        }

        // Fetch Stops
        let params = [
            ("cityCode", self.city_code.as_str()),
            ("routeId", route_id.as_str()),
            ("numOfRows", "1024"),
            ("serviceKey", self.service_key.as_str()),
            ("_type", "json"),
        ];

        let url = format!("{}/getRouteAcctoThrghSttnList", self.tago_base_url);
        let resp: reqwest::Response = self.client.get(&url).query(&params).send().await?;

        let json: Value = match resp.json().await {
            Ok(v) => v,
            Err(_) => return Ok(None),
        };

        let items = extract_items(&json)?;
        if items.is_empty() {
            return Ok(None);
        }

        // Convert to internal RawStop
        let mut stops: Vec<RawStop> = items
            .iter()
            .map(|item| RawStop {
                node_id: item["nodeid"].as_str().unwrap_or("").to_string(),
                node_nm: item["nodenm"].as_str().unwrap_or("").to_string(),
                node_ord: item["nodeord"].as_i64().unwrap_or(0),
                node_no: parse_flexible_string(&item["nodeno"]),
                gps_lat: item["gpslati"].as_f64().unwrap_or(0.0),
                gps_long: item["gpslong"].as_f64().unwrap_or(0.0),
                up_down_cd: item["updowncd"]
                    .as_i64()
                    .or_else(|| item["updowncd"].as_str().and_then(|s| s.parse().ok()))
                    .unwrap_or(0),
            })
            .collect();

        stops.sort_by_key(|s| s.node_ord);

        // Generate Metadata for routeMap.json
        let sequence_meta: Vec<Value> = stops
            .iter()
            .map(|s| {
                json!({
                    "nodeid": s.node_id, "nodeord": s.node_ord, "updowncd": s.up_down_cd
                })
            })
            .collect();

        let stops_map_data: Vec<(String, Value)> = stops
            .iter()
            .map(|s| {
                (
                    s.node_id.clone(),
                    json!({
                        "nodenm": s.node_nm, "nodeno": s.node_no,
                        "gpslati": s.gps_lat, "gpslong": s.gps_long
                    }),
                )
            })
            .collect();

        // Save RAW file
        let raw_file = RawRouteFile {
            route_id: route_id.clone(),
            route_no: route_no.clone(),
            fetched_at: Local::now().to_rfc3339(),
            stops,
        };

        let file_path = self.raw_dir.join(format!("{}_{}.json", route_no, route_id));
        tokio::fs::write(file_path, serde_json::to_string_pretty(&raw_file)?).await?;

        Ok(Some(RouteProcessData {
            route_id,
            route_no: route_no.clone(),
            details: json!({ "routeno": route_no, "sequence": sequence_meta }),
            stops_map: stops_map_data,
        }))
    }

    // Phase 2 Logic
    async fn process_raw_to_derived(
        &self,
        raw_path: &Path,
        station_map: &HashMap<String, Value>,
    ) -> Result<()> {
        // Read Raw File
        let content = tokio::fs::read_to_string(raw_path).await?;
        let raw_data: RawRouteFile = serde_json::from_str(&content)?;

        let mut stops = raw_data.stops;

        // Apply coordinates from stationMap for accuracy
        for stop in &mut stops {
            if let Some(station_info) = station_map.get(&stop.node_id) {
                if let Some(lat) = station_info.get("gpslati").and_then(|v| v.as_f64()) {
                    stop.gps_lat = lat;
                }
                if let Some(lon) = station_info.get("gpslong").and_then(|v| v.as_f64()) {
                    stop.gps_long = lon;
                }
            }
        }

        // Sanitize coordinates (drift correction)
        self.sanitize_stops_to_corridor(&mut stops).await;

        if stops.len() < 2 {
            return Ok(());
        }

        let route_id = raw_data.route_id;
        let route_no = raw_data.route_no;

        // Identify Turning Point
        let mut turn_idx = stops.len() - 1;
        for i in 0..stops.len() - 1 {
            if stops[i].up_down_cd != stops[i + 1].up_down_cd {
                turn_idx = i;
                break;
            }
        }

        // OSRM Logic (Merging)
        let mut full_coordinates: Vec<Vec<f64>> = Vec::new();
        let mut stop_to_coord: Vec<usize> = Vec::with_capacity(stops.len());
        let mut start_idx = 0;

        while start_idx < stops.len() - 1 {
            let end_idx = (start_idx + OSRM_CHUNK_SIZE).min(stops.len());
            let chunk = &stops[start_idx..end_idx];

            if chunk.len() < 2 {
                break;
            }

            if let Some(coords) = self.fetch_osrm_route(chunk).await {
                let current_total = full_coordinates.len();

                // Merge Geometry
                let (to_append, _offset) = if current_total > 0 {
                    (&coords[1..], 0)
                } else {
                    (&coords[..], 0)
                };

                // Map Stops to Geometry
                for (i, stop) in chunk.iter().enumerate() {
                    let global_stop_idx = start_idx + i;
                    if global_stop_idx < stop_to_coord.len() {
                        continue;
                    }

                    if let Some(local_idx) =
                        find_nearest_coord_index((stop.gps_long, stop.gps_lat), &coords)
                    {
                        let global_coord_idx = if current_total > 0 {
                            if local_idx == 0 {
                                current_total - 1
                            } else {
                                current_total + local_idx - 1
                            }
                        } else {
                            local_idx
                        };
                        stop_to_coord.push(global_coord_idx);
                    } else {
                        stop_to_coord.push(current_total);
                    }
                }

                full_coordinates.extend_from_slice(to_append);
            }
            start_idx = end_idx - 1;
        }

        while stop_to_coord.len() < stops.len() {
            stop_to_coord.push(full_coordinates.len().saturating_sub(1));
        }

        // [OPTIMIZATION] Round coordinates to 6 decimal places to reduce file size
        // This is important for web performance
        for pt in &mut full_coordinates {
            for c in pt.iter_mut() {
                *c = (*c * 1_000_000.0).round() / 1_000_000.0;
            }
        }
        let optimized_coordinates = full_coordinates;

        // Derive Indices & Metrics
        let turn_coord_idx = stop_to_coord
            .get(turn_idx)
            .cloned()
            .unwrap_or(optimized_coordinates.len() / 2);

        // Calculate BBox & Distance using optimized coordinates
        let (bbox, total_dist) = calculate_metrics(&optimized_coordinates);

        // Build Frontend Data Structures
        let frontend_stops: Vec<FrontendStop> = stops
            .into_iter()
            .map(|s| FrontendStop {
                id: s.node_id,
                name: s.node_nm,
                ord: s.node_ord,
                up_down: s.up_down_cd,
            })
            .collect();

        let derived_data = RouteFeatureCollection {
            type_: "FeatureCollection".to_string(),
            features: vec![RouteFeature {
                type_: "Feature".to_string(),
                id: route_id.clone(),
                bbox: Some(bbox.to_vec()),
                geometry: RouteGeometry {
                    type_: "LineString".to_string(),
                    coordinates: optimized_coordinates,
                },
                properties: RouteProperties {
                    route_id: route_id.clone(),
                    route_no,
                    stops: frontend_stops,
                    indices: RouteIndices {
                        turn_idx: turn_coord_idx,
                        stop_to_coord,
                    },
                    meta: FrontendMeta {
                        total_dist,
                        source_ver: raw_data.fetched_at,
                    },
                },
            }],
        };

        // Save Derived File
        let output_path = self.derived_dir.join(format!("{}.geojson", route_id));
        tokio::fs::write(output_path, serde_json::to_string(&derived_data)?).await?;

        Ok(())
    }

    // Helpers (Sanitize, OSRM Fetch, Save Map)
    async fn sanitize_stops_to_corridor(&self, stops: &mut [RawStop]) {
        if stops.len() < 3 {
            return;
        }

        for i in 1..stops.len() - 1 {
            let corr = self
                .fetch_osrm_route_between(&stops[i - 1], &stops[i + 1])
                .await;
            if let Some(corr) = corr {
                let p = (stops[i].gps_long, stops[i].gps_lat);
                if let Some(((cx, cy), d)) = closest_point_on_polyline(p, &corr) {
                    if d <= 90.0 {
                        stops[i].gps_long = cx;
                        stops[i].gps_lat = cy;
                    }
                }
            }
        }
    }

    async fn fetch_osrm_route_between(&self, a: &RawStop, b: &RawStop) -> Option<Vec<Vec<f64>>> {
        let coords = format!(
            "{:.6},{:.6};{:.6},{:.6}",
            a.gps_long, a.gps_lat, b.gps_long, b.gps_lat
        );

        self.call_osrm(&coords).await
    }

    async fn fetch_osrm_route(&self, stops: &[RawStop]) -> Option<Vec<Vec<f64>>> {
        let coords = stops
            .iter()
            .map(|s| format!("{:.6},{:.6}", s.gps_long, s.gps_lat))
            .collect::<Vec<_>>()
            .join(";");

        self.call_osrm(&coords).await
    }

    async fn call_osrm(&self, coords_param: &str) -> Option<Vec<Vec<f64>>> {
        let url = format!(
            "{}/{coords}?overview=full&geometries=geojson&steps=false&continue_straight=true",
            self.osrm_base_url,
            coords = coords_param
        );

        let mut attempts = 0;
        let max_attempts = 3;

        while attempts < max_attempts {
            match self.client.get(&url).send().await {
                Ok(resp) => {
                    if !resp.status().is_success() {
                        log::error!("OSRM returned status: {} for URL: {}", resp.status(), url);
                        let err_text = resp.text().await.unwrap_or_default();
                        log::error!("OSRM Error response: {}", err_text);
                        return None;
                    }

                    let json: Value = match resp.json().await {
                        Ok(v) => v,
                        Err(e) => {
                            log::error!("Failed to parse OSRM JSON: {}", e);
                            return None;
                        }
                    };

                    let coords: Vec<Vec<f64>> = match serde_json::from_value(
                        json["routes"][0]["geometry"]["coordinates"].clone(),
                    ) {
                        Ok(c) => c,
                        Err(_) => return None,
                    };

                    if coords.is_empty() {
                        log::error!("OSRM returned empty coordinates array.");
                        return None;
                    } else {
                        return Some(coords);
                    }
                }
                Err(e) => {
                    attempts += 1;
                    if attempts < max_attempts {
                        log::warn!(
                            "OSRM request failed (attempt {}/{}): {}. Retrying in 500ms...",
                            attempts,
                            max_attempts,
                            e
                        );
                        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                    } else {
                        log::error!("OSRM request failed after {} attempts: {}", max_attempts, e);
                    }
                }
            }
        }

        None
    }

    async fn save_route_map_json(
        &self,
        map: &BTreeMap<String, Vec<String>>,
        details: &HashMap<String, Value>,
        stops: &BTreeMap<String, Value>,
    ) -> Result<()> {
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

        // Get base directory for all mapping files
        let base_dir = self.mapping_file.parent().unwrap();

        // Save routeMap.json (route_numbers only)
        let route_map = json!({
            "lastUpdated": timestamp,
            "route_numbers": map,
        });
        tokio::fs::write(
            &self.mapping_file,
            serde_json::to_string_pretty(&route_map)?,
        )
        .await?;

        // Save routeDetails.json
        let route_details = json!({
            "lastUpdated": timestamp,
            "route_details": details,
        });
        tokio::fs::write(
            base_dir.join("routeDetails.json"),
            serde_json::to_string_pretty(&route_details)?,
        )
        .await?;

        // Save stationMap.json
        let station_map = json!({
            "lastUpdated": timestamp,
            "stations": stops,
        });
        tokio::fs::write(
            base_dir.join("stationMap.json"),
            serde_json::to_string_pretty(&station_map)?,
        )
        .await?;

        Ok(())
    }
}
