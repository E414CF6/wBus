import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

import React from "react";

import { ThemeProvider } from "next-themes";
import { Geist, Geist_Mono } from "next/font/google";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { APP_CONFIG, SITE_CONFIG } from "@core/config/env";

import { MapContextProvider } from "@map/context/MapContext";

import type { Metadata, Viewport } from "next";

// Google Fonts (Geist Sans, Geist Mono)
const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

// Page Metadata
export const metadata: Metadata = {
    metadataBase: new URL(SITE_CONFIG.METADATA.BASE_URL),

    title: {
        default: APP_CONFIG.NAME,
        template: `${APP_CONFIG.NAME} · %s`,
    },
    description: SITE_CONFIG.METADATA.DESCRIPTION,

    alternates: {
        canonical: "/",
    },

    openGraph: {
        type: "website",
        url: SITE_CONFIG.METADATA.BASE_URL,
        siteName: APP_CONFIG.NAME,
        title: APP_CONFIG.NAME,
        description: SITE_CONFIG.METADATA.DESCRIPTION,
        images: [
            {
                url: SITE_CONFIG.METADATA.SOCIAL_IMAGE,
                width: 1200,
                height: 630,
                alt: APP_CONFIG.NAME,
            },
        ],
    },

    twitter: {
        card: "summary_large_image",
        title: APP_CONFIG.NAME,
        description: SITE_CONFIG.METADATA.DESCRIPTION,
        images: [SITE_CONFIG.METADATA.SOCIAL_IMAGE],
    },

    icons: {
        icon: "/favicon.ico",
        apple: "/apple-touch-icon.png",
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: true,
    viewportFit: "cover",
    themeColor: "#003876",
    colorScheme: "light",
};

// RootLayout is the main layout part that wraps around all pages.
// It includes global styles, the MapContextProvider for map context, and analytics components.
export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ko" suppressHydrationWarning>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                    {/* Provides global map context via MapContextProvider */}
                    <MapContextProvider>{children}</MapContextProvider>
                </ThemeProvider>
                {/* Vercel SpeedInsights and Analytics components */}
                <SpeedInsights />
                <Analytics />
            </body>
        </html>
    );
}
