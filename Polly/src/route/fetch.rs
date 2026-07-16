use std::collections::{BTreeMap, HashMap};

use anyhow::Result;
use chrono::Local;
use serde_json::{Value, json};

use crate::route::model::{BusRouteProcessor, RawRouteFile, RawStop, RouteProcessData};
use crate::utils::{extract_items, parse_flexible_string};

impl BusRouteProcessor {
    pub async fn get_all_routes(&self) -> Result<Vec<Value>> {
        let params = [
            ("cityCode", self.city_code.as_str()),
            ("numOfRows", "2048"),
            ("pageNo", "1"),
            ("serviceKey", self.service_key.as_str()),
            ("_type", "json"),
        ];

        let url = format!("{}/getRouteNoList", self.tago_base_url);
        let resp: reqwest::Response = self.client.get(&url).query(&params).send().await?;
        let json: Value = resp.json().await?;

        extract_items(&json)
    }

    pub async fn fetch_and_save_raw(&self, route_info: Value) -> Result<Option<RouteProcessData>> {
        let route_id = route_info["routeid"]
            .as_str()
            .unwrap_or_default()
            .to_string();
        let route_no = parse_flexible_string(&route_info["routeno"]);

        if route_no == "UNKNOWN" || route_id.is_empty() {
            return Ok(None);
        }

        // Fetch Stops
        let params = [
            ("cityCode", self.city_code.as_str()),
            ("routeId", route_id.as_str()),
            ("numOfRows", "2048"),
            ("serviceKey", self.service_key.as_str()),
            ("_type", "json"),
        ];

        let url = format!("{}/getRouteAcctoThrghSttnList", self.tago_base_url);
        let resp: reqwest::Response = self.client.get(&url).query(&params).send().await?;

        let json: Value = match resp.json().await {
            Ok(v) => v,
            Err(_) => return Ok(None),
        };

        let items = extract_items(&json)?;
        if items.is_empty() {
            return Ok(None);
        }

        // Convert to internal RawStop
        let mut stops: Vec<RawStop> = items
            .iter()
            .map(|item| RawStop {
                node_id: item["nodeid"].as_str().unwrap_or("").to_string(),
                node_nm: item["nodenm"].as_str().unwrap_or("").to_string(),
                node_ord: item["nodeord"].as_i64().unwrap_or(0),
                node_no: parse_flexible_string(&item["nodeno"]),
                gps_lat: item["gpslati"].as_f64().unwrap_or(0.0),
                gps_long: item["gpslong"].as_f64().unwrap_or(0.0),
                up_down_cd: item["updowncd"]
                    .as_i64()
                    .or_else(|| item["updowncd"].as_str().and_then(|s| s.parse().ok()))
                    .unwrap_or(0),
            })
            .collect();

        stops.sort_by_key(|s| s.node_ord);

        // Generate Metadata for routeMap.json
        let sequence_meta: Vec<Value> = stops
            .iter()
            .map(|s| {
                json!({
                    "nodeid": s.node_id, "nodeord": s.node_ord, "updowncd": s.up_down_cd
                })
            })
            .collect();

        let stops_map_data: Vec<(String, Value)> = stops
            .iter()
            .map(|s| {
                (
                    s.node_id.clone(),
                    json!({
                        "nodenm": s.node_nm, "nodeno": s.node_no,
                        "gpslati": s.gps_lat, "gpslong": s.gps_long
                    }),
                )
            })
            .collect();

        // Save RAW file
        let raw_file = RawRouteFile {
            route_id: route_id.clone(),
            route_no: route_no.clone(),
            fetched_at: Local::now().to_rfc3339(),
            stops,
        };

        let file_path = self.raw_dir.join(format!("{}_{}.json", route_no, route_id));
        tokio::fs::write(file_path, serde_json::to_string_pretty(&raw_file)?).await?;

        Ok(Some(RouteProcessData {
            route_id,
            route_no: route_no.clone(),
            details: json!({ "routeno": route_no, "sequence": sequence_meta }),
            stops_map: stops_map_data,
        }))
    }

    pub async fn save_route_map_json(
        &self,
        map: &BTreeMap<String, Vec<String>>,
        details: &HashMap<String, Value>,
        stops: &BTreeMap<String, Value>,
    ) -> Result<()> {
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

        // Get base directory for all mapping files
        let base_dir = self.mapping_file.parent().unwrap();

        // Save routeMap.json (route_numbers only)
        let route_map = json!({
            "lastUpdated": timestamp,
            "route_numbers": map,
        });
        tokio::fs::write(
            &self.mapping_file,
            serde_json::to_string_pretty(&route_map)?,
        )
        .await?;

        // Save routeDetails.json
        let route_details = json!({
            "lastUpdated": timestamp,
            "route_details": details,
        });
        tokio::fs::write(
            base_dir.join("routeDetails.json"),
            serde_json::to_string_pretty(&route_details)?,
        )
        .await?;

        // Save stationMap.json
        let station_map = json!({
            "lastUpdated": timestamp,
            "stations": stops,
        });
        tokio::fs::write(
            base_dir.join("stationMap.json"),
            serde_json::to_string_pretty(&station_map)?,
        )
        .await?;

        Ok(())
    }
}
