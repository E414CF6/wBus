# Open Source Routing Machine (OSRM) Setup Guide for ARM64 via Podman

This guide provides step-by-step instructions for setting up the **Open Source Routing Machine (OSRM)** backend on an *
*ARM64** architecture using **Podman**. This specific setup processes South Korean map data utilizing the MLD (
Multi-Level Dijkstra) algorithm.

## Prerequisites

Ensure your system has the following tools installed and accessible:

* **Git**: To clone the OSRM repository.
* **Podman**: For rootless container management and image building.
* **Wget**: To download the raw OpenStreetMap (OSM) data files.

## 1. Building the OSRM Image

Because pre-built ARM64 images are not always available or up-to-date on standard registries, we will build a custom
image directly from the official source. Podman natively handles multi-architecture builds.

```shell
# Navigate into the cloned repository
cd osrm-backend

# Build the image natively for ARM64 architecture
podman build \
  --platform linux/arm64 \
  -f docker/Dockerfile-debian \
  --build-arg DOCKER_TAG=local-arm64 \
  --build-arg BUILD_CONCURRENCY=8 \
  -t osrm-backend:arm64 .
```

## 2. Data Processing Pipeline

OSRM requires a specific preprocessing workflow to convert raw OSM data into an optimized, highly efficient routing
format.

### Download Map Data

Download the latest OpenStreetMap (OSM) data for South Korea from the Geofabrik repository. Create or navigate to your
target `storage` directory and run:

```shell
# Download the latest South Korea map data
wget https://download.geofabrik.de/asia/south-korea-latest.osm.pbf
```

### Extract and Prepare Data

We will use the **MLD (Multi-Level Dijkstra)** algorithm, which is highly flexible and allows for fast dynamic updates.

| Phase         | Command          | Description                                                                |
|---------------|------------------|----------------------------------------------------------------------------|
| **Extract**   | `osrm-extract`   | Converts `.osm.pbf` to `.osrm` format using a routing profile (e.g., car). |
| **Partition** | `osrm-partition` | Partitions the graph into cells recursively for the MLD algorithm.         |
| **Customize** | `osrm-customize` | Calculates the routing weights for the partitioned cells.                  |

Run the following commands sequentially to process the data.

> **Note:** The `-t 8` flag specifies the number of threads. Adjust this value based on your system's CPU core count to
> optimize processing speed.

```shell
# 1. Extract data using the Car profile
podman run --rm -t -v $(pwd):/data osrm-backend:arm64 \
  osrm-extract -p /opt/car.lua /data/south-korea-latest.osm.pbf -t 8

# 2. Partition the data
podman run --rm -t -v $(pwd):/data osrm-backend:arm64 \
  osrm-partition /data/south-korea-latest.osrm -t 8

# 3. Customize the data
podman run --rm -t -v $(pwd):/data osrm-backend:arm64 \
  osrm-customize /data/south-korea-latest.osrm -t 8
```

## 3. Running the Routing Server

### Start the Backend Engine

Deploy the OSRM routing engine as a detached, background container. We map the container's default port (`5000`) to the
host's port (`4000`).

```shell
podman run -d \
  --name osrm-backend \
  -p 4000:5000 \
  -v $(pwd):/data \
  osrm-backend:arm64 \
  osrm-routed --algorithm mld /data/south-korea-latest.osrm
```

### Start the Frontend UI (Optional)

If you require a web-based map interface for testing, you can spin up the official OSRM frontend container.

```shell
# Access the web UI at http://localhost:9966 once running
podman run -d \
  --name osrm-frontend \
  -p 9966:9966 \
  osrm/osrm-frontend
```

## 4. Verification

You can verify that your backend server is running and routing correctly by sending a sample request via `curl`.

> **Note:** The coordinates used below (`Longitude,Latitude`) represent a sample route in South Korea, driving roughly
> from Seoul to Busan.

```shell
# Query the backend on host port 4000
curl "http://127.0.0.1:4000/route/v1/driving/127.0276,37.4979;129.0756,35.1796?steps=true"
```

### Storage Warning

> Ensure you have sufficient disk space before starting the data processing phase. The extracted and partitioned `.osrm`
> files will be significantly larger than the initial compressed `.osm.pbf` file.
