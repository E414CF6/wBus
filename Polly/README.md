# Polly: The wBus Data Pipeline

[![License: MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Rust: 2024 Edition](https://img.shields.io/badge/Rust-2024%20Edition-orange.svg)](https://www.rust-lang.org/)

Polly is the backend data processing engine for `wBus`. It is a Rust-based command-line tool responsible for collecting,
processing, and packaging bus route and schedule data. It fetches raw data from public APIs and websites, cleans it, and
transforms it into a format ready to be consumed by the frontend application.

## Overview

Polly serves two primary functions:

1. **Route Processing**: It fetches bus route information, including stop locations and sequences, from the
   national [TAGO (Transport APIs of Government Open Data)](https://www.data.go.kr/) service. It then uses
   an [OSRM](http://project-osrm.org/) backend to snap the raw point-to-point routes to actual road geometries,
   producing clean GeoJSON polylines.
2. **Schedule Scraping**: It crawls the Wonju Bus Information website to extract static bus schedules, converting the
   HTML tables into structured JSON files for each route.

The resulting data is stored locally, ready for deployment to a static file host or for use by the `wBus` frontend.

## Features

- **Route Collection**: Fetches route metadata and stop coordinates from the TAGO API.
- **Route Snapping**: Aligns raw route paths with road networks using a configurable OSRM instance.
- **Schedule Crawling**: Parses HTML from the Wonju bus information system for schedule data.
- **Data Packaging**: Generates a consolidated `routeMap.json` containing all stops and route metadata, plus individual
  GeoJSON files for each route's path and JSON files for schedules.
- **CLI Interface**: Provides commands to run the route and schedule processors independently, with options for
  filtering and controlling the workflow.

## Prerequisites

- **Rust** (2024 Edition or later)
- **TAGO API Service Key**: A valid (decoded) service key from [data.go.kr](https://www.data.go.kr/).
- **OSRM Backend**: An accessible OSRM instance for route snapping. A local setup is recommended for performance.
  See [OSRM Setup Guide](../Route/README.md) for setup instructions.
- **Network Access**: Internet connectivity to reach the TAGO API and the Wonju bus information website.

## Setup and Configuration

1. **Clone the repository and navigate to the Polly directory:**

    ```bash
    git clone https://github.com/your-repo/wBus.git
    cd wBus/Polly
    ```

2. **Create a `.env` file from the example:**

    ```bash
    cp .env.example .env
    ```

3. **Configure your environment variables in the `.env` file:**
    - `DATA_GO_KR_SERVICE_KEY`: Your decoded TAGO API key. **(Required)**
    - `OSRM_API_URL`: The URL of your OSRM routing server. Defaults to the public OSRM demo server, but a local instance
      is highly recommended.
    - `TAGO_API_URL`: The base URL for the TAGO API. The default should be sufficient.

    ```dotenv
    # .env
    DATA_GO_KR_SERVICE_KEY="YOUR_DECODED_TAGO_API_KEY"
    OSRM_API_URL="http://localhost:4000/route/v1/driving"
    ```

## Usage

Polly provides two main commands: `route` and `schedule`.

### Route Processor

This command handles fetching, processing, and snapping route data.

**Run a full pipeline for all routes:**
*(Fetches from TAGO, snaps with OSRM, and builds the station map)*

```bash
cargo run --release -- route
```

**Common Options:**

- `--city-code <CODE>`: Set the city code for the API. (Default: `32020` for Wonju)
- `--route <NUMBER>`: Process only a specific route number (e.g., `--route 2`).
- `--output-dir <PATH>`: Specify a different output directory. (Default: `./storage`)
- `--station-map-only`: Only fetch data and generate `routeMap.json`, skipping the OSRM snapping process.
- `--osrm-only`: Only perform OSRM snapping on existing raw route files, skipping the TAGO API fetch.

### Schedule Processor

This command scrapes the Wonju bus website for schedule information.

**Crawl schedules for all routes:**

```bash
cargo run --release -- schedule
```

**Crawl for a single route:**

```bash
cargo run --release -- schedule --route 2
```

## Output Structure

The processed data is saved in the `storage/` directory, organized as follows:

```text
storage/
├── cache/               # Intermediate API response data (cached)
├── polylines/           # OSRM-snapped GeoJSON routes (final)
├── schedules/           # Structured JSON schedules for each route
├── routeMap.json        # Consolidated station and route metadata
├── stationMap.json      # Detailed station information
└── routeDetails.json    # Detailed route information
```

## Technical Notes

- OSRM requests are sent in batches to avoid exceeding URL length limits on public servers.
- GPS coordinates are validated to ensure they fall within a reasonable bounding box for South Korea, filtering out
  erroneous data points.
- The schedule scraper is designed for the current structure of the Wonju bus website. Significant changes to the site
  may require updates to the scraper logic.
