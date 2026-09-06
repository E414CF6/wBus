# Open Source Routing Machine (OSRM) Setup Guide

This guide provides instructions for deploying and running a local **Open Source Routing Machine (OSRM)** backend
instance for the wBus polyline generation pipeline. This pipeline processes South Korea OpenStreetMap (OSM) vector data
utilizing the **MLD (Multi-Level Dijkstra)** algorithm to compute road-matched bus route segments.

---

## Overview

wBus uses OSRM during its offline data pipeline (`scripts/generate-polyline-segment.mjs`) to snap raw bus stop GPS
coordinates onto realistic road networks. Rather than displaying crude straight lines between transit stops, the
pipeline generates accurate, road-aligned GeoJSON vector polylines that follow actual street geography.

```
Raw Bus Stops (TAGO) ----> OSRM Match / Route ----> Snapped Segments (GeoJSON)
(Longitude, Latitude)      (Local Port 4000)        (public/routes/*.json)
```

---

## Prerequisites

Ensure the following utilities are installed on your host machine:

- **Container Engine**: [Podman](https://podman.io/) (recommended for rootless execution)
  or [Docker](https://www.docker.com/)
- **Git**: For source retrieval
- **Wget** or **cURL**: For downloading OSM dataset files
- **Hardware Resources**: At least 8 GB of available RAM and 15 GB of free disk space for South Korea data processing

---

## 1. Building the OSRM Container Image

Pre-built container images on public registries may lack optimization or binary compatibility for specific architectures
(such as Apple Silicon `linux/arm64`). Building directly from the official repository ensures native execution and
maximum throughput.

Clone the official repository if not already present:

```bash
cd scripts/osrm-assets
git clone https://github.com/Project-OSRM/osrm-backend.git
cd osrm-backend
```

Build the container image natively:

### Using Podman (ARM64 / Apple Silicon)

```bash
podman build \
  --platform linux/arm64 \
  -f docker/Dockerfile-debian \
  --build-arg DOCKER_TAG=local-arm64 \
  --build-arg BUILD_CONCURRENCY=8 \
  -t osrm-backend:arm64 .
```

### Using Docker (x86_64 or ARM64)

```bash
docker build \
  -f docker/Dockerfile-debian \
  --build-arg BUILD_CONCURRENCY=8 \
  -t osrm-backend:local .
```

---

## 2. Map Data Acquisition and Preprocessing

OSRM requires preprocessed routing graphs derived from raw `.osm.pbf` dumps. The **MLD (Multi-Level Dijkstra)**
algorithm is used because it supports fast partitioning, customizable metric updates, and lower memory overhead compared
to CH (Contraction Hierarchies).

### Step 1: Download Map Data

Download the latest South Korea OpenStreetMap extract provided by Geofabrik:

```bash
# From scripts/osrm-assets directory
mkdir -p storage
cd storage

wget https://download.geofabrik.de/asia/south-korea-latest.osm.pbf
cd ..
```

### Step 2: Extract and Prepare Routing Graphs

Execute the three preprocessing stages sequentially:

| Stage            | Binary           | Function                                                                         |
|:-----------------|:-----------------|:---------------------------------------------------------------------------------|
| **1. Extract**   | `osrm-extract`   | Parses `.osm.pbf` and builds node networks using the driving profile (`car.lua`) |
| **2. Partition** | `osrm-partition` | Recursively partitions the routing graph into hierarchical cells                 |
| **3. Customize** | `osrm-customize` | Calculates cell weights and routing penalties across partitions                  |

Run the preprocessing commands:

#### Podman

```bash
# 1. Extract network
podman run --rm -t -v "$(pwd)":/data osrm-backend:arm64 \
  osrm-extract -p /opt/car.lua /data/storage/south-korea-latest.osm.pbf -t 8

# 2. Partition graph
podman run --rm -t -v "$(pwd)":/data osrm-backend:arm64 \
  osrm-partition /data/storage/south-korea-latest.osrm -t 8

# 3. Customize cell weights
podman run --rm -t -v "$(pwd)":/data osrm-backend:arm64 \
  osrm-customize /data/storage/south-korea-latest.osrm -t 8
```

#### Docker

```bash
# 1. Extract network
docker run --rm -t -v "$(pwd)":/data osrm-backend:local \
  osrm-extract -p /opt/car.lua /data/storage/south-korea-latest.osm.pbf -t 8

# 2. Partition graph
docker run --rm -t -v "$(pwd)":/data osrm-backend:local \
  osrm-partition /data/storage/south-korea-latest.osrm -t 8

# 3. Customize cell weights
docker run --rm -t -v "$(pwd)":/data osrm-backend:local \
  osrm-customize /data/storage/south-korea-latest.osrm -t 8
```

> [!NOTE]
> The `-t 8` parameter sets the thread concurrency. Adjust this number according to the CPU core count of your machine.

---

## 3. Launching the Routing Engine

Run the OSRM routing daemon (`osrm-routed`) as a background service. Map container port `5000` to host port `4000`,
matching the wBus pipeline default.

### Podman

```bash
podman run -d \
  --name osrm-backend \
  -p 4000:5000 \
  -v "$(pwd)":/data \
  --restart unless-stopped \
  osrm-backend:arm64 \
  osrm-routed --algorithm mld /data/storage/south-korea-latest.osrm
```

### Docker

```bash
docker run -d \
  --name osrm-backend \
  -p 4000:5000 \
  -v "$(pwd)":/data \
  --restart unless-stopped \
  osrm-backend:local \
  osrm-routed --algorithm mld /data/storage/south-korea-latest.osrm
```

---

## 4. Verification and Health Check

Verify that the local routing server is operational by querying a driving path between Wonju Station and Yonsei
University Mirae Campus:

```bash
curl "http://127.0.0.1:4000/route/v1/driving/127.9452,37.3422;127.9083,37.2831?overview=full&geometries=geojson"
```

A successful response returns an HTTP 200 payload with `"code": "Ok"` and a GeoJSON `coordinates` array containing the
road-matched route geometry.

---

## 5. Integrating with wBus

Once the OSRM backend is active on port `4000`, return to the root wBus project directory and run the polyline
generation script:

```bash
# Navigate back to project root
cd ../..

# Generate all route polylines and segment caches
npm run polyline
```

The script connects to `http://localhost:4000/route/v1/driving` by default (or the value set in `OSRM_API_URL`), snaps
station sequences to the underlying street network, and outputs production assets into `public/routes/*.json` and
`public/routeMap.json`.

---

## Troubleshooting and Notes

- **Disk Space**: The uncompressed and partitioned `.osrm.*` files occupy approximately 4 GB to 8 GB of storage for the
  South Korea dataset.
- **Port Conflicts**: If port `4000` is already occupied, map to another port (e.g., `-p 5001:5000`) and set
  `OSRM_API_URL="http://localhost:5001/route/v1/driving"` in `.env.local`.
- **Snapping Fallback**: The wBus script (`scripts/generate-polyline-segment.mjs`) includes automatic straight-line
  fallback. If OSRM is unreachable or a waypoint cannot be snapped within the configured radius (25 meters), the
  pipeline logs a warning and joins the coordinates directly to prevent build failures.
