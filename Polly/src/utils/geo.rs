//! Geospatial utility functions.
//!
//! Functions for calculating distances, finding nearest points, and computing bounding boxes.

/// Calculate distance in meters between two GPS coordinates using Equirectangular approximation
pub fn meters_between(lon1: f64, lat1: f64, lon2: f64, lat2: f64) -> f64 {
    // Equirectangular approximation
    let r = 6371000.0;

    let x = (lon2 - lon1).to_radians() * ((lat1 + lat2) * 0.5).to_radians().cos();
    let y = (lat2 - lat1).to_radians();

    (x * x + y * y).sqrt() * r
}

/// Calculate bearing (heading angle 0..360 degrees) from (lon1, lat1) to (lon2, lat2)
pub fn bearing_between(lon1: f64, lat1: f64, lon2: f64, lat2: f64) -> f64 {
    let lat1_rad = lat1.to_radians();
    let lat2_rad = lat2.to_radians();
    let dlon_rad = (lon2 - lon1).to_radians();

    let y = dlon_rad.sin() * lat2_rad.cos();
    let x = lat1_rad.cos() * lat2_rad.sin() - lat1_rad.sin() * lat2_rad.cos() * dlon_rad.cos();

    let bearing_rad = y.atan2(x);
    let bearing_deg = bearing_rad.to_degrees();
    (bearing_deg + 360.0) % 360.0
}

/// Find the closest point on a polyline to a given point
pub fn closest_point_on_polyline(
    point: (f64, f64),
    line: &[Vec<f64>],
) -> Option<((f64, f64), f64)> {
    if line.len() < 2 {
        return None;
    }

    let (px, py) = point;
    let mut best = None;

    for seg in line.windows(2) {
        let (x1, y1) = (seg[0][0], seg[0][1]);
        let (x2, y2) = (seg[1][0], seg[1][1]);

        let dx = x2 - x1;
        let dy = y2 - y1;

        let denom = dx * dx + dy * dy;
        if denom == 0.0 {
            continue;
        }

        let t = ((px - x1) * dx + (py - y1) * dy) / denom;

        let cx = x1 + t.clamp(0.0, 1.0) * dx;
        let cy = y1 + t.clamp(0.0, 1.0) * dy;

        let d = meters_between(px, py, cx, cy);

        match best {
            None => best = Some(((cx, cy), d)),
            Some((_, bd)) if d < bd => best = Some(((cx, cy), d)),
            _ => {}
        }
    }

    best
}

pub fn find_nearest_coord_index(
    point: (f64, f64),
    line: &[Vec<f64>],
    start_idx: usize,
) -> Option<usize> {
    if line.is_empty() || start_idx >= line.len() {
        return None;
    }

    let (px, py) = point;

    let mut best_idx = start_idx;
    let mut min_dist_sq = f64::MAX;
    let mut increases = 0;

    for i in start_idx..line.len() {
        let coord = &line[i];
        let dx = px - coord[0];
        let dy = py - coord[1];
        let dist_sq = dx * dx + dy * dy;

        if dist_sq < min_dist_sq {
            min_dist_sq = dist_sq;
            best_idx = i;
            increases = 0;
        } else {
            increases += 1;
            // If distance has been increasing for 150 consecutive points, we are past the local minimum.
            // This prevents matching against the return trip.
            if increases > 150 {
                break;
            }
        }
    }

    Some(best_idx)
}

/// Calculate bounding box and total distance of a series of coordinates
pub fn calculate_metrics(coords: &[Vec<f64>]) -> ([f64; 4], f64) {
    let mut min_lon = 180.0;
    let mut min_lat = 90.0;

    let mut max_lon = -180.0;
    let mut max_lat = -90.0;

    let mut dist = 0.0;

    for (i, c) in coords.iter().enumerate() {
        if c[0] < min_lon {
            min_lon = c[0];
        }

        if c[0] > max_lon {
            max_lon = c[0];
        }

        if c[1] < min_lat {
            min_lat = c[1];
        }

        if c[1] > max_lat {
            max_lat = c[1];
        }

        if i > 0 {
            dist += meters_between(coords[i - 1][0], coords[i - 1][1], c[0], c[1]);
        }
    }

    ([min_lon, min_lat, max_lon, max_lat], dist)
}

/// Perpendicular distance in meters from point (px, py) to line segment (x1, y1)-(x2, y2)
pub fn perpendicular_distance_meters(px: f64, py: f64, x1: f64, y1: f64, x2: f64, y2: f64) -> f64 {
    let dx = x2 - x1;
    let dy = y2 - y1;
    let len_sq = dx * dx + dy * dy;
    if len_sq == 0.0 {
        return meters_between(px, py, x1, y1);
    }
    let t = (((px - x1) * dx + (py - y1) * dy) / len_sq).clamp(0.0, 1.0);
    let proj_x = x1 + t * dx;
    let proj_y = y1 + t * dy;
    meters_between(px, py, proj_x, proj_y)
}

/// Simplify a 2D polyline using Ramer-Douglas-Peucker (RDP) algorithm with tolerance in meters.
pub fn simplify_polyline(coords: &[Vec<f64>], tolerance_meters: f64) -> Vec<Vec<f64>> {
    if coords.len() <= 2 || tolerance_meters <= 0.0 {
        return coords.to_vec();
    }

    let mut keep = vec![false; coords.len()];
    keep[0] = true;
    keep[coords.len() - 1] = true;

    fn rdp(coords: &[Vec<f64>], start: usize, end: usize, tolerance: f64, keep: &mut [bool]) {
        if end <= start + 1 {
            return;
        }
        let (x1, y1) = (coords[start][0], coords[start][1]);
        let (x2, y2) = (coords[end][0], coords[end][1]);

        let mut max_dist = 0.0;
        let mut max_idx = start;

        for i in (start + 1)..end {
            let (px, py) = (coords[i][0], coords[i][1]);
            let d = perpendicular_distance_meters(px, py, x1, y1, x2, y2);
            if d > max_dist {
                max_dist = d;
                max_idx = i;
            }
        }

        if max_dist > tolerance {
            keep[max_idx] = true;
            rdp(coords, start, max_idx, tolerance, keep);
            rdp(coords, max_idx, end, tolerance, keep);
        }
    }

    rdp(coords, 0, coords.len() - 1, tolerance_meters, &mut keep);

    coords
        .iter()
        .enumerate()
        .filter(|(i, _)| keep[*i])
        .map(|(_, pt)| pt.clone())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bearing_between_north() {
        let b = bearing_between(127.0, 37.0, 127.0, 37.1);
        assert!((b - 0.0).abs() < 1e-3 || (b - 360.0).abs() < 1e-3);
    }

    #[test]
    fn test_simplify_polyline_straight_line() {
        // Points on a straight line: start, middle (collinear), end
        let coords = vec![
            vec![127.0, 37.0],
            vec![127.05, 37.05], // collinear point
            vec![127.1, 37.1],
        ];

        let simplified = simplify_polyline(&coords, 5.0);
        // Middle point should be simplified out
        assert_eq!(simplified.len(), 2);
        assert_eq!(simplified[0], vec![127.0, 37.0]);
        assert_eq!(simplified[1], vec![127.1, 37.1]);
    }

    #[test]
    fn test_simplify_polyline_corner_preserved() {
        // L-shaped line with a sharp corner
        let coords = vec![
            vec![127.0, 37.0],
            vec![127.1, 37.0], // sharp corner point
            vec![127.1, 37.1],
        ];

        let simplified = simplify_polyline(&coords, 5.0);
        // Corner point must be kept
        assert_eq!(simplified.len(), 3);
    }
}
