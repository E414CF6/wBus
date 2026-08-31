# wBus

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)\
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

**wBus** is a modern, full-stack real-time bus tracking, timetable, and community web application built for **Wonju
City (원주시), South Korea**. It integrates a resilient transit data processing pipeline with a high-performance Next.js 16
frontend to deliver live bus locations, interactive route maps, municipal announcements, comprehensive timetables, and a
real-time thread-based passenger community.

---

## ✨ Key Features

### 🎓 Dedicated Yonsei University Mode

- **Campus Departure Focus**: Tailored schedule views for routes **30**, **34**, and **34-1**.
- **No Depot Distractions**: Filters out irrelevant depot departure times (Jangyang-ri), displaying strictly **Yonsei
  University departures** (Routes 30 & 34) and **Hoechon departures** (Route 34-1).
- **Spotlight Departure Card**: Computes and highlights the soonest upcoming campus departure with live countdown timers
  (`N minutes remaining`).
- **Single-Column Focused Modal**: Detailed modal view featuring arrival seq, campus departure times, notes, and
  one-click CSV schedule export.

### 🗺️ Lazy-Loaded Interactive Real-Time Map

- **On-Demand Loading**: MapLibre GL map engine and live telemetry streams are mounted **only** when the user activates
  the *Real-time Map* tab.
- **Zero Overhead**: Browsing timetables generates **zero** background map tile or SSE telemetry requests, significantly
  optimizing bandwidth and battery life.
- **Polyline Snapping & Animation**: Bus GPS coordinates snap onto OSRM route polylines with smooth 3-second animated
  marker transitions.

### 💬 Real-Time Thread Community & Live Bus Chatter (실시간 톡)

- **Hierarchical Threaded Conversations**: Full support for root topics and nested replies (대댓글), enabling organized,
  Reddit/forum-style real-time discussions for transit incidents, delays, or tips.
- **Route & Category Tagging**: Filter feeds by specific bus route numbers (e.g. 30, 34, 34-1) or categories (*제보, 꿀팁,
  질문, 분실물, 잡담*).
- **One-Tap Quick Report Presets**: Rapidly broadcast road congestion, full bus alerts, empty seat statuses, or
  lost-item notices with pre-configured chips.
- **Lightweight Anonymous Identity System**: Ephemeral yet persistent user identification via client-generated hash tags
  (`#a1b2c3`) and fun transit-themed Korean nicknames without cumbersome login friction.
- **Community Reactions & Moderation**: Upvoting (좋아요) system, clipboard sharing, search filtering by query or user tag,
  and author-controlled message deletion.

### 📅 Comprehensive City-Wide Timetables

- Searchable timetable directory covering all Wonju city bus routes.
- Multi-day filters (*Weekdays*, *Saturdays*, *Sundays/Holidays*).
- Route bookmarking saved to local browser storage.
- Real-time map navigation directly from schedule cards.

### 📢 Wonju ITS Notice Center Integration

- Direct integration with Wonju City Intelligent Transportation System (ITS) announcements.
- Integrated banner and detail modal for viewing official municipal transit notices.

### ⚡ Resilient Data Pipeline & Caching

- **Multi-Tier Caching**: L1 In-Memory Cache + L2 Upstash Redis + CDN / Static File fallbacks.
- **Network Resiliency**: Includes request coalescing (preventing cache stampedes), circuit breaking, and graceful
  static cache fallbacks when government servers (`its.wonju.go.kr`) experience network timeouts.

---

## 🏗️ Architecture & Project Structure

The project follows **Feature-Sliced Design (FSD)** principles for strict modularity and clear code boundaries:

```
src/
├── app/                  # Next.js App Router (pages, API endpoints, layouts)
│   ├── api/
│   │   ├── bus/          # Telemetry & Route API endpoints (/api/bus, /api/bus/stream)
│   │   ├── comments/     # Thread Community API (/api/comments - GET/POST/PATCH/DELETE)
│   │   ├── notice/       # Municipal Notice API (/api/notice)
│   │   └── schedule/     # Timetable API (/api/schedule)
│   ├── globals.css       # Global styles & Tailwind v4 theme directives
│   └── page.tsx          # Single-page application entry (Tab orchestrator)
├── components/           # UI composite widgets & views
│   ├── ChatView.tsx      # Real-time thread-based community & chat feed
│   ├── RouteCard.tsx     # Timetable route card item
│   └── NoticeModal.tsx   # ITS announcement dialog
├── entities/             # Domain entities & data access models
│   ├── bus/              #   Bus items, telemetry types & utilities
│   ├── route/            #   Route information, polyline hooks & mappings
│   └── station/          #   Bus stop & station location definitions
├── features/             # Business logic & use-case hooks
│   ├── live-tracking/    #   Live telemetry hooks (SSE / SWR polling)
│   └── map-view/         #   Map view state & persistence
├── shared/               # Cross-cutting infrastructure & design system
│   ├── api/              #   HTTP client with retries & timeout handling
│   ├── cache/            #   CacheManager (LRU & request deduplication)
│   ├── config/           #   Centralized environment variables & storage keys
│   ├── context/          #   Global map context provider
│   ├── lib/              #   Bus scraper, time math & comment storage service
│   ├── redis/            #   Upstash REST client & TCP Redis cache client
│   ├── types/            #   TypeScript interfaces (comments, bus, routes)
│   └── ui/               #   Unified bottom navigation bar, splash screen & common UI
└── widgets/              # Composite UI blocks
    ├── MapContainer/     #   MapLibre GL wrapper, route polylines & live markers
    ├── NoticeWidget/     #   Wonju ITS notice banner & modal
    ├── TimetableWidget/  #   City-wide timetable grid, search, filter & modals
    └── YonseiTimetableWidget/ # Dedicated Yonsei University timetable suite
```

