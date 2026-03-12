use serde_json::Value;

use crate::config::{OSRM_CONTINUE_STRAIGHT, OSRM_GEOMETRIES, OSRM_OVERVIEW, OSRM_SNAP_RADIUS};
use crate::route::model::{BusRouteProcessor, RawStop};
use crate::utils::geo::closest_point_on_polyline;

impl BusRouteProcessor {
    pub async fn sanitize_stops_to_corridor(&self, stops: &mut [RawStop]) {
        if stops.len() < 3 {
            return;
        }

        for i in 1..stops.len() - 1 {
            if stops[i - 1].up_down_cd != stops[i].up_down_cd
                || stops[i].up_down_cd != stops[i + 1].up_down_cd
            {
                continue;
            }

            let corr = self
                .fetch_osrm_route_between(&stops[i - 1], &stops[i + 1])
                .await;
            if let Some((corr, _, _)) = corr {
                let p = (stops[i].gps_long, stops[i].gps_lat);
                if let Some(((cx, cy), d)) = closest_point_on_polyline(p, &corr)
                    && d <= 90.0
                {
                    stops[i].gps_long = cx;
                    stops[i].gps_lat = cy;
                }
            }
        }
    }

    pub async fn fetch_osrm_route_between(
        &self,
        a: &RawStop,
        b: &RawStop,
    ) -> Option<(Vec<Vec<f64>>, f64, f64)> {
        let coords = format!(
            "{:.6},{:.6};{:.6},{:.6}",
            a.gps_long, a.gps_lat, b.gps_long, b.gps_lat
        );

        let radiuses = format!("{:.0};{:.0}", OSRM_SNAP_RADIUS, OSRM_SNAP_RADIUS);
        self.call_osrm(&coords, Some(&radiuses)).await
    }

    pub async fn fetch_osrm_route(&self, stops: &[RawStop]) -> Option<(Vec<Vec<f64>>, f64, f64)> {
        let coords = stops
            .iter()
            .map(|s| format!("{:.6},{:.6}", s.gps_long, s.gps_lat))
            .collect::<Vec<_>>()
            .join(";");

        let radiuses = vec![format!("{:.0}", OSRM_SNAP_RADIUS); stops.len()].join(";");

        self.call_osrm(&coords, Some(&radiuses)).await
    }

