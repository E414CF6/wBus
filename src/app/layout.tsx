import "./globals.css";

import React from "react";
import type {Metadata, Viewport} from "next";

import {ThemeProvider} from "@shared/ui/ThemeProvider";
import {AppMapContextProvider} from "@shared/context/AppMapContext";
import {Analytics} from "@vercel/analytics/react";
import {SpeedInsights} from "@vercel/speed-insights/next";

import {HTML_LANG, LOCALE, UI_TEXT} from "@shared/config/locale";
import {SITE_CONFIG} from "@shared/config/env";

export const metadata: Metadata = {
    metadataBase: new URL(SITE_CONFIG.METADATA.BASE_URL),
    applicationName: UI_TEXT.METADATA.SITE_NAME,
    title: {
        default: UI_TEXT.METADATA.TITLE, template: UI_TEXT.METADATA.TITLE_TEMPLATE,
    },
    description: UI_TEXT.METADATA.DESC,
    keywords: [...UI_TEXT.METADATA.KEYWORDS],
    authors: [{name: UI_TEXT.METADATA.AUTHOR}],
    creator: UI_TEXT.METADATA.AUTHOR,
    publisher: UI_TEXT.METADATA.AUTHOR,
    formatDetection: {
        telephone: false, date: false, address: false, email: false,
    },
    icons: {
        icon: "/favicon.ico", apple: "/apple-touch-icon.png",
    },
    appleWebApp: {
        capable: true, statusBarStyle: "black-translucent", title: UI_TEXT.METADATA.SITE_NAME,
    },
    openGraph: {
        type: "website",
        locale: UI_TEXT.METADATA.OG_LOCALE,
        url: SITE_CONFIG.METADATA.BASE_URL,
        siteName: UI_TEXT.METADATA.SITE_NAME,
        title: UI_TEXT.METADATA.TITLE,
        description: UI_TEXT.METADATA.DESC,
        images: [{
            url: SITE_CONFIG.METADATA.SOCIAL_IMAGE, width: 1200, height: 630, alt: UI_TEXT.METADATA.TITLE,
        },],
    },
    twitter: {
        card: "summary_large_image",
        title: UI_TEXT.METADATA.TITLE,
        description: UI_TEXT.METADATA.DESC,
        images: [SITE_CONFIG.METADATA.SOCIAL_IMAGE],
    },
    robots: {
        index: true, follow: true, googleBot: {
            index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1,
        },
    },
    alternates: {
        canonical: "/",
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

const jsonLd = {
    "@context": "https://schema.org", "@graph": [{
        "@type": "WebSite",
        "@id": `${SITE_CONFIG.METADATA.BASE_URL}/#website`,
        url: SITE_CONFIG.METADATA.BASE_URL,
        name: UI_TEXT.METADATA.SITE_NAME,
        description: UI_TEXT.METADATA.DESC,
        inLanguage: LOCALE,
    }, {
        "@type": "WebApplication",
        "@id": `${SITE_CONFIG.METADATA.BASE_URL}/#webapp`,
        name: UI_TEXT.METADATA.SITE_NAME,
        url: SITE_CONFIG.METADATA.BASE_URL,
        description: UI_TEXT.METADATA.DESC,
        applicationCategory: "TravelApplication",
        operatingSystem: "All",
        inLanguage: LOCALE,
    },],
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (<html lang={HTML_LANG} suppressHydrationWarning>
    <head>
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd)}}
        />
        <title>{UI_TEXT.METADATA.TITLE}</title>
    </head>
    <body className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200">
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
