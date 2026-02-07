# OSRM Backend Setup Guide (ARM64 / Podman)

This guide provides step-by-step instructions for setting up the **Open Source Routing Machine (OSRM)** backend on **ARM64** architecture using **Podman**. This setup utilizes the South Korea map data and the MLD (Multi-Level Dijkstra) algorithm.

## Prerequisites

Ensure your system has the following tools installed:

* **Git**: To clone the repository.
* **Podman**: For container management and image building.
* **Wget**: To download the OpenStreetMap (OSM) data files.

First create a working directory for the OSRM setup:

```shell
mkdir OSRM && cd OSRM
```

## Building the OSRM Image

Since pre-built `ARM64` images might not always be available, we build a custom image from the official source using `buildx` to ensure compatibility.

```shell
# Clone the OSRM backend source code
git clone https://github.com/Project-OSRM/osrm-backend.git

# Navigate into the cloned repository
cd osrm-backend

# Build the image for ARM64 architecture
podman buildx build \
  --platform linux/arm64 \
  -f docker/Dockerfile-debian \
  --build-arg DOCKER_TAG=local-arm64 \
  --build-arg BUILD_CONCURRENCY=8 \
  --load \
  -t osrm-backend:arm64 .
```

## Data Processing Pipeline

OSRM requires a specific preprocessing workflow to convert raw OSM data into an optimized routing format.

### Download Map Data

Download the latest `OpenStreetMap (OSM)` data for `South Korea` from the Geofabrik repository.

```shell
# Download the latest South Korea map data
wget https://download.geofabrik.de/asia/south-korea-latest.osm.pbf
```

### Extract and Prepare Data

We use the **MLD (Multi-Level Dijkstra)** algorithm for flexibility.

| Phase | Command | Description |
| --- | --- | --- |
| **Extract** | `osrm-extract` | Converts `.osm.pbf` to `.osrm` format using a profile (e.g., car). |
| **Partition** | `osrm-partition` | Partitions the graph into cells for the MLD algorithm. |
| **Customize** | `osrm-customize` | Calculates routing weights for the partitioned cells. |

```shell
# Extract data using the Car profile
podman run --rm -t -v $(pwd):/data osrm-backend:arm64 \
  osrm-extract -p /opt/car.lua /data/south-korea-latest.osm.pbf

# Partition the data
podman run --rm -t -v $(pwd):/data osrm-backend:arm64 \
  osrm-partition /data/south-korea-latest.osrm

# Customize the data
podman run --rm -t -v $(pwd):/data osrm-backend:arm64 \
  osrm-customize /data/south-korea-latest.osrm
```

## Running the Routing Server

### Start the Backend

Deploy the OSRM routing engine as a background container.

```shell
podman run -d \
  --name osrm-backend \
  -p 3000:5000 \
  -v $(pwd):/data \
  osrm-backend:arm64 \
  osrm-routed --algorithm mld /data/south-korea-latest.osrm
```

### Start the Frontend (Optional)

If you need a web-based map interface, run the OSRM frontend container.

```shell
# Access the web UI at http://localhost:9966
podman run -d \
  --name osrm-frontend \
  -p 9966:9966 \
  osrm/osrm-frontend
```

## Verification

You can verify the server is running correctly by sending a sample routing request via `curl`.

> **Note:** The coordinates used below represent a sample route within South Korea.

```shell
curl "http://127.0.0.1:3000/route/v1/driving/127.0276,37.4979;129.0756,35.1796?steps=true"
```

### Important Notes

* **Performance**: The `-t 16` flag specifies the number of threads. Adjust this value based on your CPU core count for optimal performance.
* **Storage**: Ensure you have enough disk space, as the extracted `.osrm` files are significantly larger than the initial `.osm.pbf` file.
