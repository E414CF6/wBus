use std::collections::{HashMap, HashSet};

use anyhow::{Context, Result};
use regex::Regex;
use scraper::{Html, Selector};

use crate::schedule::model::{ParsedSchedule, RouteMeta, TimeEntry};

/// Parses the main schedule page to extract a list of all available routes.
/// It creates a map of route metadata and a list of `route_id`s used for fetching details.
pub fn extract_route_info(
    html: &str,
    filter: Option<&str>,
) -> Result<(HashMap<String, RouteMeta>, Vec<String>)> {
    let document = Html::parse_document(html);
    let mut route_meta_map = HashMap::new();
    let mut targets = Vec::new();

    let row_selector = Selector::parse("table tr").unwrap();
    let cell_selector = Selector::parse("td").unwrap();
    let onclick_re = Regex::new(r"goDetail\('([^']+)'\)").unwrap();

    let mut temp_directions: HashMap<String, HashSet<String>> = HashMap::new();

    // Iterate over each row in the main schedule table.
    for row in document.select(&row_selector) {
        let cells: Vec<_> = row.select(&cell_selector).collect();
        if cells.len() >= 6 {
            let route_element = cells[0];

            // The route_id required for the POST request is in an `onclick` attribute.
            if let Some(onclick) = route_element.value().attr("onclick")
                && let Some(caps) = onclick_re.captures(onclick)
            {
                let route_id = caps.get(1).unwrap().as_str().to_string();

                // If a specific route is requested, filter out all others.
                if let Some(f) = filter
                    && !route_id.starts_with(f)
                {
                    continue;
                }

                targets.push(route_id.clone());

                let route_no = route_id.split('(').next().unwrap_or(&route_id).to_string();
                let origin = cells[1].text().collect::<String>().trim().to_string();
                let dest = cells[2].text().collect::<String>().trim().to_string();

                // Collect all unique termini for this route number.
                let entry = temp_directions.entry(route_no.clone()).or_default();
                entry.insert(origin.clone());
                entry.insert(dest.clone());

                // Store metadata for the route.
                route_meta_map.entry(route_no).or_insert(RouteMeta {
                    origin,
                    destination: dest,
                    directions: Vec::new(),
                });
            }
        }
    }

    // Assign the sorted, unique directions to each route in the metadata map.
    for (r_no, dirs_set) in temp_directions {
        if let Some(meta) = route_meta_map.get_mut(&r_no) {
            let mut sorted_dirs: Vec<String> = dirs_set.into_iter().collect();
            sorted_dirs.sort();
            meta.directions = sorted_dirs;
        }
    }

    Ok((route_meta_map, targets))
}

/// Normalizes Korean day type strings into a standard English identifier.
fn normalize_day_type(raw: &str) -> String {
    let lower = raw.to_lowercase();
    if lower.contains("평일") || lower.contains("주중") {
        // Weekday
        "weekday".to_string()
    } else if lower.contains("주말") // Weekend
        || lower.contains("휴일") // Holiday
        || lower.contains("토") // Saturday
        || lower.contains("일") // Sunday
        || lower.contains("방학") // Vacation
        || lower.contains("공휴")
    // Public Holiday
    {
        "weekend".to_string()
    } else {
        "general".to_string()
    }
}

