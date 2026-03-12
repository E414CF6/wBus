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

/// Find the index of the coordinate in `line` closest to `point`
///
/// Uses a fast squared Euclidean approximation instead of full haversine,
/// which is valid since we only need the relative ordering of distances
/// (not absolute values) and the coordinates span a small geographic area.
pub fn find_nearest_coord_index(point: (f64, f64), line: &[Vec<f64>]) -> Option<usize> {
    if line.is_empty() {
        return None;
    }

    let (px, py) = point;

    let mut best_idx = 0;
    let mut min_dist_sq = f64::MAX;

    for (i, coord) in line.iter().enumerate() {
        let dx = px - coord[0];
        let dy = py - coord[1];
        let dist_sq = dx * dx + dy * dy;

        if dist_sq < min_dist_sq {
            min_dist_sq = dist_sq;
            best_idx = i;
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
