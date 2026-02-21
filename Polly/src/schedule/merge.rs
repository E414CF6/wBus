use std::collections::{BTreeMap, HashMap};

use serde_json::json;

use crate::schedule::model::{ParsedSchedule, RouteMeta};

/// Merges multiple `ParsedSchedule` structs into a single, comprehensive JSON object per route.
/// For example, it combines weekday and weekend schedules for the same bus route.
pub fn merge_schedules(
    schedules: Vec<ParsedSchedule>,
    route_meta_map: &HashMap<String, RouteMeta>,
) -> HashMap<String, serde_json::Value> {
    let mut merged_routes: HashMap<String, serde_json::Value> = HashMap::new();
    let mut route_note_maps: HashMap<String, HashMap<String, String>> = HashMap::new();
    let mut route_note_counters: HashMap<String, usize> = HashMap::new();

    for schedule in schedules {
        let r_no = schedule.route_number.clone();

        // If this is the first time seeing this route, create the base JSON structure.
        if !merged_routes.contains_key(&r_no) {
            let meta = route_meta_map.get(&r_no);
            let (origin, dest, dirs) = match meta {
                Some(m) => (
                    m.origin.clone(),
                    m.destination.clone(),
                    m.directions.clone(),
                ),
                None => (String::new(), String::new(), schedule.directions.clone()),
            };

            let initial_json = json!({
                "routeId": r_no,
                "routeName": format!("{}번", r_no),
                "description": format!("{} ↔ {}", origin, dest),
                "lastUpdated": chrono::Local::now().format("%Y-%m-%d").to_string(),
                "directions": dirs,
                "routeDetails": [],
                "featuredStops": { "general": [] },
                "schedule": {},
                "notes": {}
            });
            merged_routes.insert(r_no.clone(), initial_json);
            route_note_maps.insert(r_no.clone(), HashMap::new());
            route_note_counters.insert(r_no.clone(), 1);
        }

        let route_json = merged_routes.get_mut(&r_no).unwrap();
        let note_map = route_note_maps.get_mut(&r_no).unwrap();
        let note_counter = route_note_counters.get_mut(&r_no).unwrap();

        // Create a schedule object for the current day type (e.g., "weekday").
        let day_type_schedule = json!({});
        route_json["schedule"][&schedule.day_type] = day_type_schedule;

        for (direction, entries) in schedule.times_by_direction {
            let mut times_by_hour: BTreeMap<String, Vec<serde_json::Value>> = BTreeMap::new();

            for entry in entries {
                // Handle notes: assign a unique ID to each note text.
                let note_id = if let Some(note_text) = entry.note {
                    if !note_map.contains_key(&note_text) {
                        let new_id = note_counter.to_string();
                        note_map.insert(note_text.clone(), new_id.clone());
                        *note_counter += 1;
                        route_json["notes"][&new_id] = json!(note_text);
                        Some(new_id)
                    } else {
                        Some(note_map[&note_text].clone())
                    }
                } else {
                    None
                };

                // Group times by the hour.
                let parts: Vec<&str> = entry.time.split(':').collect();
                if parts.len() == 2 {
                    let hour = format!("{:0>2}", parts[0]);
                    let minute = format!("{:0>2}", parts[1]);

                    let mut minute_obj = json!({ "minute": minute });
                    if let Some(nid) = note_id {
                        minute_obj["noteId"] = json!(nid);
                    }

                    times_by_hour.entry(hour).or_default().push(minute_obj);
                }
            }

            // Add the hour-grouped times to the final JSON structure.
            for (hour, minutes) in times_by_hour {
                if route_json["schedule"][&schedule.day_type][&hour].is_null() {
                    route_json["schedule"][&schedule.day_type][&hour] = json!({});
                }
                route_json["schedule"][&schedule.day_type][&hour][&direction] = json!(minutes);
            }
        }
    }

    merged_routes
}
