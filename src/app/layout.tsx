import type {Metadata, Viewport} from "next";
import {ThemeProvider} from "@shared/ui/ThemeProvider";
import {AppMapContextProvider} from "@shared/context/AppMapContext";
import {Analytics} from "@vercel/analytics/react";
import {SpeedInsights} from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
    title: {
        default: "wBus", template: "wBus · %s",
    },
    description: "원주시 및 연세대 미래캠퍼스 실시간 버스 위치 및 버스 시간표",
    keywords: ["연세대학교", "미래캠퍼스", "원주", "원주버스", "버스시간표", "실시간버스", "wBus", "30번", "34번", "34-1번",],
    authors: [{name: "wBus"}],
    icons: {
        icon: "/favicon.ico", apple: "/apple-touch-icon.png",
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
        className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 transition-colors duration-200">
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
