import "./globals.css";

import React from "react";
import type {Metadata, Viewport} from "next";

import {ThemeProvider} from "@shared/ui/ThemeProvider";
import {AppMapContextProvider} from "@shared/context/AppMapContext";
import {Analytics} from "@vercel/analytics/react";
import {SpeedInsights} from "@vercel/speed-insights/next";

export const metadata: Metadata = {
    title: {
        default: "wBus", template: "wBus / %s",
    },
    description: "원주시 시내버스 실시간 위치 및 시간표",
    keywords: ["연세대학교", "미래캠퍼스", "원주", "원주버스", "버스시간표", "실시간버스", "wBus", "30번", "34번", "34-1번",],
    authors: [{name: "wBus"}],
    icons: {
        icon: "/favicon.ico", apple: "/apple-touch-icon.png",
    },
    appleWebApp: {
        capable: true, statusBarStyle: "black-translucent", title: "wBus",
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
    themeColor: [{media: "(prefers-color-scheme: light)", color: "#f8fafc"}, {
        media: "(prefers-color-scheme: dark)", color: "#0b0f19"
    },],
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (<html lang="ko" suppressHydrationWarning>
    <body
        className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200">
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AppMapContextProvider>
            {children}
        </AppMapContextProvider>
    </ThemeProvider>
    <SpeedInsights/>
    <Analytics/>
    </body>
    </html>);
}