    pub async fn call_osrm(
        &self,
        coords_param: &str,
        radiuses_param: Option<&str>,
    ) -> Option<(Vec<Vec<f64>>, f64, f64)> {
        let mut attempts = 0;
        let max_attempts = 5;
        let mut current_radius = OSRM_SNAP_RADIUS;
        let num_coords = coords_param.split(';').count();

        let mut custom_radiuses: Option<String> = radiuses_param.map(|s| s.to_string());

        while attempts < max_attempts {
            let mut url = format!(
                "{}/{coords}?overview={overview}&geometries={geometries}&steps=false&continue_straight={cont}&snapping=any",
                self.osrm_base_url,
                coords = coords_param,
                overview = OSRM_OVERVIEW,
                geometries = OSRM_GEOMETRIES,
                cont = OSRM_CONTINUE_STRAIGHT
            );

            if let Some(ref r) = custom_radiuses {
                url.push_str(&format!("&radiuses={}", r));
            }

            match self.client.get(&url).send().await {
                Ok(resp) => {
                    let status = resp.status();
                    if status.is_success() {
                        let json: Value = match resp.json().await {
                            Ok(v) => v,
                            Err(e) => {
                                log::error!("Failed to parse OSRM JSON: {}", e);
                                return None;
                            }
                        };

                        let route = &json["routes"][0];

                        let coords: Vec<Vec<f64>> = match serde_json::from_value(
                            route["geometry"]["coordinates"].clone(),
                        ) {
                            Ok(c) => c,
                            Err(_) => return None,
                        };

                        let distance = route["distance"].as_f64().unwrap_or(0.0);
                        let duration = route["duration"].as_f64().unwrap_or(0.0);

                        if coords.is_empty() {
                            log::error!("OSRM returned empty coordinates array.");
                            return None;
                        } else {
                            return Some((coords, distance, duration));
                        }
                    } else if status == reqwest::StatusCode::BAD_REQUEST {
                        let err_text = resp.text().await.unwrap_or_default();
                        if err_text.contains("NoSegment") {
                            attempts += 1;
                            if attempts < max_attempts {
                                current_radius += 100.0;
                                let radius_str = format!("{:.0}", current_radius);
                                custom_radiuses = Some(
                                    (0..num_coords)
                                        .map(|_| radius_str.as_str())
                                        .collect::<Vec<_>>()
                                        .join(";"),
                                );
                                log::warn!(
                                    "OSRM NoSegment error (attempt {}/{}). Retrying with radius {}m...",
                                    attempts,
                                    max_attempts,
                                    current_radius
                                );
                                continue;
                            } else {
                                log::error!(
                                    "OSRM NoSegment error after {} attempts for URL: {}. Error: {}",
                                    max_attempts,
                                    url,
                                    err_text
                                );
                                return None;
                            }
                        } else {
                            log::error!("OSRM returned status: {} for URL: {}", status, url);
                            log::error!("OSRM Error response: {}", err_text);
                            return None;
                        }
                    } else {
                        log::error!("OSRM returned status: {} for URL: {}", status, url);
                        let err_text = resp.text().await.unwrap_or_default();
                        log::error!("OSRM Error response: {}", err_text);
                        return None;
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    #[tokio::test]
    async fn test_call_osrm_retry_on_nosegment() {
        let _ = env_logger::builder().is_test(true).try_init();
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let osrm_url = format!("http://{}", addr);

        let processor = BusRouteProcessor {
            client: reqwest::Client::new(),
            service_key: "".to_string(),
            city_code: "".to_string(),
            raw_dir: PathBuf::new(),
            derived_dir: PathBuf::new(),
            mapping_file: PathBuf::new(),
            tago_base_url: "".to_string(),
            osrm_base_url: osrm_url,
        };

        // Spawn a task to mock the OSRM server
        tokio::spawn(async move {
            // First request: return 400 NoSegment
            if let Ok((mut socket, _)) = listener.accept().await {
                let mut buf = [0; 4096];
                let n = socket.read(&mut buf).await.unwrap();
                println!(
                    "Mock Server received 1st request: {}",
                    String::from_utf8_lossy(&buf[..n])
                );
                let body =
                    "{\"code\":\"NoSegment\",\"message\":\"Could not find a matching segment\"}";
                let response = format!(
                    "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                    body.len(),
                    body
                );
                socket.write_all(response.as_bytes()).await.unwrap();
            }

            // Second request: return success
            if let Ok((mut socket, _)) = listener.accept().await {
                let mut buf = [0; 4096];
                let n = socket.read(&mut buf).await.unwrap();
                println!(
                    "Mock Server received 2nd request: {}",
                    String::from_utf8_lossy(&buf[..n])
                );
                let request_str = String::from_utf8_lossy(&buf[..n]);
                // Check if radius was increased (initial 30 + 100 = 130)
                if request_str.contains("radiuses=130%3B130")
                    || request_str.contains("radiuses=130;130")
                {
                    let body = "{\"routes\":[{\"geometry\":{\"coordinates\":[[127.0,37.0],[127.1,37.1]]},\"distance\":100.0,\"duration\":10.0}]}";
                    let response = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                        body.len(),
                        body
                    );
                    socket.write_all(response.as_bytes()).await.unwrap();
                } else {
                    println!("Radius check failed!");
                    let body = "{\"code\":\"Error\",\"message\":\"Radius not increased\"}";
                    let response = format!(
                        "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                        body.len(),
                        body
                    );
                    socket.write_all(response.as_bytes()).await.unwrap();
                }
            }
        });

        let result = processor
            .call_osrm("127.0,37.0;127.1,37.1", Some("30;30"))
            .await;
        assert!(result.is_some());
        let (coords, dist, dur) = result.unwrap();
        assert_eq!(coords.len(), 2);
        assert_eq!(dist, 100.0);
        assert_eq!(dur, 10.0);
    }
}
