//! Bus Schedule Data Models
//!
//! This module defines the data structures used to represent
//! bus route metadata and parsed schedule information.

use std::collections::HashMap;

/// Holds metadata for a bus route, such as its start and end points
/// and a list of all unique directions (termini) it serves.
#[derive(Debug, Clone)]
pub struct RouteMeta {
    pub origin: String,
    pub destination: String,
    pub directions: Vec<String>,
}

/// Represents a single departure time entry in the schedule.
#[derive(Debug)]
pub struct TimeEntry {
    pub time: String,
    pub note: Option<String>,
}

/// Represents the fully parsed schedule for a specific route on a specific day type.
#[derive(Debug)]
pub struct ParsedSchedule {
    pub route_number: String,
    pub day_type: String,
    pub directions: Vec<String>,
    pub times_by_direction: HashMap<String, Vec<TimeEntry>>,
}
