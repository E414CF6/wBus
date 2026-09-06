# wBus

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript 6](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-6.7-blue?logo=maplibre)](https://maplibre.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Realtime-3ECF8E?logo=supabase)](https://supabase.com/)

wBus is a modern, high-performance public transit tracking, timetable exploration, and passenger community web platform
built for Wonju City (원주시), South Korea. Engineered specifically to solve transit scheduling pain points—particularly
for Wonju citizens and commuters heading to and from Yonsei University Mirae Campus—wBus combines real-time GPS vehicle
tracking, automated route polyline snapping, municipal timetable scraping, official service alerts, and an anonymous,
real-time passenger discussion square.

---

## Key Features

### Dedicated Yonsei University Mode

- **Campus Departure Isolation**: Curated schedule directories specifically for routes **30**, **34**, and **34-1**.
- **Depot Filtering**: Eliminates misleading depot origin times (Jangyang-ri), displaying only verified **Yonsei
  University campus departures** (Routes 30 & 34) and **Hoechon departures** (Route 34-1).
- **Live Departure Spotlight**: Automatically calculates the next upcoming departure with a dynamic countdown timer
  (`N minutes remaining`), scheduled departure indicators, and real-time status cues.
- **Detailed Timetable Modal**: Single-column inspection drawer showing full operational runs, departure sequences,
  operational notes (e.g., via Maeji-ri / Wonju Station), and single-click CSV export functionality.

### Interactive Real-Time Map and Telemetry

- **On-Demand Engine Loading**: The MapLibre GL engine and telemetry listeners are mounted exclusively when the user
  navigates to the Real-Time Map tab.
- **Zero Overhead on Schedules**: Browsing timetables triggers zero background map tile transfers or telemetry requests,
  maximizing battery life and conserving mobile data.
- **Polyline Map-Matching**: Bus GPS coordinates from the national transit portal are matched onto high-precision OSRM
  route polylines with 3-second animated transition smoothing.
- **Directional Clarity**: Automatic detection of UP (outbound) and DOWN (inbound) vehicle paths, vehicle occupancy
  badges, and interactive bus stop arrival estimates.

### Passenger Community and Real-Time Square

- **Live Discussion Threads**: Full support for root posts and nested responses, enabling organized discussions
  regarding road congestion, unexpected delays, or transit tips.
- **Real-Time Synchronization**: Built on Supabase Realtime (PostgreSQL change replication) for instant message delivery
  with HTTP REST fallback.
- **Route and Topic Categorization**: Filter conversation streams by specific bus routes (e.g., 30, 34, 34-1) or
  conversation categories (Reports, Tips, Questions, Lost and Found, Free Chat).
- **One-Tap Quick Reports**: Preset chips to broadcast road conditions, crowded buses, empty seats, or lost items in
  seconds.
- **Anonymous Identity System**: Ephemeral yet consistent user identification based on client-generated hash tags
  (`#a1b2c3`) paired with transit-themed Korean pseudonyms, eliminating login friction while preserving context.
- **Security and Abuse Guardrails**: Client IP hashing via SHA-256, in-memory sliding window rate limiters, duplicate
  content prevention, like throttling, and author-validated deletion.

### Comprehensive City-Wide Timetables

- **Complete Route Coverage**: Directory covering all active bus routes operating throughout Wonju City, scraped
  directly from the Wonju Intelligent Transportation System (ITS).
- **Operational Day Modes**: Multi-calendar switching between Automatic detection, Weekdays, Saturdays, and Sundays or
  National Holidays.
- **Client-Side Bookmarks**: Bookmark favorite bus routes with persistence in browser LocalStorage.
- **Cross-View Navigation**: Launch directly into the real-time map view with the target route preselected from any
  timetable card.

### Wonju ITS Notice Center

- **Municipal Announcements**: Direct ingestion and caching of service changes, construction detours, and schedule
  adjustments published by Wonju City ITS.
- **In-App Notice Drawer**: Dismissible header alerts and dedicated detail modals to read official notices without
  leaving the app.

### Resilient Multi-Tier Caching

- **Tiered Cache Architecture**: L1 In-Memory LRU Cache with request deduplication and coalescing, coupled with CDN edge
  micro-caching (`s-maxage=2, stale-while-revalidate=3`).
- **Circuit Breaking and Fallbacks**: Graceful fallback to static cached snapshots whenever external government APIs
  experience timeouts or service outages.

---

## System Architecture

The project adheres to **Feature-Sliced Design (FSD)** principles, enforcing strict modular boundaries, unidirectional
dependencies, and domain-driven encapsulation:

```
src/
|-- app/                      # Next.js App Router
|   |-- api/                  # Serverless API routes and edge endpoints
|   |   |-- bus/              # Route schedules, health checks, cache refresh
|   |   |   |-- [routeId]/    # Real-time telemetry endpoint for route ID
|   |   |   |-- health/       # External API connectivity check
|   |   |   `-- refresh/      # Forced schedule scraper trigger
|   |   |-- bus-arrival/      # Bus stop estimated arrival query
|   |   |-- bus-stops/        # Stop list for route ID
|   |   |-- comments/         # Passenger Community CRUD and moderation
|   |   |-- notice/           # Wonju ITS announcements
|   |   |-- route-stops/      # Directional stops by route name
|   |   |-- schedule/         # Timetable data and refresh trigger
|   |   `-- data/             # Static file fallback handler
|   |-- chat/                 # Community page route (/chat alias)
|   |-- live/                 # Real-time map route (/live alias)
|   |-- map/                  # Real-time map route (/map)
|   |-- privacy/              # Privacy policy documentation
|   |-- schedule/             # Timetable page route (/schedule)
|   |-- square/               # Community page route (/square)
|   |-- globals.css           # Tailwind CSS 4 theme imports and utility rules
|   |-- layout.tsx            # Root HTML layout, font setup, theme provider
|   `-- page.tsx              # Application shell entry point
|-- data/                     # Fallback datasets and route identifiers
|-- entities/                 # Domain entities and core business definitions
|   |-- bus/                  # Bus telemetry types, transformers, and utilities
|   |-- comment/              # Comment models, service layers, and Supabase hooks
|   |-- notice/               # Notice parsers and storage models
|   |-- route/                # Route definitions, polyline hooks, color palettes
|   |-- schedule/             # Schedule definitions, time math, and parsers
|   `-- station/              # Bus stop coordinates and sequence definitions
|-- features/                 # User-centric application workflows
|   |-- live-tracking/        # Telemetry store, external store sync, direction math
|   `-- map-view/             # Map state persistence, route headers, viewport hooks
|-- shared/                   # Cross-cutting infrastructure and reusable UI
|   |-- animation/            # Interpolation and coordinate transition helpers
|   |-- api/                  # HTTP clients, retry wrappers, handler factories
|   |-- cache/                # CacheManager (LRU, TTL policies, request coalescing)
|   |-- config/               # Environment variable schemas, routes, storage keys
|   |-- context/              # Global application and map context providers
|   |-- hooks/                # Generic utility hooks (debounce, window size, etc.)
|   |-- lib/                  # Security hashing, rate limiting, time helpers
|   |-- supabase/             # Supabase browser and server client initializers
|   |-- types/                # Core TypeScript interfaces and shared schemas
|   |-- ui/                   # Design system primitives, bottom navigation bar
|   `-- utils/                # Coordinate math, route formatting, concurrency limiters
`-- widgets/                  # Composite UI modules
    |-- AppShell/             # Main tab orchestrator and route sync controller
    |-- BusListSheet/         # Interactive drawer listing active buses on route
    |-- ChatWidget/           # Passenger square chat view, thread lists, modals
    |-- MapContainer/         # MapLibre GL wrapper, vector route layers, live markers
    |-- NoticeWidget/         # ITS announcement banners and detail modals
    |-- TimetableWidget/      # City-wide searchable schedule directory
    `-- YonseiTimetableWidget/# Dedicated campus schedule cards and export modal
```

**Dependency Rule**: `app -> widgets -> features -> entities -> shared`.

---

## Data Pipeline and Telemetry Flow

```
+-------------------------------------------------------------------------+
|                         EXTERNAL DATA SOURCES                           |
|                                                                         |
|   apis.data.go.kr (TAGO API)    its.wonju.go.kr      OpenStreetMap      |
|   - Real-time bus telemetry     - Official schedules - Road network     |
|   - Bus stop arrival data       - Notice alerts        vector data      |
+-------------------+--------------------+-------------------+------------+
                    |                    |                   |
                    |                    |                   v
                    |                    |          +------------------+
                    |                    |          |   OSRM Engine    |
                    |                    |          | (MLD Algorithm)  |
                    |                    |          +--------+---------+
                    |                    |                   |
                    |                    |                   v
                    |                    |          +------------------+
                    |                    |          | scripts/cache/   |
                    |                    |          | (Polyline JSONs) |
                    |                    |          +--------+---------+
                    v                    v                   |
+---------------------------------------------------+        |
|                Next.js API Layer                  |        |
|  - GET /api/bus/[routeId]  (Micro-cached polling) |        |
|  - GET /api/bus            (Schedule metadata)    |        |
|  - GET /api/schedule       (Timetables)           |        |
|  - GET /api/notice         (Official ITS notices) |        |
|  - GET/POST/PATCH/DELETE /api/comments            |        v
+-------------------+-------------------------------+   +--------------+
|                   |                               |   | public/      |
|                   |                               |   | - routeMap   |
|                   v                               v   | - routes/*.  |
|   +-------------------------------+ +-------------------+ +--------------+
|   |       Supabase Backend        | |  CacheManager L1  |
|   | - PostgreSQL comments table   | | - In-Memory LRU   |
|   | - RPC like counter increment  | | - Request Coalesce|
|   | - Realtime WebSocket channel  | | - Edge Cache HTTP |
|   +---------------+---------------+ +---------+---------+
|                   |                           |
|                   +-------------+-------------+
|                                 |
|                                 v
+-------------------------------------------------------------------------+
|                          CLIENT APPLICATION                             |
|                                                                         |
|  Timetable View:                                                        |
|    - Instant schedule lookup from static JSON and local cache           |
|    - Zero telemetry network calls or background tile requests           |
|                                                                         |
|  Real-Time Map View:                                                    |
|    - MapLibre GL mounted dynamically with hardware acceleration         |
|    - BusLocationStore fetches /api/bus/[routeId] with 2-second caching  |
|    - Background tab detection suspends polling when window is hidden    |
|    - Smooth 3-second coordinate interpolation along route polylines     |
|                                                                         |
|  Passenger Square (Chat View):                                          |
|    - Real-time updates via Supabase WebSocket channel                   |
|    - Threaded discussion UI with anonymous author hashing               |
+-------------------------------------------------------------------------+
```

---

## Technology Stack

| Layer                   | Technologies                          | Details                                                 |
|:------------------------|:--------------------------------------|:--------------------------------------------------------|
| **Framework**           | Next.js 16 (App Router, Turbopack)    | Server Components, dynamic route handlers, fast refresh |
| **User Interface**      | React 19, Lucide React, Next Themes   | Strict concurrent mode, modern hooks, dark mode support |
| **Language**            | TypeScript 6 (Strict Mode)            | Full type safety across API handlers, models, and UI    |
| **Styling**             | Tailwind CSS 4, Modern CSS Directives | Variable-driven theme system, zero-runtime overhead     |
| **Map Rendering**       | MapLibre GL 6.7 via `react-map-gl`    | WebGL hardware-accelerated vector tile rendering        |
| **Real-Time Community** | Supabase Database & Realtime          | PostgreSQL persistence, Realtime replication channels   |
| **Telemetry & Sync**    | Custom `BusLocationStore`, SWR        | Micro-cached polling, tab visibility suspension         |
| **Data Ingestion**      | Node.js Fetch, OSRM MLD Routing       | TAGO REST integration, Cheerio ITS scraping             |
| **Testing**             | Vitest 5                              | High-speed unit tests covering utils, geo, and cache    |
| **Deployment**          | Vercel Serverless & Edge Network      | Global CDN caching headers, edge request deduplication  |

---

## API Reference

The application exposes a set of REST endpoints designed for low-latency responses, aggressive edge micro-caching, and
automated error recovery:

| Method   | Endpoint                       | Description                                                     | Cache Policy               |
|:---------|:-------------------------------|:----------------------------------------------------------------|:---------------------------|
| `GET`    | `/api/bus`                     | Returns full city timetable data and metadata                   | `s-maxage=60`, SWR: `300s` |
| `GET`    | `/api/bus/[routeId]`           | Live bus GPS positions for the specified route ID               | `s-maxage=2`, SWR: `3s`    |
| `GET`    | `/api/bus/health`              | Connectivity check against national TAGO API                    | `no-store`                 |
| `POST`   | `/api/bus/refresh`             | Triggers a fresh scrape of official Wonju ITS schedules         | `no-store`                 |
| `GET`    | `/api/bus-arrival/[busStopId]` | Predicted arrival times for buses arriving at a stop            | `s-maxage=5`, SWR: `10s`   |
| `GET`    | `/api/bus-stops/[routeId]`     | Ordered sequence of bus stops for a specific route              | `s-maxage=86400`           |
| `GET`    | `/api/route-stops/[routeName]` | Ordered directional stops mapped by route name                  | `s-maxage=86400`           |
| `GET`    | `/api/schedule`                | Complete schedule JSON payload                                  | `s-maxage=60`, SWR: `300s` |
| `POST`   | `/api/schedule/refresh`        | Force scrape and update local schedule cache                    | `no-store`                 |
| `GET`    | `/api/notice`                  | List of municipal transit notices from Wonju ITS                | `s-maxage=300`             |
| `GET`    | `/api/notice/[id]`             | Full detail of a specific ITS transit notice                    | `s-maxage=600`             |
| `GET`    | `/api/comments`                | List recent passenger comments (supports `?limit=` & `?force=`) | `s-maxage=2`, SWR: `4s`    |
| `POST`   | `/api/comments`                | Post a new comment or reply (with rate-limiting guard)          | `no-store`                 |
| `PATCH`  | `/api/comments`                | Increment comment like counter (with IP rate limiting)          | `no-store`                 |
| `DELETE` | `/api/comments`                | Delete a comment (requires matching authorTag and IP hash)      | `no-store`                 |
| `GET`    | `/api/data/[...path]`          | Serves static assets from local `public/` directory             | `public, max-age=3600`     |

---

## Local Development and Setup

### Prerequisites

- **Node.js**: Version 20.x or higher
- **Package Manager**: `npm` (version 10 or later)
- **Container Engine** (Optional, for running local OSRM): Podman or Docker

### 1. Repository Setup

Clone the repository and install project dependencies:

```bash
git clone https://github.com/kernelily/wBus.git
cd wBus
npm install
```

### 2. Environment Configuration

Create a local environment file by copying `.env.example`:

```bash
cp .env.example .env.local
```

Populate the required environment variables in `.env.local`:

```dotenv
# Public Data Portal (MOLIT Bus Location and Route Information API)
DATA_GO_KR_SERVICE_KEY="YOUR_DECODED_OR_ENCODED_PUBLIC_DATA_KEY"

# Supabase Database & Realtime Settings
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-public-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-secret-key"

# Optional PostgreSQL Direct Connections (for migration or direct client use)
POSTGRES_URL="postgres://postgres:password@db.your-project.supabase.co:5432/postgres"

# Static Data Remote Loading Switch (default: false, loads from public/)
NEXT_PUBLIC_USE_REMOTE_STATIC_DATA="false"
NEXT_PUBLIC_STATIC_API_URL=""

# Local OSRM Routing Engine URL (used during polyline generation pipeline)
OSRM_API_URL="http://localhost:4000/route/v1/driving"
```

### 3. Data Pipeline Execution

Before running the application for the first time, generate the necessary route geometries and schedule datasets.

#### Fetch Timetables from Wonju ITS

Scrapes the latest bus departure times, interval details, and holiday adjustments:

```bash
npm run schedule
```

The output is verified and saved to `public/data/schedule.json`.

#### Generate Route Polylines and Segments

Connects to the public data portal and your OSRM routing container to construct high-precision route vector GeoJSON
files:

```bash
# Run full polyline generation pipeline
npm run polyline

# Or target specific routes
node scripts/generate-polyline-segment.mjs --route 30
```

> [!NOTE]
> For instructions on setting up the local OSRM routing server on ARM64 or x86_64, refer to
the [OSRM Setup Guide](./scripts/osrm-assets/README.md).

### 4. Run Development Server

Start the local Next.js server with Turbopack acceleration:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to inspect the application.

---

## Available Scripts

| Command             | Purpose                                                     |
|:--------------------|:------------------------------------------------------------|
| `npm run dev`       | Starts the development server using Next.js Turbopack       |
| `npm run build`     | Compiles the production application bundle                  |
| `npm run start`     | Launches the compiled production application                |
| `npm run lint`      | Runs ESLint across all source and script files              |
| `npm run lint:fix`  | Automatically resolves fixable ESLint warnings and errors   |
| `npm run typecheck` | Executes TypeScript compiler checks without emitting output |
| `npm run test`      | Runs unit test suites using Vitest                          |
| `npm run polyline`  | Executes the OSRM polyline generation and snapping pipeline |
| `npm run schedule`  | Scrapes official timetables from Wonju City ITS             |

---

## Testing and Code Quality

The codebase includes automated unit test suites covering security functions, coordinate mathematics, cache
invalidation, and concurrency control.

Run the test suite:

```bash
npm run test
```

Execute type and lint checks:

```bash
npm run typecheck
npm run lint
```

---

## License

This project is licensed under the terms of the [MIT License](./LICENSE).
