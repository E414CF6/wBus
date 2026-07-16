use std::time::Duration;

use anyhow::Result;
use percent_encoding::{NON_ALPHANUMERIC, percent_encode};
use reqwest::{Client, header};

use crate::config::{BASE_URL, DETAIL_URL};

pub struct ScheduleClient {
    client: Client,
}

impl ScheduleClient {
    pub fn new() -> Result<Self> {
        // Initialize an HTTP client that mimics a web browser.
        // Cookie store is enabled to automatically handle session cookies (JSESSIONID),
        // which is crucial for making subsequent requests to the detail page.
        let client = Client::builder()
            .cookie_store(true)
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .timeout(Duration::from_secs(30))
            .build()?;

        Ok(Self { client })
    }

    pub async fn fetch_main_page(&self) -> Result<String> {
        let resp = self.client.get(BASE_URL).send().await?.text().await?;
        Ok(resp)
    }

    pub async fn fetch_detail_page(&self, route_id: &str) -> Result<String> {
        // The website expects the route ID in the POST body to be percent-encoded UTF-8.
        let encoded_val = percent_encode(route_id.as_bytes(), NON_ALPHANUMERIC).to_string();
        let body_str = format!("no={}", encoded_val);

        // Send a POST request to get the detailed schedule for the specific route_id.
        // It's crucial to set the correct headers (Referer, Origin, Content-Type)
        // to simulate a legitimate request originating from the website.
        let resp = self
            .client
            .post(DETAIL_URL)
            .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
            .header(header::REFERER, BASE_URL)
            .header(header::ORIGIN, "http://its.wonju.go.kr")
            .body(body_str)
            .send()
            .await?;

        resp.error_for_status_ref()?;
        let html = resp.text().await?;
        Ok(html)
    }
}
