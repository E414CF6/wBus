"use client";

import {useEffect} from "react";

export function ServiceWorkerRegister() {
    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
            return;
        }

        // In development (Turbopack HMR), actively unregister any existing service workers
        // and purge Cache Storage to prevent serving stale /_next/static chunks.
        if (process.env.NODE_ENV !== "production") {
            navigator.serviceWorker
                .getRegistrations()
                .then((registrations) => {
                    for (const registration of registrations) {
                        registration.unregister();
                    }
                })
                .catch(() => {
                });

            if ("caches" in window) {
                caches
                    .keys()
                    .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
                    .catch(() => {
                    });
            }
            return;
        }

        // Register in production after window loads so as not to block initial paint
        const handleLoad = () => {
            navigator.serviceWorker
                .register("/sw.js")
                .then((reg) => {
                    reg.update().catch(() => {
                    });
                })
                .catch((err) => {
                    console.warn("[SW] Registration failed:", err);
                });
        };

        if (document.readyState === "complete") {
            handleLoad();
        } else {
            window.addEventListener("load", handleLoad);
            return () => window.removeEventListener("load", handleLoad);
        }
    }, []);

    return null;
}

export default ServiceWorkerRegister;
