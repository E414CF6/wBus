//! Bus Route Data Models
//!
//! This module defines the data structures used to represent
//! raw and derived bus route information, including GeoJSON
//! formats for frontend consumption.

use std::path::PathBuf;

use serde::{Deserialize, Serialize, Serializer};
use serde_json::Value;

// ============================================================================
// Raw Data Models (Saved to cache)
// ============================================================================

/// Raw station information fetched from the API (for preservation)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawStop {
    pub node_id: String,
    pub node_nm: String,
    pub node_ord: i64,
    pub node_no: String,
    pub gps_lat: f64,
    pub gps_long: f64,
    pub up_down_cd: i64,
}

/// Raw file save format
#[derive(Serialize, Deserialize)]
pub struct RawRouteFile {
    pub route_id: String,
    pub route_no: String,
    pub fetched_at: String,
    pub stops: Vec<RawStop>,
}

// ============================================================================
// Derived Data Models (Saved to derived_routes/)
// ============================================================================

/// Single lightweight metadata file for marker snapping and UI (saved as .json)
#[derive(Serialize)]
pub struct RouteSnapData {
    pub route_id: String,
    pub route_no: String,
    pub stops: Vec<FrontendStop>,
    pub up_segments: Vec<String>,
    pub down_segments: Vec<String>,
    #[serde(flatten)]
    pub meta: FrontendMeta,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bbox: Option<Vec<f64>>,
}

#[derive(Serialize)]
pub struct FrontendStop {
    pub id: String,
    pub name: String,
    pub ord: i64,
    #[serde(rename = "ud")]
    pub up_down: i64,
}

#[derive(Serialize)]
pub struct FrontendMeta {
    #[serde(serialize_with = "round_f64_1")]
    pub total_dist: f64,
    #[serde(serialize_with = "round_f64_1")]
    pub total_time: f64,
    pub source_ver: String,
}

// --------------------------------------------------------
// Helpers for Serialization
// --------------------------------------------------------

/// Rounds a f64 value to 1 decimal place during serialization
fn round_f64_1<S>(val: &f64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    let rounded = (*val * 10.0).round() / 10.0;
    serializer.serialize_f64(rounded)
}

// ============================================================================
// Processing Structures
// ============================================================================

/// Internal processing structure
pub struct RouteProcessData {
    pub route_id: String,
    pub route_no: String,
    pub details: Value,
    pub stops_map: Vec<(String, Value)>,
}

/// Main processor structure
pub struct BusRouteProcessor {
    pub client: reqwest::Client,
    pub service_key: String,
    pub city_code: String,
    pub raw_dir: PathBuf,
    pub derived_dir: PathBuf,
    pub mapping_file: PathBuf,
    pub tago_base_url: String,
    pub osrm_base_url: String,
}
