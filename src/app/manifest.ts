import type {MetadataRoute} from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "wBus",
        short_name: "wBus",
        description: "원주시 실시간 시내버스 위치 및 버스 시간표",
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