**Dependency Hierarchy:** `widgets → features → entities → shared`.

---

## 🔄 Data Pipeline & Telemetry Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL DATA SOURCES                          │
│  apis.data.go.kr (TAGO API)    its.wonju.go.kr    Vercel Blob / Static  │
│  (Live Bus Telemetry)          (ITS Schedules)    (GeoJSON & Maps)      │
└───────────┬──────────────────────────┬─────────────────────┬────────────┘
            │                          │                     │
       ┌────▼────┐               ┌─────▼───────┐        ┌────▼─────┐
       │ Upstash │               │ Local Cache │        │ Browser  │
       │  Redis  │               │ (Blob/JSON) │        │ Storage  │
       └────┬────┘               └─────┬───────┘        └──────────┘
            │                          │
       ┌────▼──────────────────────────▼──────────────────────────────────┐
       │                       API ROUTES (Server)                        │
       │  GET  /api/bus                   → Timetable Cache & Meta        │
       │  POST /api/bus/refresh           → ITS Scraper + Blob Update     │
       │  GET  /api/bus/stream            → SSE Telemetry Stream          │
       │  GET  /api/notice                → Wonju ITS Announcements       │
       │  GET/POST/PATCH/DELETE /api/comments → Live Thread Community     │
       └───────────────────────────────┬──────────────────────────────────┘
                                       │
       ┌───────────────────────────────▼──────────────────────────────────┐
       │                    CLIENT (Lazy SSE + SWR)                       │
       │  Timetable View: Zero background telemetry overhead              │
       │  Map View: SSE stream (/api/bus/stream) + MapLibre Renderer      │
       │  Chat View: Threaded Community Feed + Real-time Polling & Posts  │
       └──────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

| Category                     | Technology                                                     |
|:-----------------------------|:---------------------------------------------------------------|
| **Framework**                | Next.js 16 (App Router, Turbopack)                             |
| **UI Library**               | React 19                                                       |
| **Language**                 | TypeScript 5 (Strict Mode)                                     |
| **Styling**                  | Tailwind CSS 4, Vanilla CSS Design System                      |
| **Icons & Design**           | Lucide React                                                   |
| **Map Rendering**            | MapLibre GL JS via `react-map-gl`                              |
| **Live Telemetry & Sync**    | Server-Sent Events (`EventSource`), Dynamic Polling            |
| **Data Scraping & Pipeline** | Node.js Fetch, Cheerio, OSRM Polyline Snapping                 |
| **Cache & Persistence**      | Upstash Redis (@upstash/redis REST), Vercel Blob, LocalStorage |

---

## 🚀 Quick Start & Local Development

### 1. Environment Setup

Copy `.env.local.example` to create your local `.env.local` configuration file:

```bash
cp .env.local.example .env.local
```

Configure your environment variables inside `.env.local`:

```dotenv
# Korea Public Data Portal Key (apis.data.go.kr)
DATA_GO_KR_SERVICE_KEY="YOUR_DECODED_SERVICE_KEY"

# Upstash Redis Serverless REST API (For Live Thread Community & Telemetry)
UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"

# Optional Standard Redis URL fallback
REDIS_URL="rediss://default:token@your-instance.upstash.io:6379"

# Remote static data toggle (Set "false" to use local public/data directory)
NEXT_PUBLIC_USE_REMOTE_STATIC_DATA="false"
NEXT_PUBLIC_STATIC_API_URL="/data"
```

### 2. Run Data Pipeline

To fetch route polylines, snap paths via OSRM, and scrape official schedules:

```bash
npm run polyline
```

Or run individual sub-tasks:

```bash
# Scrape Wonju ITS timetable schedules only
npm run schedule
```

### 3. Start Development Server

Run the development server with Turbopack:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📜 Available Scripts

| Command             | Description                                          |
|:--------------------|:-----------------------------------------------------|
| `npm run dev`       | Starts the Next.js development server with Turbopack |
| `npm run build`     | Compiles the production build                        |
| `npm run start`     | Starts the production server                         |
| `npm run typecheck` | Runs TypeScript type checking without emitting files |
| `npm run lint`      | Runs ESLint code style and quality check             |
| `npm run polyline`  | Runs full polyline processing pipeline               |
| `npm run schedule`  | Scrapes official timetables from Wonju ITS           |
| `npm run upload`    | Uploads static asset files to Vercel Blob storage    |

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for full details.
