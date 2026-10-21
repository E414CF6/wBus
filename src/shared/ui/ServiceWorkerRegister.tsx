"use client";

import {useEffect} from "react";

export function ServiceWorkerRegister() {
    useEffect(() => {
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
            // Register after window loads so as not to block initial paint and critical metric reporting
            const handleLoad = () => {
                navigator.serviceWorker
                    .register("/sw.js")
                    .then((reg) => {
                        if (process.env.NODE_ENV === "development") {
                            console.log("[SW] Registered successfully:", reg.scope);
                        }
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
        }
    }, []);

    return null;
}

export default ServiceWorkerRegister;
