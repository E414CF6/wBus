//! Bus Route Processing Module
//!
//! This module handles the collection and processing of bus route
//! information. It fetches raw route data from a public API, saves it,
//! and processes it into GeoJSON format suitable for frontend applications.

mod fetch;
mod model;
mod osrm;
mod process;

use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;
use futures::stream::{self, StreamExt};
use serde_json::Value;

use crate::config::{CONCURRENCY_FETCH, CONCURRENCY_SNAP, OSRM_URL, TAGO_URL};
use crate::route::model::BusRouteProcessor;
use crate::utils::{ensure_dir, get_env, parse_flexible_string, resolve_url};

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