/// Parses the HTML of a schedule detail page for a single route.
pub fn parse_detail_schedule(
    html: &str,
    route_id: &str,
    meta: Option<&RouteMeta>,
) -> Result<ParsedSchedule> {
    let document = Html::parse_document(html);

    // Extract the route number and raw day type from the route_id string (e.g., "34-1(평일)").
    let (route_number, raw_day_type) = if let Some(pos) = route_id.find('(') {
        (
            route_id[..pos].trim().to_string(),
            route_id[pos..]
                .trim_matches(|c| c == '(' || c == ')')
                .to_string(),
        )
    } else {
        (route_id.to_string(), "general".to_string())
    };

    let day_type = normalize_day_type(&raw_day_type);

    let table_selector = Selector::parse("table").unwrap();
    let th_selector = Selector::parse("th").unwrap();

    // Find the correct schedule table by looking for a `th` element containing "발" (departure).
    let mut target_table = None;
    for table in document.select(&table_selector) {
        let headers: Vec<String> = table
            .select(&th_selector)
            .map(|th| th.text().collect::<String>())
            .collect();
        if headers.iter().any(|h| h.contains("발")) {
            target_table = Some(table);
            break;
        }
    }

    // If the specific table isn't found, fall back to the first table on the page.
    if target_table.is_none() {
        target_table = document.select(&table_selector).next();
    }

    let table = target_table.context("No schedule table found in the HTML")?;

    let mut col_map: HashMap<usize, String> = HashMap::new(); // Maps column index to direction name.
    let mut directions: Vec<String> = Vec::new();
    let mut note_col_idx = None;

    let tr_selector = Selector::parse("tr").unwrap();
    let header_rows: Vec<_> = table.select(&tr_selector).collect();
    let hour_re = Regex::new(r"^\d+시$").unwrap();

    // Parse table headers to identify directions.
    for row in &header_rows {
        let ths: Vec<_> = row.select(&th_selector).collect();
        if ths.is_empty() {
            continue;
        }

        for (idx, th) in ths.iter().enumerate() {
            let text = th.text().collect::<String>().trim().to_string();

            if text == "비고" {
                // "비고" means "Notes".
                note_col_idx = Some(idx);
                continue;
            }

            // Extract direction names from headers. Headers for times often end with "발" (departure).
            // We ignore irrelevant headers like "운행순번" (run order), "시" (hour), "분" (minute), etc.
            let clean_text = text.trim_end_matches('발').to_string();
            if !clean_text.is_empty()
                && !["운행순번", "시", "분", "", "구분"].contains(&clean_text.as_str())
                && !hour_re.is_match(&clean_text)
            {
                if !directions.contains(&clean_text) {
                    directions.push(clean_text.clone());
                }
                col_map.insert(idx, clean_text);
            }
        }
    }

    // If directions could not be determined from the table headers,
    // fall back to the metadata extracted from the main page.
    if directions.is_empty() {
        if let Some(m) = meta {
            directions = m.directions.clone();
        }
        // If we have directions from meta but no column map, create a default mapping.
        if col_map.is_empty() && !directions.is_empty() {
            for (i, dir) in directions.iter().enumerate() {
                col_map.insert(i + 1, dir.clone());
            }
        }
    }

    let td_selector = Selector::parse("td").unwrap();
    let time_re = Regex::new(r"^(\d{1,2}:\d{2})").unwrap();

    let mut times_by_direction: HashMap<String, Vec<TimeEntry>> = HashMap::new();
    for dir in &directions {
        times_by_direction.insert(dir.clone(), Vec::new());
    }

    // Iterate through table rows to extract departure times.
    for row in table.select(&tr_selector) {
        let cells: Vec<_> = row.select(&td_selector).collect();
        if cells.is_empty() {
            // Skip header rows.
            continue;
        }

        // Extract note text if the note column exists.
        let note = if let Some(idx) = note_col_idx {
            if idx < cells.len() {
                let text = cells[idx].text().collect::<String>().trim().to_string();
                if text.is_empty() { None } else { Some(text) }
            } else {
                None
            }
        } else {
            None
        };

        // Check each cell in the row for a time.
        for (col_idx, cell) in cells.iter().enumerate() {
            if let Some(dir_name) = col_map.get(&col_idx) {
                let text = cell.text().collect::<String>().trim().to_string();
                if let Some(caps) = time_re.captures(&text) {
                    let clean_time = caps.get(1).unwrap().as_str().to_string();

                    if let Some(list) = times_by_direction.get_mut(dir_name) {
                        list.push(TimeEntry {
                            time: clean_time,
                            note: note.clone(),
                        });
                    }
                }
            }
        }
    }

    Ok(ParsedSchedule {
        route_number,
        day_type,
        directions,
        times_by_direction,
    })
}
