"use client";

import React, {memo, useSyncExternalStore} from "react";
import {Moon, Sun} from "lucide-react";
import {useTheme} from "next-themes";
import {UI_TEXT} from "@shared/config/locale";

const emptySubscribe = () => () => {};

export const NavThemeToggle = memo(function NavThemeToggle() {
    const {setTheme, resolvedTheme} = useTheme();
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

    const isDark = mounted
        ? resolvedTheme === "dark" || (typeof document !== "undefined" && document.documentElement.classList.contains("dark"))
        : false;

    const toggleTheme = () => {
        const nextTheme = isDark ? "light" : "dark";
        setTheme(nextTheme);

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

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={UI_TEXT.NAV.THEME_TOGGLE_LABEL}
            className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all duration-200 cursor-pointer select-none active:scale-90 shrink-0"
        >
            {isDark ? (
                <Moon className="w-4 h-4 text-blue-400 stroke-[2.2] animate-fadeIn"/>
            ) : (
                <Sun className="w-4 h-4 text-amber-500 stroke-[2.2] animate-fadeIn"/>
            )}
        </button>
    );
});
