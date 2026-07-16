use std::collections::HashMap;
use std::path::Path;

use anyhow::Result;
use serde_json::Value;

use crate::config::OSRM_CHUNK_SIZE;
use crate::route::model::{
    BusRouteProcessor, FrontendMeta, FrontendStop, RawRouteFile, RawStop, RouteSnapData,
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

        // Derive Indices & Metrics
        let turn_coord_idx = stop_to_coord
            .get(turn_idx)
            .cloned()
            .unwrap_or(optimized_coordinates.len() / 2);

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
            let start_idx = stop_to_coord[i];
            let end_idx = stop_to_coord[i + 1];
            if start_idx >= end_idx
                || start_idx >= optimized_coordinates.len()
                || end_idx >= optimized_coordinates.len()
            {
                continue;
            }
            let seg_coords = optimized_coordinates[start_idx..=end_idx].to_vec();

            let mut hasher = DefaultHasher::new();
            for p in &seg_coords {
                if p.len() >= 2 {
                    ((p[0] * 100000.0) as i64).hash(&mut hasher);
                    ((p[1] * 100000.0) as i64).hash(&mut hasher);
                }
            }
            let seg_id = format!("{:x}", hasher.finish());

            local_segments.insert(seg_id.clone(), seg_coords);

            // If the segment starts before the turn index, it's 'up'
            if start_idx < turn_coord_idx {
                up_segments.push(seg_id);
            } else {
                down_segments.push(seg_id);
            }
        }

        let up_polyline = optimized_coordinates
            [..=turn_coord_idx.min(optimized_coordinates.len().saturating_sub(1))]
            .to_vec();
        let down_polyline = optimized_coordinates
            [turn_coord_idx.min(optimized_coordinates.len().saturating_sub(1))..]
            .to_vec();
        let is_swapped = should_swap_polylines(&stops, &up_polyline, &down_polyline);

        if is_swapped {
            std::mem::swap(&mut up_segments, &mut down_segments);
        }

        let frontend_stops: Vec<FrontendStop> = stops
            .into_iter()
            .map(|s| FrontendStop {
                id: s.node_id,
                name: s.node_nm,
                ord: s.node_ord,
                up_down: s.up_down_cd,
            })
            .collect();

        let snap_data = RouteSnapData {
            route_id: route_id.clone(),
            route_no: route_no.clone(),
            stops: frontend_stops,
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

fn should_swap_polylines(
    stops: &[RawStop],
    up_polyline: &[Vec<f64>],
    down_polyline: &[Vec<f64>],
) -> bool {
    if up_polyline.len() < 2 || down_polyline.len() < 2 {
        return false;
    }

    let mut up_stops = Vec::new();
    let mut down_stops = Vec::new();

    for stop in stops {
        let coord = vec![stop.gps_long, stop.gps_lat];
        if stop.up_down_cd == 1 {
            up_stops.push(coord);
        } else {
            down_stops.push(coord);
        }
    }

    if up_stops.len() < 3 || down_stops.len() < 3 {
        return false;
    }

    let sample = |arr: &Vec<Vec<f64>>, max: usize| -> Vec<Vec<f64>> {
        if arr.len() <= max {
            return arr.clone();
        }
        let step = (arr.len() as f64 / max as f64).ceil() as usize;
        arr.iter()
            .enumerate()
            .filter(|(i, _)| i % step == 0)
            .map(|(_, v)| v.clone())
            .take(max)
            .collect()
    };

    let sampled_up = sample(&up_stops, 20);
    let sampled_down = sample(&down_stops, 20);

    let calc_mse = |points: &[Vec<f64>], line: &[Vec<f64>]| -> f64 {
        let mut total = 0.0;
        for p in points {
            let mut min_dist = f64::INFINITY;
            for i in 0..line.len() - 1 {
                let a = &line[i];
                let b = &line[i + 1];
                let ab = vec![b[0] - a[0], b[1] - a[1]];
                let ap = vec![p[0] - a[0], p[1] - a[1]];
                let ab2 = ab[0] * ab[0] + ab[1] * ab[1];
                let t = if ab2 > 0.0 {
                    (ap[0] * ab[0] + ap[1] * ab[1]) / ab2
                } else {
                    0.0
                };
                let t = t.clamp(0.0, 1.0);
                let proj = vec![a[0] + ab[0] * t, a[1] + ab[1] * t];
                let d = (p[0] - proj[0]).powi(2) + (p[1] - proj[1]).powi(2);
                if d < min_dist {
                    min_dist = d;
                }
            }
            total += min_dist;
        }
        total / (points.len() as f64)
    };

    let up_to_up = calc_mse(&sampled_up, up_polyline);
    let up_to_down = calc_mse(&sampled_up, down_polyline);
    let down_to_up = calc_mse(&sampled_down, up_polyline);
    let down_to_down = calc_mse(&sampled_down, down_polyline);

    let swap_ratio = 0.81;
    up_to_down < up_to_up * swap_ratio && down_to_up < down_to_down * swap_ratio
}
