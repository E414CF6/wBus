use serde_json::Value;

use crate::route::model::{BusRouteProcessor, RawStop};
use crate::utils::geo::closest_point_on_polyline;

impl BusRouteProcessor {
    pub async fn sanitize_stops_to_corridor(&self, stops: &mut [RawStop]) {
        if stops.len() < 3 {
            return;
        }

        for i in 1..stops.len() - 1 {
            let corr = self
                .fetch_osrm_route_between(&stops[i - 1], &stops[i + 1])
                .await;
            if let Some(corr) = corr {
                let p = (stops[i].gps_long, stops[i].gps_lat);
                if let Some(((cx, cy), d)) = closest_point_on_polyline(p, &corr) {
                    if d <= 90.0 {
                        stops[i].gps_long = cx;
                        stops[i].gps_lat = cy;
                    }
                }
            }
        }
    }

    pub async fn fetch_osrm_route_between(
        &self,
        a: &RawStop,
        b: &RawStop,
    ) -> Option<Vec<Vec<f64>>> {
        let coords = format!(
            "{:.6},{:.6};{:.6},{:.6}",
            a.gps_long, a.gps_lat, b.gps_long, b.gps_lat
        );

        self.call_osrm(&coords).await
    }

    pub async fn fetch_osrm_route(&self, stops: &[RawStop]) -> Option<Vec<Vec<f64>>> {
        let coords = stops
            .iter()
            .map(|s| format!("{:.6},{:.6}", s.gps_long, s.gps_lat))
            .collect::<Vec<_>>()
            .join(";");

        self.call_osrm(&coords).await
    }

    pub async fn call_osrm(&self, coords_param: &str) -> Option<Vec<Vec<f64>>> {
        let url = format!(
            "{}/{coords}?overview=full&geometries=geojson&steps=false&continue_straight=true",
            self.osrm_base_url,
            coords = coords_param
        );

        let mut attempts = 0;
        let max_attempts = 3;

        while attempts < max_attempts {
            match self.client.get(&url).send().await {
                Ok(resp) => {
                    if !resp.status().is_success() {
                        log::error!("OSRM returned status: {} for URL: {}", resp.status(), url);
                        let err_text = resp.text().await.unwrap_or_default();
                        log::error!("OSRM Error response: {}", err_text);
                        return None;
                    }

                    let json: Value = match resp.json().await {
                        Ok(v) => v,
                        Err(e) => {
                            log::error!("Failed to parse OSRM JSON: {}", e);
                            return None;
                        }
                    };

                    let coords: Vec<Vec<f64>> = match serde_json::from_value(
                        json["routes"][0]["geometry"]["coordinates"].clone(),
                    ) {
                        Ok(c) => c,
                        Err(_) => return None,
                    };

                    if coords.is_empty() {
                        log::error!("OSRM returned empty coordinates array.");
                        return None;
                    } else {
                        return Some(coords);
                    }
                }
                Err(e) => {
                    attempts += 1;
                    if attempts < max_attempts {
                        log::warn!(
                            "OSRM request failed (attempt {}/{}): {}. Retrying in 500ms...",
                            attempts,
                            max_attempts,
                            e
                        );
                        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                    } else {
                        log::error!("OSRM request failed after {} attempts: {}", max_attempts, e);
                    }
                }
            }
        }

        None
    }
}
