# wBus: Real-Time Bus Tracking System

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js-black?logo=next.js)](./Vision)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue?logo=typescript)](./Vision)

**wBus** is a full-stack, real-time bus tracking application for Wonju, South Korea. It combines an integrated data
processing pipeline with a modern, interactive Next.js frontend to deliver live bus locations, routes, and timetables.

---

## 🏗️ Architecture & Component Overview

The application is structured inside `Vision/`:

1. **Integrated Data Pipeline (`scripts/polly.mjs`)**:
    - Replaces the legacy Rust workspace with a lightweight Node.js script.
    - Fetches raw route & station data from TAGO (Public Data Portal).
    - Snaps route paths using OSRM to generate clean GeoJSON polylines.
    - Crawls Wonju ITS timetable schedules (`scrape-wonju-its.js`).
    - Packages output static data into `public/data/` or Vercel Blob.

2. **Web Application (`Vision/`)**:
    - Next.js 16 (App Router) + React 19 + TypeScript + MapLibre GL / Mapbox.
    - High-performance live tracking via Server-Sent Events (SSE) `/api/bus/stream`.
    - Resilience features: Circuit Breaker, Multi-Key Rotation, Rate-Limiting TaskQueue, and Stale-If-Error fallback
      caching.

---

## 🚀 Quick Start

### 1. Set Up Environment Variables

Inside `Vision/`:

```bash
cd Vision
cp .env.local.example .env.local
```

Set your Public Data Portal service key:

```dotenv
DATA_GO_KR_SERVICE_KEY="YOUR_DECODED_SERVICE_KEY"
```

### 2. Run Data Pipeline (Polly)

To fetch routes, snap polylines, and scrape timetables:

```bash
npm run polly
```

Or run individual subcommands:

```bash
# Process routes & OSRM snapping only
npm run polly route

# Scrape timetable schedules only
npm run polly:schedule
```

### 3. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠️ Technology Stack

- **Framework**: Next.js 16, React 19, Tailwind CSS 4
- **Language**: TypeScript, Node.js (ES Modules)
- **Data & Caching**: Redis (Upstash/Redis), Memory Cache, Stale-While-Revalidate (SWR)
- **Mapping**: MapLibre GL, React Map GL
- **Pipeline Tools**: OSRM API, Node Fetch

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for details.
