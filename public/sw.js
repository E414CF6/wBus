// wBus Lightweight Offline & Static Asset Service Worker (v1)
const CACHE_NAME = "wbus-v1";

const PRECACHE_ASSETS = [
    "/",
    "/favicon.ico",
    "/apple-touch-icon.png",
    "/workers/maplibre-gl-worker.mjs",
    "/styles/liberty.json",
    "/styles/darker.json",
    "/schedule.json",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS).catch((err) => {
                console.warn("[SW] Precache asset fetch failure:", err);
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const {request} = event;
    const url = new URL(request.url);

    // 1. Skip non-GET and chrome-extension/external requests
    if (request.method !== "GET" || !url.protocol.startsWith("http")) {
        return;
    }

    // 2. Real-time telemetry API routes are strictly Network-Only to ensure live data freshness
    if (url.pathname.startsWith("/api/bus")) {
        return;
    }

    // 3. Static assets, tiles, workers, schedules: Stale-While-Revalidate
    const isStaticAsset =
        url.pathname.startsWith("/_next/static") ||
        url.pathname.startsWith("/workers/") ||
        url.pathname.startsWith("/styles/") ||
        url.pathname.endsWith(".json") ||
        url.pathname.endsWith(".png") ||
        url.pathname.endsWith(".ico") ||
        url.pathname.endsWith(".woff2");

    if (isStaticAsset) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(request);
                const fetchPromise = fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => null);

                return cachedResponse || fetchPromise || new Response("Asset not found", {status: 404});
            })
        );
        return;
    }

    // 4. HTML document navigation: Network First, fallback to cached App Shell
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request).then((response) => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
            }).catch(async () => {
                const cached = await caches.match(request);
                return cached || caches.match("/");
            })
        );
    }
});
