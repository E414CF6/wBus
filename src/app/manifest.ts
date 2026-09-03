import type {MetadataRoute} from "next";

import {UI_TEXT} from "@shared/config/locale";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: UI_TEXT.METADATA.SITE_NAME,
        short_name: UI_TEXT.METADATA.SITE_NAME,
        description: UI_TEXT.METADATA.DESC,
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0b0f19",
        theme_color: "#0b0f19",
        icons: [{
            src: "/favicon.ico", sizes: "48x48 32x32 16x16", type: "image/x-icon",
        }, {
            src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png",
        }, {
            src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png",
        }, {
            src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png",
        },],
    };
}
