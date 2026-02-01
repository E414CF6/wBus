//! Utility functions and modules for Polly.
//!
//! This module itself contains general utility functions, while specific utilities
//! are organized into submodules.

pub mod geo;

use std::fs;
use std::path::Path;

use anyhow::Result;
use serde_json::Value;

pub fn ensure_dir(path: &Path) -> Result<()> {
    if !path.exists() {
        fs::create_dir_all(path)?;
    }
    Ok(())
}

pub fn get_env(key: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| "".to_string())
}

pub fn resolve_url(key: &str, default: &str) -> String {
    let v = get_env(key);
    if v.is_empty() { default.to_string() } else { v }
}

pub fn extract_items(json: &Value) -> Result<Vec<Value>> {
    let items = &json["response"]["body"]["items"]["item"];
    if let Some(arr) = items.as_array() {
        Ok(arr.clone())
    } else if let Some(obj) = items.as_object() {
        Ok(vec![Value::Object(obj.clone())])
    } else {
        Ok(vec![])
    }
}

pub fn parse_flexible_string(v: &Value) -> String {
    if let Some(s) = v.as_str() {
        s.to_string()
    } else if let Some(n) = v.as_i64() {
        n.to_string()
    } else {
        "UNKNOWN".to_string()
    }
}
