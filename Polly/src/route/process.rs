use std::collections::HashMap;
use std::path::Path;

use anyhow::Result;
use serde_json::Value;

use crate::config::OSRM_CHUNK_SIZE;
use crate::route::model::{
    BusRouteProcessor, FrontendMeta, FrontendStop, RawRouteFile, RouteSnapData,
};
use crate::utils::geo::{calculate_metrics, find_nearest_coord_index};

impl BusRouteProcessor {
    pub async fn process_raw_to_derived(
        &self,
        raw_path: &Path,
        station_map: &HashMap<String, Value>,
    ) -> Result<HashMap<String, Vec<Vec<f64>>>> {
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
            return Ok(HashMap::new());
        }

        let route_id = raw_data.route_id;
        let route_no = raw_data.route_no;

        // Identify Turning Point
        // Find the physically farthest stop from the start terminal.
        let mut max_dist = 0.0;
        let start_stop = &stops[0];
        let mut farthest_idx = stops.len().saturating_sub(1);
        if stops.len() > 2 {
            for i in 1..stops.len() - 1 {
                let dist = (stops[i].gps_long - start_stop.gps_long).powi(2)
                    + (stops[i].gps_lat - start_stop.gps_lat).powi(2);
                if dist > max_dist {
                    max_dist = dist;
                    farthest_idx = i;
                }
            }
        }

        let mut transitions = 0;
        let mut first_transition_idx = 0;
        if stops.len() > 1 {
            let mut last_cd = stops[0].up_down_cd;
            for i in 1..stops.len() {
                if stops[i].up_down_cd != last_cd {
                    transitions += 1;
                    if transitions == 1 {
                        first_transition_idx = i - 1;
                    }
                    last_cd = stops[i].up_down_cd;
                }
            }
        }

        let mut turn_idx = farthest_idx;

        if transitions == 1 {
            let dist_at_transition = (stops[first_transition_idx].gps_long - start_stop.gps_long)
                .powi(2)
                + (stops[first_transition_idx].gps_lat - start_stop.gps_lat).powi(2);

            // If the administrative transition point is at least ~70% as far as the absolute farthest point,
            // we trust it (0.7^2 ≈ 0.5). Otherwise, it's a premature turnaround anomaly!
            if dist_at_transition >= max_dist * 0.4 {
                turn_idx = first_transition_idx;
            } else {
                log::warn!(
                    "Premature turnaround detected in route {}. Admin transition at {}, but farthest is {}. Using farthest.",
                    route_no,
                    first_transition_idx,
                    farthest_idx
                );
            }
        } else {
            if transitions > 1 {
                log::warn!(
                    "Noisy up_down_cd data ({} transitions) in route {}. Using farthest point at {}.",
                    transitions,
                    route_no,
                    farthest_idx
                );
            }
        }

        // [CRITICAL NORMALIZATION]
        // Force the first half of the route (outbound from terminal) to always be ud = 0 (Downbound/Red).
        // Force the second half of the route (inbound to terminal) to always be ud = 1 (Upbound/Blue).
        // This permanently fixes buggy provider data where ud is swapped or constant!
        for i in 0..=turn_idx {
            stops[i].up_down_cd = 0;
        }
        for i in turn_idx + 1..stops.len() {
            stops[i].up_down_cd = 1;
        }

        // OSRM Logic (Merging)
        let mut full_coordinates: Vec<Vec<f64>> = Vec::new();
        let mut stop_to_coord: Vec<usize> = Vec::with_capacity(stops.len());
        let mut total_osrm_dist = 0.0;
        let mut total_osrm_duration = 0.0;
        let mut start_idx = 0;

