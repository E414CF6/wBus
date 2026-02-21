//! Bus Schedule Crawler Module
//!
//! This module implements a web crawler that fetches bus schedule data
//! from a public transportation website. It mimics browser behavior to
//! handle session cookies and parse HTML responses to extract schedule
//! information. The extracted data is then organized and saved as JSON files.

mod fetch;
mod merge;
mod model;
mod parse;

use std::fs;
use std::path::PathBuf;
use std::time::Duration;

use anyhow::Result;
use log::{error, info, warn};
use tokio::time::sleep;

use crate::schedule::fetch::ScheduleClient;
use crate::schedule::merge::merge_schedules;
use crate::schedule::model::ParsedSchedule;
use crate::schedule::parse::{extract_route_info, parse_detail_schedule};
use crate::utils;

// ============================================================================
// Schedule Arguments
// ============================================================================

#[derive(clap::Args)]
pub struct ScheduleArgs {
    /// Specific route number to crawl (e.g., "34-1"). If omitted, all routes are crawled.
    pub route: Option<String>,

    /// Output directory for saving the schedule JSON files.
    pub output_dir: PathBuf,
}

/// Main entry point for the schedule crawler.
///
/// This function orchestrates the entire crawling process:
/// 1. Initializes an HTTP client with cookie storage to maintain session.
/// 2. Fetches the main schedule page to get a list of all bus routes.
/// 3. For each route, it fetches the detailed schedule.
/// 4. Parses the HTML response for each detail page.
/// 5. Merges the various schedules (e.g., weekday, weekend) for each route.
/// 6. Saves the final, structured data as JSON files.
///
pub async fn run(args: ScheduleArgs) -> Result<()> {
    let schedule_dir = args.output_dir.join("schedules");

    utils::ensure_dir(&schedule_dir)?;

    info!("Starting Bus Schedule Crawler (Browser Mimic Mode)");

    // Initialize an HTTP client that mimics a web browser.
    let client = ScheduleClient::new()?;

    // Fetch the main schedule page to acquire session cookies and the list of all routes.
    info!("Fetching main page (Initializing Session)...");

    let resp = client.fetch_main_page().await?;

    // Extract basic route information and the target route IDs to crawl.
    let (route_meta_map, targets) = extract_route_info(&resp, args.route.as_deref())?;

    info!("Found info for {} routes", route_meta_map.len());
    info!("Found {} route schedules to process", targets.len());

    let mut collected_schedules: Vec<ParsedSchedule> = Vec::new();

    // Iterate through each target route and fetch its detailed schedule.
    for (i, route_id) in targets.iter().enumerate() {
        info!("Processing route {}/{}: {}", i + 1, targets.len(), route_id);
        sleep(Duration::from_millis(300)).await; // Politeness delay.

        let detail_html = match client.fetch_detail_page(route_id).await {
            Ok(html) => html,
            Err(e) => {
                error!("Failed (Network/Status): {}", e);
                continue;
            }
        };

        // The route number is the part of the route_id before any parentheses.
        let route_number = route_id.split('(').next().unwrap_or(route_id).to_string();
        let meta = route_meta_map.get(&route_number);

        // Parse the returned HTML to extract the schedule.
        match parse_detail_schedule(&detail_html, route_id, meta) {
            Ok(parsed) => {
                let count: usize = parsed.times_by_direction.values().map(|v| v.len()).sum();
                if count > 0 {
                    info!("({} times)", count);
                    collected_schedules.push(parsed);
                } else {
                    // If parsing yields no times, save the HTML for debugging.
                    warn!("Warning: 0 times. (HTML Check Saved)");
                    fs::write(format!("debug_empty_{}.html", i), &detail_html).ok();
                }
            }
            Err(e) => {
                error!("Error: {}", e);
            }
        }
    }

    // Merge the collected schedules and save them to JSON files.
    info!("Organizing and saving schedules...");

    let merged_routes = merge_schedules(collected_schedules, &route_meta_map);

    for (route_number, data) in merged_routes {
        save_route_schedule(&schedule_dir, &route_number, &data)?;
    }

    Ok(())
}

/// Saves the final merged schedule data for a route to a JSON file.
fn save_route_schedule(
    base_dir: &std::path::Path,
    route_number: &str,
    data: &serde_json::Value,
) -> Result<()> {
    // Sanitize the route number to create a valid filename.
    let safe_name = route_number.replace(|c: char| !c.is_alphanumeric() && c != '-', "_");
    let filename = format!("{}.json", safe_name);
    let path = base_dir.join(filename);

    let json_str = serde_json::to_string_pretty(data)?;
    fs::write(&path, json_str)?;

    info!("Saved {} to {:?}", route_number, path.file_name().unwrap());
    Ok(())
}
