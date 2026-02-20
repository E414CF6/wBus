"use client";

import { MapIcon } from "lucide-react";

import { APP_CONFIG } from "@core/config/env";

interface NavBarProps {
    className?: string;
}

/**
 * Floating Navigation Bar / Header.
 * Displays the App Logo and Name in a glassmorphism "pill" style.
 */
export default function NavBar({ className = "" }: NavBarProps) {
    return (
        <nav
            aria-label="Main Navigation"
            className={`absolute top-[env(safe-area-inset-top,1rem)] left-4 z-50 mt-4 ${className}`}
        >
            <div
                className="
          flex items-center gap-3 p-2 pr-5 
          bg-white/70 dark:bg-black/70 backdrop-blur-xl 
          border border-black/5 dark:border-white/10 shadow-sm rounded-full
          transition-transform hover:scale-105 active:scale-95 cursor-default
        "
            >
                {/* Logo Icon Container */}
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black dark:bg-white text-white dark:text-black">
                    <MapIcon className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
                </div>

                {/* App Title */}
                <h1 className="text-[15px] font-bold text-black dark:text-white tracking-tight select-none">
                    {APP_CONFIG.NAME}
                </h1>
            </div>
        </nav>
    );
}
