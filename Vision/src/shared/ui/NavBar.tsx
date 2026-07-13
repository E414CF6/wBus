"use client";

import {APP_CONFIG} from "@shared/config/env";
import {UI_TEXT} from "@shared/config/locale";
import {MapIcon, Moon, Sun} from "lucide-react";
import {useTheme} from "next-themes";
import React, {useEffect, useState} from "react";

interface NavBarProps {
    className?: string;
}

/**
 * Floating Navigation Bar / Header.
 * Displays the App Logo, Name, and an interactive Theme Toggle.
 */
export default function NavBar({className = ""}: NavBarProps) {
    const {setTheme, resolvedTheme} = useTheme();
    const [mounted, setMounted] = useState(false);
    const [localIsDark, setLocalIsDark] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Sync localIsDark with resolvedTheme and initial DOM class list
    useEffect(() => {
        if (mounted) {
            setLocalIsDark(resolvedTheme === "dark" || document.documentElement.classList.contains("dark"));
        }
    }, [mounted, resolvedTheme]);

    const toggleTheme = () => {
        const nextTheme = localIsDark ? "light" : "dark";
        setLocalIsDark(!localIsDark);

        // 1. Update next-themes to persist selection in localStorage
        setTheme(nextTheme);

        // 2. Direct DOM manipulation fallback (forces immediate render of CSS variables & Tailwind classes)
        if (typeof document !== "undefined") {
            if (nextTheme === "dark") {
                document.documentElement.classList.add("dark");
                document.documentElement.style.colorScheme = "dark";
            } else {
                document.documentElement.classList.remove("dark");
                document.documentElement.style.colorScheme = "light";
            }
        }
    };

    return (<nav
        aria-label={UI_TEXT.ACCESSIBILITY.MAIN_NAV}
        className={`absolute top-[env(safe-area-inset-top,1rem)] left-4 z-50 mt-4 ${className}`}
    >
        <div
            className="
          flex items-center gap-3 p-2.5 pr-3.5 
          bg-white/85 dark:bg-[#111111]/85 backdrop-blur-3xl 
          border border-black/4 dark:border-white/6 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-[28px]
          transition-transform hover:scale-102 active:scale-98 cursor-default
        "
        >
            {/* Logo Icon Container */}
            <div
                className="flex items-center justify-center w-8.5 h-8.5 rounded-full bg-black dark:bg-white text-white dark:text-black">
                <MapIcon className="w-4 h-4" strokeWidth={2.5} aria-hidden="true"/>
            </div>

            {/* App Title */}
            <h1 className="text-[16px] font-extrabold text-black dark:text-white tracking-tight select-none">
                {APP_CONFIG.NAME}
            </h1>

            {/* Divider */}
            <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-1" />

            {/* Theme Toggle Button */}
            <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center justify-center w-8.5 h-8.5 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.08] text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-all duration-200 active:scale-90"
                aria-label="Toggle theme"
            >
                {!mounted ? (
                    <div className="w-4.5 h-4.5 rounded-full border border-gray-300 animate-pulse" />
                ) : localIsDark ? (
                    <Sun className="w-4.5 h-4.5" strokeWidth={2.5} />
                ) : (
                    <Moon className="w-4.5 h-4.5" strokeWidth={2.5} />
                )}
            </button>
        </div>
    </nav>);
}