        while start_idx < stops.len() - 1 {
            let end_idx = (start_idx + OSRM_CHUNK_SIZE).min(stops.len());
            let chunk = &stops[start_idx..end_idx];

            if chunk.len() < 2 {
                break;
            }

            if let Some((coords, chunk_dist, chunk_dur)) = self.fetch_osrm_route(chunk).await {
                let current_total = full_coordinates.len();
                total_osrm_dist += chunk_dist;
                total_osrm_duration += chunk_dur;

                // Merge Geometry
                let to_append = &coords[..];

                // Map Stops to Geometry
                let mut prev_local_idx = 0;
                for (i, stop) in chunk.iter().enumerate() {
                    let global_stop_idx = start_idx + i;
                    if global_stop_idx < stop_to_coord.len() {
                        continue;
                    }

                    if let Some(local_idx) = find_nearest_coord_index(
                        (stop.gps_long, stop.gps_lat),
                        &coords,
                        prev_local_idx,
                    ) {
                        stop_to_coord.push(current_total + local_idx);
                        prev_local_idx = local_idx;
                    } else {
                        stop_to_coord.push(current_total + prev_local_idx);
                    }
                }

                full_coordinates.extend_from_slice(to_append);
            } else {
                log::warn!(
                    "OSRM failed for chunk {}..{} (route_no: {}). Falling back to straight lines.",
                    start_idx,
                    end_idx - 1,
                    route_no
                );

                for (i, stop) in chunk.iter().enumerate() {
                    let global_stop_idx = start_idx + i;
                    if global_stop_idx < stop_to_coord.len() {
                        continue;
                    }

                    let current_total = full_coordinates.len();
                    if i == 0 && current_total > 0 {
                        // Already handled by the previous chunk's last point
                        stop_to_coord.push(current_total - 1);
                    } else {
                        full_coordinates.push(vec![stop.gps_long, stop.gps_lat]);
                        stop_to_coord.push(full_coordinates.len() - 1);
                    }

                    if i > 0 {
                        let s_prev = &chunk[i - 1];
                        total_osrm_dist += crate::utils::geo::meters_between(
                            s_prev.gps_long,
                            s_prev.gps_lat,
                            stop.gps_long,
                            stop.gps_lat,
                        );
                    }
                }
            }
            start_idx = end_idx - 1;
        }

        while stop_to_coord.len() < stops.len() {
            stop_to_coord.push(full_coordinates.len().saturating_sub(1));
        }

        // [CRITICAL FIX] Enforce monotonically increasing stop_to_coord
        // This prevents backward jumps when slicing segments which cause straight lines in the frontend
        for i in 1..stop_to_coord.len() {
            if stop_to_coord[i] < stop_to_coord[i - 1] {
                stop_to_coord[i] = stop_to_coord[i - 1];
            }
        }

        // [OPTIMIZATION] Round coordinates to 6 decimal places to reduce file size
        // This is important for web performance
        for pt in &mut full_coordinates {
            for c in pt.iter_mut() {
                *c = (*c * 1_000_000.0).round() / 1_000_000.0;
            }
        }
        let optimized_coordinates = full_coordinates;

        // Calculate BBox & Distance
        // We use OSRM reported distance if available, otherwise fallback to polyline calculation
        let (bbox, geom_dist) = calculate_metrics(&optimized_coordinates);
        let final_dist = if total_osrm_dist > 0.0 {
            total_osrm_dist
        } else {
            geom_dist
        };

        let mut up_segments = Vec::new();
        let mut down_segments = Vec::new();
        let mut local_segments = HashMap::new();

        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        for i in 0..stops.len().saturating_sub(1) {
            let mut start_idx = stop_to_coord[i];
            let mut end_idx = stop_to_coord[i + 1];

            // Ensure bounds
            start_idx = start_idx.min(optimized_coordinates.len().saturating_sub(1));
            end_idx = end_idx.min(optimized_coordinates.len().saturating_sub(1));

            // Fix inverted or equal indices to prevent skipping segments.
            // Skipping segments causes array desynchronization in the frontend!
            if start_idx >= end_idx {
                end_idx = start_idx;
            }

            let mut seg_coords = optimized_coordinates[start_idx..=end_idx].to_vec();
            if seg_coords.len() < 2 {
                if !seg_coords.is_empty() {
                    seg_coords.push(seg_coords[0].clone());
                } else {
                    seg_coords.push(vec![0.0, 0.0]);
                    seg_coords.push(vec![0.0, 0.0]);
                }
            }

            let mut hasher = DefaultHasher::new();
            for p in &seg_coords {
                if p.len() >= 2 {
                    ((p[0] * 100000.0) as i64).hash(&mut hasher);
                    ((p[1] * 100000.0) as i64).hash(&mut hasher);
                }
            }
            let seg_id = format!("{:x}", hasher.finish());

            local_segments.insert(seg_id.clone(), seg_coords);

            // Sync down_segments and up_segments precisely with the stops array index.
            if i < turn_idx {
                down_segments.push(seg_id);
            } else {
                up_segments.push(seg_id);
            }
        }

        let snap_data = RouteSnapData {
            route_id: route_id.clone(),
            route_no: route_no.clone(),
            stops: stops
                .into_iter()
                .map(|s| FrontendStop {
                    id: s.node_id,
                    name: s.node_nm,
                    ord: s.node_ord,
                    up_down: s.up_down_cd,
                })
                .collect(),
            up_segments,
            down_segments,
            meta: FrontendMeta {
                total_dist: final_dist,
                total_time: total_osrm_duration,
                source_ver: raw_data.fetched_at,
            },
            bbox: Some(bbox.to_vec()),
        };

        // Save Derived File
        let output_path = self.derived_dir.join(format!("{}.json", route_id));
        tokio::fs::write(output_path, serde_json::to_string(&snap_data)?).await?;

        Ok(local_segments)
    }
}
