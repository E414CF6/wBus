use std::collections::HashMap;
use std::path::Path;

use anyhow::Result;
use serde_json::Value;

use crate::config::OSRM_CHUNK_SIZE;
use crate::route::model::{
    BusRouteProcessor, FrontendMeta, FrontendStop, RawRouteFile, RouteFeature,
    RouteFeatureCollection, RouteGeometry, RouteIndices, RouteProperties,
};
use crate::utils::geo::{calculate_metrics, find_nearest_coord_index};

impl BusRouteProcessor {
    pub async fn process_raw_to_derived(
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
}
