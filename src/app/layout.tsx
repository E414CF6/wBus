import type {Metadata, Viewport} from "next";
import {ThemeProvider} from "@components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
    title: "연세대학교 버스 정보",
    description: "연세대학교 미래캠퍼스 운행 정보를 제공하는 웹사이트입니다. 미래캠퍼스의 30번, 34번, 34-1번 버스 시간표와 매지리, 회촌 등 주요 정류장 정보를 확인할 수 있습니다.",
    keywords: ["연세대학교", "미래캠퍼스", "원주", "버스시간표", "30번", "34번", "34-1번", "매지리", "회촌",],
    authors: [{name: "wBus"}],
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: [{media: "(prefers-color-scheme: light)", color: "#f8fafc"}, {
        media: "(prefers-color-scheme: dark)", color: "#090d16"
    },],
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (<html lang="ko" suppressHydrationWarning>
    <body
        className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors duration-200">
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
    </ThemeProvider>
    </body>
    </html>);
}
