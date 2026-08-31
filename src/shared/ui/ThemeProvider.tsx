"use client";

import * as React from "react";
import {ThemeProvider as NextThemesProvider, useTheme} from "next-themes";

function ThemeColorSync() {
    const {resolvedTheme} = useTheme();

    React.useEffect(() => {
        const isDark = resolvedTheme === "dark";
        const color = isDark ? "#0b0f19" : "#f8fafc";

        // Update all theme-color meta tags
        const metas = document.querySelectorAll('meta[name="theme-color"]');
        if (metas.length > 0) {
            metas.forEach((meta) => {
                meta.setAttribute("content", color);
            });
        } else {
            const meta = document.createElement("meta");
            meta.name = "theme-color";
            meta.content = color;
            document.head.appendChild(meta);
        }
    }, [resolvedTheme]);

    return null;
}

export function ThemeProvider({
                                  children,
                                  ...props
                              }: React.ComponentProps<typeof NextThemesProvider>) {
    return (
        <NextThemesProvider {...props}>
            <ThemeColorSync/>
            {children}
        </NextThemesProvider>
    );
}
